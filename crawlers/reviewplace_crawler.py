import re
from datetime import datetime, timedelta
from urllib.parse import parse_qs, urlencode, urljoin, urlparse, urlunparse
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup

from common import Campaign, get_database_connection, upsert_campaigns


BASE_URL = "https://www.reviewplace.co.kr"
CATEGORY_URLS = {
    "제품": f"{BASE_URL}/pr/?ct1=%EC%A0%9C%ED%92%88",
    "지역": f"{BASE_URL}/pr/?ct1=%EC%A7%80%EC%97%AD",
    "기자단": f"{BASE_URL}/pr/?ct1=%EA%B8%B0%EC%9E%90%EB%8B%A8",
    "구매평": f"{BASE_URL}/pr/?ct1=%EA%B5%AC%EB%A7%A4%ED%8F%89",
    "프리미엄": f"{BASE_URL}/pr/?ct1=%ED%94%84%EB%A6%AC%EB%AF%B8%EC%97%84",
}

COUNT_RE = re.compile(r"신청\s*([\d,]+)\s*/\s*([\d,]+)명")
D_DAY_RE = re.compile(r"D\s*-\s*(\d+)")
POINT_RE = re.compile(r"([\d,]+)P")
LEADING_TAG_RE = re.compile(r"^\s*(?:\[([^\]]+)\]|\(([^)]+)\))\s*")


def build_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/146.0.0.0 Safari/537.36"
            )
        }
    )
    return session


def clean_link(href: str) -> tuple[str, str] | None:
    parsed = urlparse(urljoin(BASE_URL, href))
    query = parse_qs(parsed.query)
    source_ids = query.get("id")
    if not parsed.path.endswith("/pr/") or not source_ids:
        return None

    source_id = source_ids[0]
    clean_query = urlencode({"id": source_id})
    clean_url = urlunparse(
        (parsed.scheme, parsed.netloc, parsed.path, "", clean_query, "")
    )
    return source_id, clean_url


def parse_media_type(text: str) -> str:
    tag_match = LEADING_TAG_RE.match(text)
    tag = " ".join(part for part in tag_match.groups() if part) if tag_match else ""
    source = tag or text[:80]

    if "릴스" in source:
        return "숏폼(릴스)"
    if "쇼츠" in source or "클립" in source:
        return "숏폼"
    if "유튜브" in source:
        return "유튜브"
    if "인스타" in source:
        return "인스타그램"
    return "블로그"


def parse_deadline(text: str) -> str | None:
    seoul = ZoneInfo("Asia/Seoul")
    today = datetime.now(seoul).date()

    match = D_DAY_RE.search(text)
    if match:
        target = today + timedelta(days=int(match.group(1)))
    elif "오늘마감" in text.replace(" ", ""):
        target = today
    else:
        return None

    return datetime(
        target.year,
        target.month,
        target.day,
        23,
        59,
        59,
        tzinfo=seoul,
    ).isoformat()


def split_content(text: str) -> tuple[str, str]:
    deadline_markers = []
    dday = D_DAY_RE.search(text)
    if dday:
        deadline_markers.append(dday.start())

    compact = text.replace(" ", "")
    if "오늘마감" in compact:
        original = text.find("오늘마감")
        if original >= 0:
            deadline_markers.append(original)

    cutoff = min(deadline_markers) if deadline_markers else len(text)
    content = text[:cutoff].strip()
    content = LEADING_TAG_RE.sub("", content).strip()

    if "♥" in content:
        title, reward = content.split("♥", 1)
        return title.strip(), reward.strip()

    points = POINT_RE.findall(text)
    reward = f"{points[-1]}P" if points else ""

    title = re.sub(r"\s+", " ", content).strip()
    if len(title) > 180:
        title = title[:177].rstrip() + "..."

    return title, reward


def parse_campaign(anchor, category: str) -> Campaign | None:
    link_data = clean_link(anchor.get("href", ""))
    if not link_data:
        return None

    source_id, link = link_data
    text = " ".join(anchor.stripped_strings).strip()
    if not text:
        return None

    count_match = COUNT_RE.search(text)
    if not count_match:
        return None

    title, reward = split_content(text)
    if not title:
        return None

    apply_count = int(count_match.group(1).replace(",", ""))
    recruit_count = int(count_match.group(2).replace(",", ""))

    campaign_type = None
    region = None

    if category == "제품":
        campaign_type = "배송형"
        region = "배송"
    elif category == "지역":
        campaign_type = "방문형"
    elif category == "구매평":
        campaign_type = "페이백"

    return Campaign(
        platform="리뷰플레이스",
        source_campaign_id=source_id,
        title=title,
        link=link,
        media_type=parse_media_type(text),
        reward=reward,
        is_points=bool(POINT_RE.search(text)),
        apply_count=apply_count,
        recruit_count=recruit_count,
        region=region,
        campaign_type=campaign_type,
        deadline_at=parse_deadline(text),
    )


def collect_category(
    session: requests.Session,
    category: str,
    url: str,
) -> list[Campaign]:
    response = session.get(url, timeout=(10, 30))
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    campaigns: list[Campaign] = []
    seen_ids: set[str] = set()

    for anchor in soup.find_all("a", href=True):
        link_data = clean_link(anchor.get("href", ""))
        if not link_data:
            continue

        source_id, _ = link_data
        if source_id in seen_ids:
            continue

        campaign = parse_campaign(anchor, category)
        if campaign is None:
            continue

        campaigns.append(campaign)
        seen_ids.add(source_id)

    print(f"리뷰플레이스 {category}: {len(campaigns)}개 발견")
    return campaigns


def get_reviewplace_data():
    print("리뷰플레이스 크롤링을 시작합니다...")

    campaigns_by_id: dict[str, Campaign] = {}

    with build_session() as session:
        for category, url in CATEGORY_URLS.items():
            for campaign in collect_category(session, category, url):
                campaigns_by_id[campaign.source_campaign_id] = campaign

    campaigns = list(campaigns_by_id.values())
    if not campaigns:
        raise RuntimeError("리뷰플레이스에서 수집할 캠페인을 찾지 못했습니다.")

    saved = upsert_campaigns(get_database_connection(), campaigns)
    print(f"리뷰플레이스 {saved}개 캠페인 DB 동기화 완료")


if __name__ == "__main__":
    get_reviewplace_data()
