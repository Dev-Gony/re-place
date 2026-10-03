import argparse
import json
import random
import re
import time
from datetime import datetime
from typing import Any
from urllib.parse import urljoin, urlparse
from zoneinfo import ZoneInfo

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from common import (
    Campaign,
    extract_region_from_title,
    normalize_datetime,
    normalize_region_group,
)


BASE_URL = "https://4blog.net"
LIST_URL = f"{BASE_URL}/list/all"
API_URL = f"{BASE_URL}/api/main/list"
CAMPAIGN_RE = re.compile(r"^/campaign/(\d+)/?$")
RECRUIT_RE = re.compile(r"모집\s*([\d,]+)명")
APPLY_RE = re.compile(r"(?:신청|지원)\s*([\d,]+)명?")
PERIOD_RE = re.compile(
    r"모집\s*(\d{2}\.\d{2})\s*[~～-]\s*(\d{2}\.\d{2})"
)
POINT_RE = re.compile(r"([\d,]+)\s*P\b", re.IGNORECASE)
PAGE_LIMIT = 20
MAX_PAGES = 100


def build_session() -> requests.Session:
    retry = Retry(
        total=3,
        connect=3,
        read=2,
        status=2,
        backoff_factor=1.5,
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
            "X-Requested-With": "XMLHttpRequest",
            "Referer": LIST_URL,
        }
    )
    session.mount("https://", HTTPAdapter(max_retries=retry))
    session.mount("http://", HTTPAdapter(max_retries=retry))
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


def _string_values(value: Any):
    if isinstance(value, dict):
        for nested in value.values():
            yield from _string_values(nested)
    elif isinstance(value, list):
        for nested in value:
            yield from _string_values(nested)
    elif isinstance(value, (str, int, float)):
        text = str(value).strip()
        if text:
            yield text


def _first_text(item: dict[str, Any], keys: tuple[str, ...]) -> str:
    for key in keys:
        value = item.get(key)
        if isinstance(value, (str, int, float)):
            text = str(value).strip()
            if text:
                return text
    return ""


def _first_int(item: dict[str, Any], keys: tuple[str, ...]) -> int | None:
    for key in keys:
        value = item.get(key)
        if isinstance(value, bool):
            continue
        if isinstance(value, int):
            return value
        if isinstance(value, float) and value.is_integer():
            return int(value)
        if isinstance(value, str):
            cleaned = value.replace(",", "").strip()
            if cleaned.isdigit():
                return int(cleaned)
    return None


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
    if "기자단" in source or "포스팅" in source:
        return "기자단"
    if "배송형" in source or "[제품" in title or "[배송" in title:
        return "배송형"
    if "방문형" in source:
        return "방문형"
    return None


def parse_region(
    title: str,
    campaign_type: str | None,
    raw_region: str = "",
) -> str | None:
    if campaign_type in {"배송형", "페이백"}:
        return "배송"
    if campaign_type == "기자단":
        return "전국"

    if raw_region:
        cleaned = raw_region.replace("/", " ").strip()
        if normalize_region_group(cleaned):
            return cleaned

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


def _deadline_from_item(item: dict[str, Any], text: str) -> str | None:
    for key in (
        "deadline_at",
        "deadline",
        "end_at",
        "end_date",
        "recruit_end",
        "recruit_end_at",
    ):
        parsed = normalize_datetime(item.get(key))
        if parsed:
            return parsed
    return parse_deadline(text)


def parse_api_item(item: dict[str, Any]) -> Campaign | None:
    if not isinstance(item, dict):
        return None

    href = _first_text(
        item,
        ("url", "link", "campaign_url", "href", "detail_url"),
    )
    link_data = parse_campaign_link(href)
    if link_data is None:
        return None
    source_id, link = link_data

    title = _first_text(
        item,
        ("title", "subject", "campaign_title", "name"),
    )
    if not title:
        return None

    all_text = " ".join(_string_values(item))
    campaign_type = parse_campaign_type(all_text, title)

    raw_region = _first_text(
        item,
        ("region", "location", "area", "local", "local_name"),
    )
    region = parse_region(title, campaign_type, raw_region)

    recruit_count = _first_int(
        item,
        (
            "recruit_count",
            "recruit_num",
            "recruit",
            "target_num",
            "member_num",
            "people",
        ),
    )
    if recruit_count is None:
        match = RECRUIT_RE.search(all_text)
        if match:
            recruit_count = int(match.group(1).replace(",", ""))

    apply_count = _first_int(
        item,
        (
            "apply_count",
            "apply_num",
            "applicant_count",
            "volunteer_count",
        ),
    )
    if apply_count is None:
        match = APPLY_RE.search(all_text)
        if match:
            apply_count = int(match.group(1).replace(",", ""))

    reward = _first_text(
        item,
        (
            "payback_info",
            "reward",
            "reward_info",
            "benefit",
            "provide_info",
            "offer",
            "content",
        ),
    )
    period_info = _first_text(
        item,
        ("period_info", "period", "recruit_period"),
    )
    deadline_source = f"{period_info} {all_text}".strip()

    image_url = _first_text(
        item,
        ("thumbnail", "thumbnail_url", "image", "image_url"),
    )
    if image_url:
        image_url = urljoin(BASE_URL, image_url)

    return Campaign(
        platform="포블로그",
        source_campaign_id=source_id,
        title=title,
        link=link,
        image_url=image_url,
        media_type=parse_media_type(all_text),
        reward=reward,
        is_points=bool(POINT_RE.search(all_text)),
        apply_count=apply_count,
        recruit_count=recruit_count,
        region=region,
        campaign_type=campaign_type,
        deadline_at=_deadline_from_item(item, deadline_source),
    )


def _api_form(page: int, offset: int, limit: int) -> dict[str, str | int]:
    return {
        "param": json.dumps(
            {
                "list_type": "all",
                "cate_idx": "",
                "scate_idx": "",
            },
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        "page": page,
        "offset": offset,
        "limit": limit,
    }


def fetch_api_page(
    session: requests.Session,
    *,
    page: int,
    offset: int,
    limit: int = PAGE_LIMIT,
) -> tuple[int, list[dict[str, Any]]]:
    response = session.post(
        API_URL,
        data=_api_form(page, offset, limit),
        timeout=(10, 30),
    )
    response.raise_for_status()

    try:
        payload = response.json()
    except ValueError as exc:
        raise RuntimeError("포블로그 목록 API가 JSON을 반환하지 않았습니다.") from exc

    if not isinstance(payload, dict):
        raise RuntimeError("포블로그 목록 API 응답이 객체가 아닙니다.")

    raw_count = payload.get("count")
    try:
        count = int(str(raw_count).replace(",", ""))
    except (TypeError, ValueError) as exc:
        raise RuntimeError("포블로그 목록 API count가 올바르지 않습니다.") from exc

    raw_items = payload.get("list")
    if not isinstance(raw_items, list):
        raise RuntimeError("포블로그 목록 API list가 배열이 아닙니다.")

    items = [item for item in raw_items if isinstance(item, dict)]
    if len(items) != len(raw_items):
        raise RuntimeError("포블로그 목록 API list에 비객체 항목이 있습니다.")

    return count, items


def collect_api_catalogue(
    session: requests.Session,
    *,
    limit: int = PAGE_LIMIT,
    max_pages: int = MAX_PAGES,
    sleep_between: bool = True,
) -> list[Campaign]:
    page = 1
    offset = 0
    expected_count: int | None = None
    campaigns: dict[str, Campaign] = {}
    raw_seen = 0
    parse_failures = 0

    while page <= max_pages:
        count, items = fetch_api_page(
            session,
            page=page,
            offset=offset,
            limit=limit,
        )
        if count < 0:
            raise RuntimeError("포블로그 목록 API count가 음수입니다.")

        if expected_count is None:
            expected_count = count
        else:
            expected_count = max(expected_count, count)

        if not items:
            if offset < count:
                raise RuntimeError(
                    "포블로그 목록 API가 전체 count 도달 전에 빈 페이지를 반환했습니다."
                )
            break

        for item in items:
            raw_seen += 1
            campaign = parse_api_item(item)
            if campaign is None:
                parse_failures += 1
                continue
            campaigns[campaign.source_campaign_id] = campaign

        offset += len(items)
        print(
            f"포블로그 API {page}페이지: {len(items)}개, "
            f"offset {offset}/{count}, 고유 {len(campaigns)}개"
        )

        if offset >= count:
            break

        page += 1
        if sleep_between:
            time.sleep(random.uniform(0.25, 0.45))
    else:
        raise RuntimeError(
            f"포블로그 목록 API가 max_pages={max_pages} 안에 종료되지 않았습니다."
        )

    if expected_count is None or expected_count == 0:
        raise RuntimeError("포블로그 목록 API에 모집중 캠페인이 없습니다.")

    if raw_seen < expected_count:
        raise RuntimeError(
            "포블로그 목록 API 전체 count보다 적은 항목만 확인했습니다: "
            f"{raw_seen}/{expected_count}"
        )

    if not campaigns:
        raise RuntimeError("포블로그 API 응답에서 유효한 캠페인을 파싱하지 못했습니다.")

    parse_ratio = len(campaigns) / raw_seen
    if parse_ratio < 0.90:
        raise RuntimeError(
            "포블로그 API 파싱 성공률이 90% 미만입니다: "
            f"{len(campaigns)}/{raw_seen}"
        )

    if parse_failures:
        print(f"[WARN] 포블로그 API 파싱 제외: {parse_failures}개")

    return list(campaigns.values())


def get_poblog_data(*, dry_run: bool = False) -> list[Campaign]:
    """
    Traverse the same public API contract used by 4blog's infinite scroll.

    The API contract is now identified, but production DB writes remain
    intentionally blocked until a live dry-run confirms catalogue size and
    representative field accuracy.
    """
    with build_session() as session:
        warmup = session.get(LIST_URL, timeout=(10, 30))
        warmup.raise_for_status()
        campaigns = collect_api_catalogue(session)

    print(f"포블로그 전체 API dry-run: 고유 {len(campaigns)}개 확인")

    if not dry_run:
        raise RuntimeError(
            "포블로그 전체 API 계약은 구현됐지만 live dry-run 승인 전이라 "
            "production 저장을 차단합니다."
        )

    return campaigns


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="공개 전체 목록 API를 순회하고 DB에는 저장하지 않습니다.",
    )
    args = parser.parse_args()
    get_poblog_data(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
