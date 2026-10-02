import argparse
import re
from datetime import datetime
from urllib.parse import urljoin, urlparse
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup

from common import Campaign, extract_region_from_title, normalize_region_group


BASE_URL = "https://4blog.net"
LIST_URLS = (
    f"{BASE_URL}/list/all",
    f"{BASE_URL}/list/all/deliv",
    f"{BASE_URL}/list/all/reporter",
    f"{BASE_URL}/list/danggeun",
    f"{BASE_URL}/list/all/local/sseoul",
    f"{BASE_URL}/list/all/local/seoul",
    f"{BASE_URL}/list/all/local/ggic",
    f"{BASE_URL}/list/all/local/ggbb",
    f"{BASE_URL}/list/all/local/icnb",
    f"{BASE_URL}/list/all/local/bsgs",
    f"{BASE_URL}/list/all/local/dgdg",
    f"{BASE_URL}/list/all/local/djch",
    f"{BASE_URL}/list/all/local/gjjr",
    f"{BASE_URL}/list/all/local/ga",
    f"{BASE_URL}/list/all/local/jeju",
)
CAMPAIGN_RE = re.compile(r"^/campaign/(\d+)/?$")
RECRUIT_RE = re.compile(r"모집\s*([\d,]+)명")
PERIOD_RE = re.compile(
    r"모집\s*(\d{2}\.\d{2})\s*[~～-]\s*(\d{2}\.\d{2})"
)
POINT_RE = re.compile(r"([\d,]+)\s*P\b", re.IGNORECASE)


def build_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/154.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.7",
        }
    )
    return session


def parse_campaign_link(href: str) -> tuple[str, str] | None:
    parsed = urlparse(urljoin(BASE_URL, href))
    if parsed.netloc != urlparse(BASE_URL).netloc:
        return None

    match = CAMPAIGN_RE.match(parsed.path)
    if not match:
        return None

    source_id = match.group(1)
    return source_id, f"{BASE_URL}/campaign/{source_id}/"


def find_card(anchor):
    for parent in anchor.parents:
        if getattr(parent, "name", None) in {"body", "html"}:
            break
        text = " ".join(parent.stripped_strings)
        if PERIOD_RE.search(text) and RECRUIT_RE.search(text):
            return parent
        if len(text) > 5000:
            break
    return None


def _candidate_title(card, anchor) -> str:
    for selector in (
        ".subject",
        ".title",
        ".campaign-title",
        ".item-title",
        "h2",
        "h3",
        "h4",
        "strong",
    ):
        node = card.select_one(selector)
        if node:
            text = " ".join(node.stripped_strings).strip()
            if text and "모집" not in text:
                return text

    parts = [" ".join(node.stripped_strings).strip() for node in anchor.find_all(["span", "p", "div"])]
    parts.append(" ".join(anchor.stripped_strings).strip())

    ignored = {
        "방문형",
        "배송형",
        "기자단",
        "블로그",
        "인스타",
        "인스타그램",
        "릴스",
        "유튜브",
        "숏츠",
        "틱톡",
        "스레드",
        "네이버클립",
        "당근",
        "X",
        "기타",
    }
    for part in parts:
        if (
            part
            and part not in ignored
            and not part.startswith("모집 ")
            and not PERIOD_RE.search(part)
            and not re.fullmatch(r"D-?\d+|오늘마감", part.replace(" ", ""))
            and len(part) <= 220
        ):
            return part
    return ""


def parse_media_type(text: str) -> str:
    if "릴스" in text:
        return "숏폼(릴스)"
    if "숏츠" in text or "쇼츠" in text or "네이버클립" in text:
        return "숏폼"
    if "유튜브" in text:
        return "유튜브"
    if "틱톡" in text:
        return "숏폼"
    if "인스타" in text:
        return "인스타그램"
    if "당근" in text:
        return "당근"
    if re.search(r"(?:^|\s)X(?:\s|$)", text):
        return "X"
    return "블로그"


def parse_campaign_type(text: str, title: str) -> str | None:
    source = f"{text} {title}"
    if "페이백" in source:
        return "페이백"
    if "기자단" in source:
        return "기자단"
    if "배송형" in source or "[제품" in title or "[배송" in title:
        return "배송형"
    if "방문형" in source:
        return "방문형"
    return None


def parse_region(title: str, campaign_type: str | None) -> str | None:
    if campaign_type in {"배송형", "페이백"}:
        return "배송"
    if campaign_type == "기자단":
        return "전국"

    region = extract_region_from_title(title)
    if region:
        return region.replace("/", " ").strip()

    bracket = re.match(r"^\[([^\]]+)\]", title.strip())
    if bracket:
        candidate = bracket.group(1).replace("/", " ").strip()
        if normalize_region_group(candidate):
            return candidate
    return None


def parse_deadline(text: str, *, now: datetime | None = None) -> str | None:
    match = PERIOD_RE.search(text)
    if not match:
        return None

    try:
        month, day = map(int, match.group(2).split("."))
    except ValueError:
        return None

    seoul = ZoneInfo("Asia/Seoul")
    current = (now or datetime.now(seoul)).astimezone(seoul)
    try:
        target = datetime(
            current.year,
            month,
            day,
            23,
            59,
            59,
            tzinfo=seoul,
        )
    except ValueError:
        return None

    if target.date() < current.date() and (current.date() - target.date()).days > 31:
        try:
            target = target.replace(year=current.year + 1)
        except ValueError:
            return None
    return target.isoformat()


def extract_reward(card, title: str, text: str) -> str:
    for node in card.find_all("p"):
        value = " ".join(node.stripped_strings).strip()
        if not value or value == title:
            continue
        if PERIOD_RE.search(value):
            continue
        if RECRUIT_RE.fullmatch(value):
            continue
        if value in {
            "방문형",
            "배송형",
            "기자단",
            "블로그",
            "인스타",
            "인스타그램",
            "릴스",
            "유튜브",
            "숏츠",
            "틱톡",
            "스레드",
            "네이버클립",
            "당근",
            "X",
            "기타",
        }:
            continue
        if re.fullmatch(r"D-?\d+|오늘마감", value.replace(" ", "")):
            continue
        if len(value) >= 3:
            reward = value[:1200]
            point = POINT_RE.search(text)
            if point and point.group(0) not in reward:
                reward = f"{reward} · {point.group(0)}"
            return reward

    point = POINT_RE.search(text)
    return point.group(0) if point else ""


def parse_campaign(anchor) -> Campaign | None:
    link_data = parse_campaign_link(anchor.get("href", ""))
    if link_data is None:
        return None
    source_id, link = link_data

    card = find_card(anchor)
    if card is None:
        return None

    text = " ".join(card.stripped_strings).strip()
    recruit = RECRUIT_RE.search(text)
    period = PERIOD_RE.search(text)
    if not recruit or not period:
        return None

    title = _candidate_title(card, anchor)
    if not title:
        return None

    campaign_type = parse_campaign_type(text, title)
    region = parse_region(title, campaign_type)
    reward = extract_reward(card, title, text)

    return Campaign(
        platform="포블로그",
        source_campaign_id=source_id,
        title=title,
        link=link,
        media_type=parse_media_type(text),
        reward=reward,
        is_points=bool(POINT_RE.search(text)),
        recruit_count=int(recruit.group(1).replace(",", "")),
        region=region,
        campaign_type=campaign_type,
        deadline_at=parse_deadline(text),
    )


def parse_page(html: str) -> list[Campaign]:
    soup = BeautifulSoup(html, "html.parser")
    campaigns: dict[str, Campaign] = {}

    for anchor in soup.find_all("a", href=True):
        link_data = parse_campaign_link(anchor.get("href", ""))
        if link_data is None:
            continue
        source_id, _ = link_data
        if source_id in campaigns:
            continue

        campaign = parse_campaign(anchor)
        if campaign is not None:
            campaigns[source_id] = campaign

    return list(campaigns.values())


def collect_public_partitions(session: requests.Session) -> list[Campaign]:
    campaigns: dict[str, Campaign] = {}

    for url in LIST_URLS:
        response = session.get(url, timeout=(10, 30))
        response.raise_for_status()
        page_campaigns = parse_page(response.text)
        print(f"포블로그 공개 분할 {url}: {len(page_campaigns)}개 발견")

        for campaign in page_campaigns:
            campaigns[campaign.source_campaign_id] = campaign

    return list(campaigns.values())


def get_poblog_data(*, dry_run: bool = False) -> list[Campaign]:
    """
    Collect the server-rendered public partitions as a coverage probe.

    4blog loads more campaigns with client-side infinite scroll. Until the
    complete public loading contract is identified and validated, this
    collector intentionally stays out of run_all.py and never writes to the
    production database.
    """
    with build_session() as session:
        campaigns = collect_public_partitions(session)

    if not campaigns:
        raise RuntimeError("포블로그 공개 목록에서 캠페인을 파싱하지 못했습니다.")

    print(f"포블로그 공개 분할 dry-run: 중복 제거 후 {len(campaigns)}개 확인")

    if not dry_run:
        raise RuntimeError(
            "포블로그 무한스크롤의 전체 로딩 계약이 아직 검증되지 않아 "
            "production 저장을 차단합니다."
        )

    return campaigns


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="공개 분할 목록만 검증하고 DB에는 저장하지 않습니다.",
    )
    args = parser.parse_args()
    get_poblog_data(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
