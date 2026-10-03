import argparse
import re
import time
from datetime import datetime
from typing import Any
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
    if value == "결제형":
        return "페이백", None
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
    if region is None:
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


def parse_api_media_type(item: dict[str, Any]) -> str:
    media_flags = (
        ("cp_media_reels", "숏폼(릴스)"),
        ("cp_media_clip", "숏폼"),
        ("cp_media_instagram", "인스타그램"),
        ("cp_media_threads", "스레드"),
        ("cp_media_shop", "쇼핑몰"),
        ("cp_media_blog", "블로그"),
    )
    for key, label in media_flags:
        if str(item.get(key, "")).strip() == "1":
            return label
    return ""


def parse_integer(value: object) -> int | None:
    normalized = str(value if value is not None else "").replace(",", "").strip()
    return int(normalized) if normalized.isdigit() else None


def parse_deadline_value(value: object) -> str | None:
    raw = str(value if value is not None else "").strip()
    if not raw:
        return None

    try:
        parsed = datetime.strptime(raw, "%Y/%m/%d %H:%M:%S")
    except ValueError:
        return None

    return parsed.replace(tzinfo=ZoneInfo("Asia/Seoul")).isoformat()


def parse_api_campaign(item: dict[str, Any]) -> Campaign | None:
    source_id = str(item.get("cp_id", "")).strip()
    title = str(item.get("cp_subject", "")).strip()
    if not source_id.isdigit() or not title:
        return None

    campaign_type, default_region = normalize_campaign_type(
        str(item.get("cp_type", ""))
    )
    media_type = parse_api_media_type(item)
    apply_count = parse_integer(item.get("cp_order"))
    recruit_count = parse_integer(item.get("cp_recruit"))
    deadline_at = parse_deadline_value(item.get("cp_countdown"))
    if (
        campaign_type is None
        or not media_type
        or apply_count is None
        or recruit_count is None
        or deadline_at is None
    ):
        return None

    reward_parts: list[str] = []
    for key in ("cp_opt_text", "cp_opt_name", "cp_point2", "cp_point_text"):
        value = " ".join(str(item.get(key, "")).split()).strip()
        if not value:
            continue
        point_match = POINT_RE.search(value)
        if point_match and int(point_match.group(1).replace(",", "")) == 0:
            continue
        reward_parts.append(value)
    reward = " · ".join(dict.fromkeys(reward_parts))

    region = default_region
    if region is None:
        region = extract_region_from_title(title)

    image_url = ""
    image_path = str(item.get("cp_img", "")).strip()
    if image_path:
        image_url = urljoin(BASE_URL, image_path)

    return Campaign(
        platform="아싸뷰",
        source_campaign_id=source_id,
        title=title,
        link=f"{BASE_URL}{DETAIL_PATH}?cp_id={source_id}",
        image_url=image_url,
        media_type=media_type,
        reward=reward,
        is_points=bool(POINT_RE.search(reward)),
        apply_count=apply_count,
        recruit_count=recruit_count,
        region=region,
        campaign_type=campaign_type,
        deadline_at=deadline_at,
    )


def parse_api_page(payload: object) -> tuple[list[Campaign], bool]:
    if not isinstance(payload, dict):
        raise RuntimeError("아싸뷰 목록 API 응답이 객체가 아닙니다.")

    raw_items = payload.get("list")
    count = parse_integer(payload.get("count"))
    last_page_value = str(payload.get("last_page", "")).strip()
    if not isinstance(raw_items, list) or count is None:
        raise RuntimeError("아싸뷰 목록 API의 count/list 구조가 변경되었습니다.")
    if last_page_value not in {"0", "1"}:
        raise RuntimeError("아싸뷰 목록 API의 last_page 구조가 변경되었습니다.")
    if count != len(raw_items):
        raise RuntimeError(
            "아싸뷰 목록 API의 count와 실제 항목 수가 일치하지 않습니다."
        )

    campaigns: dict[str, Campaign] = {}
    for raw_item in raw_items:
        if not isinstance(raw_item, dict):
            raise RuntimeError("아싸뷰 목록 API에 객체가 아닌 항목이 있습니다.")
        campaign = parse_api_campaign(raw_item)
        if campaign is None:
            raise RuntimeError("아싸뷰 목록 API 항목을 정규화하지 못했습니다.")
        if campaign.source_campaign_id in campaigns:
            raise RuntimeError("아싸뷰 목록 API 한 페이지에 중복 ID가 있습니다.")
        campaigns[campaign.source_campaign_id] = campaign

    return list(campaigns.values()), last_page_value == "1"


def fetch_page(
    session: requests.Session,
    *,
    page: int,
) -> dict[str, Any]:
    response = session.get(
        LIST_URL,
        params={
            "json": "list",
            "type": "",
            "cate": "",
            "area": "",
            "local": "",
            "area_detail": "",
            "mission": "",
            "orderby": "cp_recommend",
            "keyword": "",
            "page": page,
            "chip": "",
            "cf_shop": "0",
            "cf_reward": "0",
            "cf_open": "0",
            "cf_mission": "",
            "cf_interest": "",
            "cf_area": "",
            "cf_area_type": "",
            "ct": "",
        },
        headers={
            "X-Requested-With": "XMLHttpRequest",
            "Referer": LIST_URL,
        },
        timeout=(10, 30),
    )
    response.raise_for_status()
    try:
        payload = response.json()
    except requests.exceptions.JSONDecodeError as exc:
        raise RuntimeError("아싸뷰 목록 API가 JSON을 반환하지 않았습니다.") from exc
    if not isinstance(payload, dict):
        raise RuntimeError("아싸뷰 목록 API 응답이 객체가 아닙니다.")
    return payload


def collect_all(
    session: requests.Session,
    *,
    max_pages: int = MAX_PAGES,
    sleep_between: bool = True,
) -> list[Campaign]:
    campaigns: dict[str, Campaign] = {}

    for page in range(1, max_pages + 1):
        page_campaigns, is_last_page = parse_api_page(
            fetch_page(session, page=page)
        )
        if not page_campaigns:
            if page == 1 or not is_last_page:
                raise RuntimeError(
                    "아싸뷰 목록 API가 예기치 않게 빈 페이지를 반환했습니다."
                )
            print(f"아싸뷰 목록 종료 page={page}: 빈 마지막 페이지")
            return list(campaigns.values())

        new_count = 0
        for campaign in page_campaigns:
            if campaign.source_campaign_id not in campaigns:
                campaigns[campaign.source_campaign_id] = campaign
                new_count += 1

        print(
            f"아싸뷰 page={page}: {len(page_campaigns)}개, "
            f"신규 {new_count}개, 누적 {len(campaigns)}개"
        )

        if new_count != len(page_campaigns):
            raise RuntimeError(
                "아싸뷰 목록 API가 페이지 사이에서 중복 ID를 반환했습니다."
            )

        if is_last_page:
            print(f"아싸뷰 목록 종료 page={page}: last_page=1")
            return list(campaigns.values())

        if sleep_between:
            time.sleep(0.35)

    raise RuntimeError(
        f"아싸뷰 목록이 max_pages={max_pages} 안에 종료되지 않았습니다."
    )

def get_assaview_data(*, dry_run: bool = True) -> list[Campaign]:
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


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--dry-run",
        action="store_true",
        help="공개 목록 전체를 검증하고 DB에는 저장하지 않습니다(기본값).",
    )
    mode.add_argument(
        "--write",
        action="store_true",
        help="검증 완료 후에만 수집 결과를 DB에 저장합니다.",
    )
    args = parser.parse_args(argv)
    get_assaview_data(dry_run=not args.write)


if __name__ == "__main__":
    main()
