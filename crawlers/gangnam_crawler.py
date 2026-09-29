import argparse
from datetime import datetime, timedelta
from urllib.parse import parse_qs, urljoin, urlparse
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from common import Campaign, extract_region_from_title


BASE_URL = "https://gangnam-review.net"
RECOMMEND_URL = f"{BASE_URL}/index_recommend.php"
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
    if parsed.netloc != urlparse(BASE_URL).netloc:
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


def get_gangnam_data(*, dry_run: bool = False) -> list[Campaign]:
    """
    Validate the current public Gangnam-review JSON contract.

    The verified endpoint exposes only 10 recommendation campaigns and is not
    a complete catalogue. Until a stable full-list endpoint is confirmed,
    production DB writes are intentionally blocked to prevent partial coverage
    from being mistaken for a complete source integration.
    """
    with build_session() as session:
        campaigns = fetch_recommendation_sample(session)

    if not campaigns:
        raise RuntimeError(
            "강남맛집 공개 JSON에서 캠페인을 찾지 못했습니다. "
            "endpoint 구조를 다시 확인해야 합니다."
        )

    print(
        "강남맛집 공개 JSON probe 성공: "
        f"{len(campaigns)}개 추천 캠페인 확인"
    )

    if not dry_run:
        raise RuntimeError(
            "강남맛집은 전체 목록 endpoint가 아직 확인되지 않아 "
            "production 저장을 차단합니다."
        )

    return campaigns


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="추천 JSON 계약만 검증하고 DB에는 저장하지 않습니다.",
    )
    args = parser.parse_args()
    get_gangnam_data(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
