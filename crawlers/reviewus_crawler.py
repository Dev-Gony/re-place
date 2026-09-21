import re
from datetime import datetime, timedelta
from urllib.parse import parse_qs, urljoin, urlparse
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup

from common import Campaign, get_database_connection, upsert_campaigns


BASE_URL = "https://kr.reviewus.co.kr"
LIST_URL = f"{BASE_URL}/review_new_campaign_list.php"
COUNT_RE = re.compile(r"신청\s*([\d,]+)\s*/\s*모집\s*([\d,]+)")
D_DAY_RE = re.compile(r"D-Day\s*(\d+)", re.IGNORECASE)


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


def parse_detail_link(href: str) -> tuple[str, str] | None:
    parsed = urlparse(urljoin(BASE_URL, href))
    if not parsed.path.endswith("review_campaign.php"):
        return None

    query = parse_qs(parsed.query)
    source_ids = query.get("cp_id")
    if not source_ids:
        return None

    source_id = source_ids[0]
    return source_id, f"{BASE_URL}/review_campaign.php?cp_id={source_id}"


def parse_media_type(text: str) -> str:
    if "인스타 릴스" in text or "인스타그램 릴스" in text or "릴스" in text:
        return "숏폼(릴스)"
    if "유튜브 쇼츠" in text or "쇼츠" in text:
        return "숏폼"
    if "유튜브" in text:
        return "유튜브"
    if "틱톡" in text:
        return "숏폼"
    if "인스타" in text:
        return "인스타그램"
    return "블로그"


def parse_deadline(text: str) -> str | None:
    match = D_DAY_RE.search(text)
    if not match:
        return None

    seoul = ZoneInfo("Asia/Seoul")
    target = datetime.now(seoul).date() + timedelta(days=int(match.group(1)))
    return datetime(
        target.year,
        target.month,
        target.day,
        23,
        59,
        59,
        tzinfo=seoul,
    ).isoformat()


def parse_campaign(anchor) -> Campaign | None:
    link_data = parse_detail_link(anchor.get("href", ""))
    if not link_data:
        return None

    source_id, link = link_data
    info = anchor.select_one(".it_info")
    if info is None:
        return None

    text = " ".join(info.stripped_strings).strip()
    if not text or "모집마감" in text:
        return None

    title_node = info.select_one(".it_name")
    title = " ".join(title_node.stripped_strings).strip() if title_node else ""
    if not title:
        return None

    count_match = COUNT_RE.search(text)
    if not count_match:
        return None

    apply_count = int(count_match.group(1).replace(",", ""))
    recruit_count = int(count_match.group(2).replace(",", ""))

    type_node = info.select_one(".option2")
    raw_type = " ".join(type_node.stripped_strings).strip() if type_node else ""

    if "배송" in raw_type:
        campaign_type = "배송형"
        region = "배송"
    elif "방문" in raw_type:
        campaign_type = "방문형"
        region = None
    else:
        campaign_type = None
        region = None

    sns_node = info.select_one(".sns_info")
    sns_text = " ".join(sns_node.stripped_strings).strip() if sns_node else text

    return Campaign(
        platform="리뷰어스",
        source_campaign_id=source_id,
        title=title,
        link=link,
        media_type=parse_media_type(sns_text),
        reward="",
        apply_count=apply_count,
        recruit_count=recruit_count,
        region=region,
        campaign_type=campaign_type,
        deadline_at=parse_deadline(text),
    )


def get_reviewus_data():
    print("리뷰어스 크롤링을 시작합니다...")

    with build_session() as session:
        response = session.get(LIST_URL, timeout=(10, 30))
        response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    campaigns_by_id: dict[str, Campaign] = {}

    for anchor in soup.find_all("a", href=True):
        campaign = parse_campaign(anchor)
        if campaign is None:
            continue
        campaigns_by_id[campaign.source_campaign_id] = campaign

    campaigns = list(campaigns_by_id.values())
    if not campaigns:
        raise RuntimeError("리뷰어스에서 수집할 캠페인을 찾지 못했습니다.")

    saved = upsert_campaigns(get_database_connection(), campaigns)
    print(f"리뷰어스 {saved}개 캠페인 DB 동기화 완료")


if __name__ == "__main__":
    get_reviewus_data()
