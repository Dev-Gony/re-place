import re
import time
from datetime import datetime, timedelta
from urllib.parse import urljoin, urlparse
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup

from common import (
    Campaign,
    extract_region_from_title,
    get_database_connection,
    normalize_campaign_type,
    upsert_campaigns,
)


BASE_URL = "https://www.mrblog.net"
LIST_URL = f"{BASE_URL}/"
CAMPAIGN_RE = re.compile(r"^/campaigns/(\d+)$")
COUNT_RE = re.compile(r"신청\s*([\d,]+)명?\s*/\s*모집\s*([\d,]+)명")
DAYS_RE = re.compile(r"(\d+)일\s*남음")


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


def parse_campaign_link(href: str) -> tuple[str, str] | None:
    parsed = urlparse(urljoin(BASE_URL, href))
    match = CAMPAIGN_RE.match(parsed.path)
    if not match:
        return None

    source_id = match.group(1)
    return source_id, f"{BASE_URL}/campaigns/{source_id}"


def parse_deadline(text: str) -> str | None:
    days_match = DAYS_RE.search(text)
    if not days_match:
        if "오늘 마감" not in text and "오늘마감" not in text:
            return None
        days = 0
    else:
        days = int(days_match.group(1))

    seoul = ZoneInfo("Asia/Seoul")
    target = datetime.now(seoul).date() + timedelta(days=days)
    return datetime(
        target.year,
        target.month,
        target.day,
        23,
        59,
        59,
        tzinfo=seoul,
    ).isoformat()


def parse_media_type(text: str) -> str:
    lowered = text.lower()

    if "릴스" in text:
        return "숏폼(릴스)"
    if "숏폼" in text or "클립" in text:
        return "숏폼"
    if "유튜브" in text or "youtube" in lowered:
        return "유튜브"
    if "인스타" in text or "instagram" in lowered:
        return "인스타그램"
    return "블로그"


def parse_card(anchor) -> Campaign | None:
    href = anchor.get("href", "").strip()
    parsed_link = parse_campaign_link(href)
    if not parsed_link:
        return None

    source_id, link = parsed_link
    card_text = " ".join(anchor.stripped_strings)

    subject = anchor.select_one(".subject")
    title = " ".join(subject.stripped_strings).strip() if subject else ""
    if not title:
        return None

    desc = anchor.select_one(".desc")
    reward = " ".join(desc.stripped_strings).strip() if desc else ""

    apply_count = 0
    recruit_count = 0
    count_match = COUNT_RE.search(card_text)
    if count_match:
        apply_count = int(count_match.group(1).replace(",", ""))
        recruit_count = int(count_match.group(2).replace(",", ""))

    region = extract_region_from_title(title)

    raw_type = None
    if "배송" in card_text:
        raw_type = "배송"
    elif "페이백" in card_text:
        raw_type = "페이백"
    elif region:
        raw_type = "방문"

    return Campaign(
        platform="미블",
        source_campaign_id=source_id,
        title=title,
        link=link,
        media_type=parse_media_type(card_text),
        reward=reward,
        is_points="포인트" in reward,
        apply_count=apply_count,
        recruit_count=recruit_count,
        region=region,
        campaign_type=normalize_campaign_type(
            raw_type,
            title=f"{title} {reward}",
            region=region,
        ),
        deadline_at=parse_deadline(card_text),
    )


def parse_page(html: str) -> list[Campaign]:
    soup = BeautifulSoup(html, "html.parser")
    campaigns: list[Campaign] = []
    seen_ids: set[str] = set()

    for anchor in soup.find_all("a", href=True):
        parsed_link = parse_campaign_link(anchor.get("href", ""))
        if not parsed_link:
            continue

        source_id, _ = parsed_link
        if source_id in seen_ids:
            continue

        campaign = parse_card(anchor)
        if campaign is None:
            continue

        campaigns.append(campaign)
        seen_ids.add(source_id)

    return campaigns


def get_mible_data():
    print("미블(Mible) 크롤링을 시작합니다...")

    all_campaigns: dict[str, Campaign] = {}
    max_pages = 30

    with build_session() as session:
        for page in range(1, max_pages + 1):
            params = {"page": page} if page > 1 else None
            response = session.get(
                LIST_URL,
                params=params,
                timeout=(10, 30),
            )
            response.raise_for_status()

            page_campaigns = parse_page(response.text)
            if not page_campaigns:
                if page == 1:
                    raise RuntimeError("미블 캠페인 목록을 파싱하지 못했습니다.")
                break

            new_count = 0
            for campaign in page_campaigns:
                if campaign.source_campaign_id not in all_campaigns:
                    all_campaigns[campaign.source_campaign_id] = campaign
                    new_count += 1

            print(
                f"미블 {page}페이지: {len(page_campaigns)}개 발견, "
                f"신규 {new_count}개"
            )

            if new_count == 0:
                break

            time.sleep(0.8)

    campaigns = list(all_campaigns.values())
    if not campaigns:
        raise RuntimeError("미블에서 수집할 캠페인을 찾지 못했습니다.")

    saved = upsert_campaigns(get_database_connection(), campaigns)
    print(f"미블 {saved}개 캠페인 DB 동기화 완료")


if __name__ == "__main__":
    get_mible_data()
