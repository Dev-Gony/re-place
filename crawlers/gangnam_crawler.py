import argparse
import re
import time
from datetime import datetime, timedelta
from urllib.parse import parse_qs, urljoin, urlparse
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from common import (
    Campaign, extract_region_from_title, get_database_connection,
    normalize_campaign_type, upsert_campaigns,
)


BASE_URL = "https://gangnam-review.net"
RECOMMEND_URL = f"{BASE_URL}/index_recommend.php"
LIST_URL = f"{BASE_URL}/theme/go/_list_cmp_tpl.php"
PAGE_SIZE = 28
SEOUL = ZoneInfo("Asia/Seoul")


def build_session() -> requests.Session:
    retry = Retry(
        total=3,
        connect=3,
        read=2,
        status=2,
        backoff_factor=1.5,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset({"GET"}),
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
            "Referer": f"{BASE_URL}/cp/",
        }
    )
    session.mount("https://", HTTPAdapter(max_retries=retry))
    session.mount("http://", HTTPAdapter(max_retries=retry))
    return session


def canonical_source_id(href: str) -> str | None:
    parsed = urlparse(urljoin(BASE_URL, href))
    if parsed.scheme != "https" or parsed.netloc not in {
        "gangnam-review.net", "xn--939au0g4vj8sq.net", "강남맛집.net",
    }:
        return None
    if parsed.path.rstrip("/") != "/cp":
        return None

    values = parse_qs(parsed.query).get("id", [])
    if not values or not values[0].isdigit():
        return None
    return values[0]


def _image_url(image_html: str) -> str:
    if not image_html:
        return ""

    soup = BeautifulSoup(image_html, "html.parser")
    image = soup.find("img")
    if not image:
        return ""

    src = str(image.get("src", "")).strip()
    return urljoin(BASE_URL, src) if src else ""


def _campaign_type(raw_type: str, subject: str) -> str | None:
    if raw_type == "visit":
        return "방문형"
    if raw_type == "delivery":
        if "페이백" in subject:
            return "페이백"
        return "배송형"
    if raw_type == "doc":
        return "기자단"
    return None


def _deadline_from_gap(
    d_gap: object,
    *,
    now: datetime | None = None,
) -> str | None:
    try:
        days = int(str(d_gap))
    except (TypeError, ValueError):
        return None
    if days < 0:
        return None

    base = (now or datetime.now(SEOUL)).astimezone(SEOUL)
    deadline = (base + timedelta(days=days)).replace(
        hour=23,
        minute=59,
        second=59,
        microsecond=0,
    )
    return deadline.isoformat()


def parse_recommend_item(item: dict) -> Campaign | None:
    source_id = canonical_source_id(str(item.get("href", "")))
    if source_id is None:
        return None

    subject = str(item.get("subject", "")).strip()
    if not subject:
        return None

    content = str(item.get("content", "")).strip()
    raw_type = str(item.get("type", "")).strip()
    channel = str(item.get("channel", "")).strip()

    try:
        apply_count = int(str(item.get("cmp_ask_num", "")).replace(",", ""))
    except ValueError:
        apply_count = None

    try:
        recruit_count = int(str(item.get("cmp_num", "")).replace(",", ""))
    except ValueError:
        recruit_count = None

    point_raw = str(item.get("point", "")).replace(",", "").strip()
    is_points = (
        (point_raw.isdigit() and int(point_raw) > 0)
        or "포인트" in content
    )

    media_map = {
        "Blog": "블로그",
        "Instagram": "인스타그램",
        "Youtube": "유튜브",
        "YouTube": "유튜브",
    }

    region = extract_region_from_title(subject)

    return Campaign(
        platform="강남맛집",
        source_campaign_id=source_id,
        title=subject,
        link=f"{BASE_URL}/cp/?id={source_id}",
        image_url=_image_url(str(item.get("img", ""))),
        media_type=media_map.get(channel, channel or None),
        reward=content,
        is_points=is_points,
        apply_count=apply_count,
        recruit_count=recruit_count,
        region=region,
        campaign_type=_campaign_type(raw_type, subject),
        deadline_at=_deadline_from_gap(item.get("d_gap")),
    )


def fetch_recommendation_sample(
    session: requests.Session,
) -> list[Campaign]:
    response = session.get(RECOMMEND_URL, timeout=(8, 20))
    response.raise_for_status()

    payload = response.json()
    items = payload.get("items", []) if isinstance(payload, dict) else []
    campaigns: list[Campaign] = []

    for item in items:
        if not isinstance(item, dict):
            continue
        campaign = parse_recommend_item(item)
        if campaign is not None:
            campaigns.append(campaign)

    return campaigns


def parse_list_page(
    html: str, *, now: datetime | None = None,
) -> tuple[list[Campaign], bool]:
    """Parse the public infinite-scroll fragment, including its end marker."""
    soup = BeautifulSoup(html, "html.parser")
    cards = soup.select("li.list_item")
    end = soup.select_one("li.list-no-item")
    if not cards:
        if end and end.get_text(strip=True) == "조회된 캠페인이 없습니다.":
            return [], True
        raise RuntimeError("강남맛집 목록 구조가 변경됐거나 빈 응답입니다.")
    if end:
        raise RuntimeError("강남맛집 목록과 종료 마커가 동시에 반환됐습니다.")

    campaigns = []
    media_map = {"Blog": "블로그", "Instagram": "인스타그램",
                 "Youtube": "유튜브", "YouTube": "유튜브", "Clip": "숏폼"}
    for card in cards:
        anchor = card.select_one(".tit a")
        source_id = canonical_source_id(str(anchor.get("href", ""))) if anchor else None
        title = anchor.get_text(" ", strip=True) if anchor else ""
        if not source_id or not title or str(card.get("data-product", "")) != source_id:
            raise RuntimeError("강남맛집 캠페인 ID/제목 계약이 변경됐습니다.")
        reward_node = card.select_one(".sub_tit")
        type_node = card.select_one("em.type")
        label = card.select_one(".label")
        media = []
        if label:
            for node in label.select("em:not(.type):not(.day_c)"):
                text = node.get_text(strip=True)
                if text in media_map:
                    media.append(media_map[text])
        media = list(dict.fromkeys(media))
        # Multiple media labels do not establish whether all channels are required.
        media_type = media[0] if len(media) == 1 else None
        count_node = card.select_one(".numb")
        counts = count_node.get_text(" ", strip=True) if count_node else ""
        apply_match = re.search(r"신청\s*([\d,]+)", counts)
        recruit_match = re.search(r"모집\s*([\d,]+)", counts)
        day_node = card.select_one(".dday")
        days = day_node.get_text(" ", strip=True) if day_node else ""
        # Today's badge is a sibling em outside .dday in real list fragments.
        if not days and label and "오늘마감" in label.get_text(strip=True):
            days = "오늘마감"
        day_match = re.fullmatch(r"(\d+)일\s*남음", days)
        if days in {"오늘 마감", "오늘마감", "마감임박"}:
            # '마감임박' alone has no exact day count.
            day_match = None
        gap = int(day_match[1]) if day_match else (0 if days in {"오늘 마감", "오늘마감"} else None)
        region = extract_region_from_title(title)
        raw_type = type_node.get_text(strip=True) if type_node else ""
        campaign_type = normalize_campaign_type(raw_type, title=title, region=region)
        if not region and campaign_type in {"배송형", "페이백"}:
            region = "배송"
        reward = reward_node.get_text(" ", strip=True) if reward_node else ""
        campaigns.append(Campaign(
            platform="강남맛집", source_campaign_id=source_id,
            title=title, link=f"{BASE_URL}/cp/?id={source_id}",
            # No third-party image copying/hosting; the product is text-first.
            media_type=media_type, reward=reward, is_points="포인트" in reward,
            apply_count=int(apply_match[1].replace(",", "")) if apply_match else None,
            recruit_count=int(recruit_match[1].replace(",", "")) if recruit_match else None,
            region=region, campaign_type=campaign_type,
            deadline_at=_deadline_from_gap(gap, now=now) if gap is not None else None,
        ))
    return campaigns, False


def collect_all(
    session: requests.Session, *, max_pages: int = 400,
    sleep_between: bool = True, now: datetime | None = None,
) -> list[Campaign]:
    if not 1 <= max_pages <= 400:
        raise ValueError("max_pages must be between 1 and 400")
    observed_at = now or datetime.now(SEOUL)
    campaigns: dict[str, Campaign] = {}

    def fetch_fragment(page: int) -> str:
        response = session.get(
            LIST_URL, params={
                "rpage": page, "row_num": PAGE_SIZE,
                "sst": "wr_datetime", "sod": "desc",
            }, timeout=(8, 20),
        )
        response.raise_for_status()
        return response.text

    for page in range(max_pages):
        html = fetch_fragment(page)
        # The site's own JS accepts both an explicit no-item marker and an
        # empty successful response. Confirm a blank tail with the next page
        # so one empty response in the middle cannot truncate the catalogue.
        if not html.strip():
            if not campaigns:
                raise RuntimeError("강남맛집 첫 페이지가 빈 응답입니다.")
            if sleep_between:
                time.sleep(1)
            confirmation = fetch_fragment(page + 1)
            if confirmation.strip():
                _, confirmed_end = parse_list_page(confirmation, now=observed_at)
                if not confirmed_end:
                    raise RuntimeError("강남맛집 중간 페이지가 비어 있어 저장하지 않습니다.")
            print(f"강남맛집 빈 마지막 페이지 확인 page={page}, 고유 {len(campaigns)}개", flush=True)
            return list(campaigns.values())
        rows, is_last = parse_list_page(html, now=observed_at)
        if is_last:
            if not campaigns:
                raise RuntimeError("강남맛집 첫 페이지에 캠페인이 없습니다.")
            print(f"강남맛집 종료 page={page}, 고유 {len(campaigns)}개", flush=True)
            return list(campaigns.values())
        ids = [row.source_campaign_id for row in rows]
        if len(set(ids)) != len(ids):
            raise RuntimeError("강남맛집 한 페이지에 중복 ID가 있습니다.")
        new_rows = [row for row in rows if row.source_campaign_id not in campaigns]
        if not new_rows:
            raise RuntimeError("강남맛집 페이지가 반복되어 수집을 중단합니다.")
        for row in new_rows:
            campaigns[row.source_campaign_id] = row
        print(f"강남맛집 page={page}: {len(rows)}개, 신규 {len(new_rows)}개, 누적 {len(campaigns)}개", flush=True)
        if sleep_between:
            time.sleep(1)
    raise RuntimeError(f"강남맛집 목록이 max_pages={max_pages} 안에 종료되지 않았습니다. 저장하지 않습니다.")


def get_gangnam_data(*, dry_run: bool = True, max_pages: int = 400) -> list[Campaign]:
    with build_session() as session:
        campaigns = collect_all(session, max_pages=max_pages)
    if dry_run:
        print(f"강남맛집 dry-run 완료: {len(campaigns)}개. DB 저장 없음.")
        return campaigns
    # An explicit write flag does not override the independently reviewed registry.
    with get_database_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                select 1 from platform_sources
                 where name = '강남맛집' and status = 'active'
                   and collection_enabled = true
            """)
            if cursor.fetchone() is None:
                raise RuntimeError("강남맛집 source registry 활성화 검토가 필요합니다. 저장하지 않습니다.")
        saved = upsert_campaigns(connection, campaigns)
    print(f"강남맛집 {saved}개 DB 동기화 완료")
    return campaigns


def collect_gangnam_production() -> None:
    get_gangnam_data(dry_run=False)


def main() -> None:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--dry-run",
        action="store_true",
        help="공개 목록을 검증하고 DB에는 저장하지 않습니다(기본값).",
    )
    mode.add_argument("--write", action="store_true", help="active registry 검토 후 DB 저장")
    parser.add_argument("--max-pages", type=int, default=400)
    args = parser.parse_args()
    get_gangnam_data(dry_run=not args.write, max_pages=args.max_pages)


if __name__ == "__main__":
    main()
