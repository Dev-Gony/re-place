import argparse
import re
import time
from datetime import datetime
from urllib.parse import parse_qs, urljoin, urlparse
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from common import (
    Campaign,
    extract_region_from_title,
    get_database_connection,
    upsert_campaigns,
)


BASE_URL = "https://assaview.co.kr"
LIST_URL = f"{BASE_URL}/campaign_list.php"
DETAIL_PATH = "/campaign.php"
COUNT_RE = re.compile(r"신청\s*([\d,]+)\s*/\s*([\d,]+)명")
POINT_RE = re.compile(r"\+?\s*([\d,]+)\s*P\b", re.IGNORECASE)
MAX_PAGES = 250


def build_session() -> requests.Session:
    retry = Retry(
        total=3,
        connect=3,
        read=2,
        status=2,
        backoff_factor=1.2,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset({"GET", "POST"}),
        respect_retry_after_header=True,
    )
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
    session.mount("https://", HTTPAdapter(max_retries=retry))
    session.mount("http://", HTTPAdapter(max_retries=retry))
    return session


def parse_campaign_link(href: str) -> tuple[str, str] | None:
    parsed = urlparse(urljoin(BASE_URL, href))
    if parsed.netloc != urlparse(BASE_URL).netloc:
        return None
    if parsed.path != DETAIL_PATH:
        return None

    values = parse_qs(parsed.query).get("cp_id", [])
    if not values or not values[0].isdigit():
        return None

    source_id = values[0]
    return source_id, f"{BASE_URL}{DETAIL_PATH}?cp_id={source_id}"


def parse_deadline(anchor) -> str | None:
    timer = anchor.select_one(".timer[data-countdown1]")
    raw = timer.get("data-countdown1", "").strip() if timer else ""

    if not raw:
        image_box = anchor.select_one(".imgBox")
        if image_box:
            classes = " ".join(image_box.get("class", []))
            match = re.search(
                r"(20\d{2}/\d{2}/\d{2}\s+\d{2}:\d{2}:\d{2})",
                classes,
            )
            raw = match.group(1) if match else ""

    if not raw:
        return None

    try:
        parsed = datetime.strptime(raw, "%Y/%m/%d %H:%M:%S")
    except ValueError:
        return None

    return parsed.replace(tzinfo=ZoneInfo("Asia/Seoul")).isoformat()


def parse_media_type(anchor) -> str:
    sources = [
        str(image.get("src", "")).lower()
        for image in anchor.select("img.review_type_icon")
    ]
    joined = " ".join(sources)

    if "reels" in joined:
        return "숏폼(릴스)"
    if "clip" in joined:
        return "숏폼"
    if "insta" in joined:
        return "인스타그램"
    if "threads" in joined:
        return "스레드"
    if "shop" in joined:
        return "쇼핑몰"
    return "블로그"


def normalize_campaign_type(raw_type: str) -> tuple[str | None, str | None]:
    value = raw_type.strip()

    if value == "방문형":
        return "방문형", None
    if value == "배송형":
        return "배송형", "배송"
    if value in {"구매형", "선착순 구매형"}:
        return "페이백", "배송"
    if value == "기자단":
        return "기자단", "전국"

    return None, None


def parse_campaign(anchor) -> Campaign | None:
    link_data = parse_campaign_link(anchor.get("href", ""))
    if link_data is None:
        return None
    source_id, link = link_data

    title_node = anchor.select_one(".subject")
    title = " ".join(title_node.stripped_strings).strip() if title_node else ""
    if not title:
        return None

    type_node = anchor.select_one(".rs_cp_type_chip")
    raw_type = " ".join(type_node.stripped_strings).strip() if type_node else ""
    campaign_type, default_region = normalize_campaign_type(raw_type)

    text = " ".join(anchor.stripped_strings)
    count_match = COUNT_RE.search(text)
    if not count_match:
        return None

    apply_count = int(count_match.group(1).replace(",", ""))
    recruit_count = int(count_match.group(2).replace(",", ""))

    reward_parts: list[str] = []
    reward_node = anchor.select_one(".opt_name")
    if reward_node:
        reward = " ".join(reward_node.stripped_strings).strip()
        if reward:
            reward_parts.append(reward)

    point_node = anchor.select_one(".fill_label .text")
    if point_node:
        point_text = " ".join(point_node.stripped_strings).strip()
        if point_text:
            reward_parts.append(point_text)

    reward = " · ".join(dict.fromkeys(reward_parts))

    region = default_region
    if campaign_type == "방문형":
        region = extract_region_from_title(title)

    image_url = ""
    image = anchor.select_one(".imgBox img[src]")
    if image:
        src = str(image.get("src", "")).strip()
        if src:
            image_url = urljoin(BASE_URL, src)

    return Campaign(
        platform="아싸뷰",
        source_campaign_id=source_id,
        title=title,
        link=link,
        image_url=image_url,
        media_type=parse_media_type(anchor),
        reward=reward,
        is_points=bool(POINT_RE.search(reward)),
        apply_count=apply_count,
        recruit_count=recruit_count,
        region=region,
        campaign_type=campaign_type,
        deadline_at=parse_deadline(anchor),
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


def parse_load_state(html: str, initial_count: int) -> dict[str, object]:
    soup = BeautifulSoup(html, "html.parser")
    button = soup.select_one("#load_more_campaigns") or soup.select_one(
        "#load_more_btn"
    )

    if button is None:
        return {
            "page": 0,
            "offset": initial_count,
            "limit": 10,
            "category": "",
            "type": "",
        }

    def integer(name: str, default: int) -> int:
        value = str(button.get(name, "")).strip()
        return int(value) if value.isdigit() else default

    return {
        "page": integer("data-page", 0),
        "offset": integer("data-offset", initial_count),
        "limit": integer("data-limit", 10),
        "category": str(button.get("data-category", "") or "").strip(),
        "type": str(button.get("data-type", "") or "").strip(),
    }


def fetch_more(
    session: requests.Session,
    *,
    page: int,
    offset: int,
    limit: int,
    category: str,
    campaign_type: str,
) -> str:
    response = session.post(
        LIST_URL,
        data={
            "limit": limit,
            "offset": offset,
            "category": category,
            "type": campaign_type,
            "load_more": "true",
            "page": page,
        },
        headers={
            "X-Requested-With": "XMLHttpRequest",
            "Referer": LIST_URL,
        },
        timeout=(10, 30),
    )
    response.raise_for_status()
    return response.text


def collect_all(
    session: requests.Session,
    *,
    max_pages: int = MAX_PAGES,
    sleep_between: bool = True,
) -> list[Campaign]:
    response = session.get(LIST_URL, timeout=(10, 30))
    response.raise_for_status()

    initial = parse_page(response.text)
    if not initial:
        raise RuntimeError("아싸뷰 초기 캠페인 목록을 파싱하지 못했습니다.")

    campaigns = {item.source_campaign_id: item for item in initial}
    state = parse_load_state(response.text, len(initial))

    page = int(state["page"])
    offset = int(state["offset"])
    limit = int(state["limit"])
    category = str(state["category"])
    campaign_type = str(state["type"])

    print(
        f"아싸뷰 초기 목록: {len(initial)}개, "
        f"page={page}, offset={offset}, limit={limit}"
    )

    for _ in range(max_pages):
        fragment = fetch_more(
            session,
            page=page,
            offset=offset,
            limit=limit,
            category=category,
            campaign_type=campaign_type,
        )
        page_campaigns = parse_page(fragment)

        if not page_campaigns:
            print("아싸뷰 load-more 종료: 추가 캠페인 없음")
            break

        new_count = 0
        for campaign in page_campaigns:
            if campaign.source_campaign_id not in campaigns:
                campaigns[campaign.source_campaign_id] = campaign
                new_count += 1

        print(
            f"아싸뷰 추가 page={page}: {len(page_campaigns)}개, "
            f"신규 {new_count}개, 누적 {len(campaigns)}개"
        )

        if new_count == 0:
            raise RuntimeError(
                "아싸뷰 load-more가 신규 ID 없이 동일 목록을 반복했습니다."
            )

        offset += len(page_campaigns)
        page += 1

        if sleep_between:
            time.sleep(0.35)
    else:
        raise RuntimeError(
            f"아싸뷰 목록이 max_pages={max_pages} 안에 종료되지 않았습니다."
        )

    return list(campaigns.values())


def get_assaview_data(*, dry_run: bool = False) -> list[Campaign]:
    with build_session() as session:
        campaigns = collect_all(session)

    if not campaigns:
        raise RuntimeError("아싸뷰에서 수집할 캠페인을 찾지 못했습니다.")

    if dry_run:
        print(f"아싸뷰 dry-run 완료: 고유 {len(campaigns)}개")
        return campaigns

    saved = upsert_campaigns(get_database_connection(), campaigns)
    print(f"아싸뷰 {saved}개 캠페인 DB 동기화 완료")
    return campaigns


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="공개 목록 전체를 검증하고 DB에는 저장하지 않습니다.",
    )
    args = parser.parse_args()
    get_assaview_data(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
