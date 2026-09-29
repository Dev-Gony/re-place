import argparse
import re
from collections import deque
from datetime import datetime, timedelta
from urllib.parse import parse_qs, urljoin, urlparse

import requests
from bs4 import BeautifulSoup, Tag
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from common import (
    Campaign,
    extract_region_from_title,
    get_database_connection,
    normalize_campaign_type,
    upsert_campaigns,
)


BASE_URL = "https://gangnam-review.net"
ENTRY_URLS = (
    f"{BASE_URL}/",
    f"{BASE_URL}/business/",
)
MAX_LIST_PAGES = 6
CAMPAIGN_HREF_RE = re.compile(r"/cp/\?id=(\d+)")
COUNT_RE = re.compile(
    r"신청\s*([0-9,]+)\s*(?:/|\||·)?\s*모집\s*([0-9,]+)"
)
DAYS_LEFT_RE = re.compile(r"([0-9]+)\s*일\s*남음")


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
        }
    )
    session.mount("https://", HTTPAdapter(max_retries=retry))
    session.mount("http://", HTTPAdapter(max_retries=retry))
    return session


def canonical_source_id(href: str) -> str | None:
    parsed = urlparse(urljoin(BASE_URL, href))
    if parsed.path.rstrip("/") != "/cp":
        return None

    values = parse_qs(parsed.query).get("id", [])
    if not values or not values[0].isdigit():
        return None

    return values[0]


def _find_campaign_container(anchor: Tag) -> Tag:
    current: Tag | None = anchor
    fallback = anchor

    for _ in range(6):
        parent = current.parent if current else None
        if not isinstance(parent, Tag):
            break

        fallback = parent
        text = parent.get_text(" ", strip=True)
        if "신청" in text and "모집" in text:
            return parent

        current = parent

    return fallback


def _first_text(container: Tag, selectors: tuple[str, ...]) -> str | None:
    for selector in selectors:
        found = container.select_one(selector)
        if found:
            text = found.get_text(" ", strip=True)
            if text:
                return text
    return None


def _extract_title(anchor: Tag, container: Tag) -> str | None:
    title = _first_text(
        container,
        (
            "dt.tit",
            ".tit",
            ".campaign-title",
            ".item-title",
            "h2",
            "h3",
            "h4",
        ),
    )
    if title:
        return title

    anchor_title = anchor.get("title")
    if isinstance(anchor_title, str) and anchor_title.strip():
        return anchor_title.strip()

    text = anchor.get_text(" ", strip=True)
    return text or None


def _extract_reward(container: Tag, title: str) -> str:
    reward = _first_text(
        container,
        (
            "dd.sub_tit",
            ".sub_tit",
            ".reward",
            ".benefit",
            ".campaign-benefit",
        ),
    )
    if reward:
        return reward

    lines = [
        line.strip()
        for line in container.get_text("\n", strip=True).splitlines()
        if line.strip()
    ]
    for line in lines:
        if line == title:
            continue
        if COUNT_RE.search(line):
            continue
        if any(
            marker in line
            for marker in (
                "체험권",
                "상당",
                "제공",
                "포인트",
                "페이백",
                "상품권",
            )
        ):
            return line

    return ""


def _extract_media_type(text: str) -> str:
    lowered = text.lower()
    if "instagram" in lowered or "인스타" in text:
        return "인스타그램"
    if "youtube" in lowered or "유튜브" in text:
        return "유튜브"
    if "clip" in lowered or "클립" in text:
        return "숏폼(클립)"
    return "블로그"


def _deadline_from_text(text: str, *, now: datetime | None = None) -> str | None:
    match = DAYS_LEFT_RE.search(text)
    if not match:
        return None

    base = now or datetime.now().astimezone()
    deadline = (base + timedelta(days=int(match.group(1)))).replace(
        hour=23,
        minute=59,
        second=59,
        microsecond=0,
    )
    return deadline.astimezone().isoformat()


def parse_campaigns(html: str, *, page_url: str = BASE_URL) -> list[Campaign]:
    soup = BeautifulSoup(html, "html.parser")
    campaigns: dict[str, Campaign] = {}

    for anchor in soup.find_all("a", href=True):
        href = str(anchor.get("href", "")).strip()
        source_id = canonical_source_id(href)
        if source_id is None or source_id in campaigns:
            continue

        container = _find_campaign_container(anchor)
        title = _extract_title(anchor, container)
        if not title:
            continue

        text = container.get_text(" ", strip=True)
        count_match = COUNT_RE.search(text)
        apply_count = (
            int(count_match.group(1).replace(",", ""))
            if count_match
            else None
        )
        recruit_count = (
            int(count_match.group(2).replace(",", ""))
            if count_match
            else None
        )

        reward = _extract_reward(container, title)
        region = extract_region_from_title(title)
        campaign_type = normalize_campaign_type(
            text,
            title=f"{title} {reward}",
            region=region,
        )

        img = container.find("img")
        image_url = ""
        if isinstance(img, Tag):
            src = str(img.get("src", "")).strip()
            if src:
                image_url = urljoin(page_url, src)

        campaigns[source_id] = Campaign(
            platform="강남맛집",
            source_campaign_id=source_id,
            title=title,
            link=urljoin(BASE_URL, f"/cp/?id={source_id}"),
            image_url=image_url,
            media_type=_extract_media_type(text),
            reward=reward,
            apply_count=apply_count,
            recruit_count=recruit_count,
            region=region,
            campaign_type=campaign_type,
            deadline_at=_deadline_from_text(text),
        )

    return list(campaigns.values())


def discover_list_pages(html: str, *, page_url: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    found: list[str] = []

    for anchor in soup.find_all("a", href=True):
        href = str(anchor.get("href", "")).strip()
        if not href:
            continue

        absolute = urljoin(page_url, href)
        parsed = urlparse(absolute)
        if parsed.netloc != urlparse(BASE_URL).netloc:
            continue

        lower = absolute.lower()
        if not (
            "page=" in lower
            or "page/" in lower
            or "pageno=" in lower
            or "p=" in parsed.query.lower()
        ):
            continue

        if absolute not in found:
            found.append(absolute)

    return found


def fetch_campaigns(
    session: requests.Session,
    *,
    max_pages: int = MAX_LIST_PAGES,
) -> tuple[list[Campaign], int]:
    queue: deque[str] = deque(ENTRY_URLS)
    visited: set[str] = set()
    campaigns: dict[str, Campaign] = {}
    request_count = 0
    found_primary_source = False

    while queue and request_count < max_pages:
        url = queue.popleft()
        if url in visited:
            continue
        visited.add(url)

        response = session.get(url, timeout=(8, 20))
        request_count += 1
        response.raise_for_status()

        if response.encoding and response.encoding.lower() == "iso-8859-1":
            response.encoding = "utf-8"

        page_campaigns = parse_campaigns(response.text, page_url=response.url)
        if page_campaigns:
            found_primary_source = True
            for campaign in page_campaigns:
                campaigns[campaign.source_campaign_id] = campaign

            for page in discover_list_pages(response.text, page_url=response.url):
                if page not in visited:
                    queue.append(page)

            # ENTRY_URLS contains fallback pages. Once the primary source works,
            # do not fetch another landing page just to collect duplicates.
            queue = deque(
                page
                for page in queue
                if page not in ENTRY_URLS
            )
        elif not found_primary_source:
            continue

    return list(campaigns.values()), request_count


def get_gangnam_data(*, dry_run: bool = False) -> list[Campaign]:
    print("강남맛집 current-domain collector 시작...")

    with build_session() as session:
        campaigns, request_count = fetch_campaigns(session)

    if not campaigns:
        raise RuntimeError(
            "강남맛집 공개 목록에서 캠페인을 찾지 못했습니다. "
            "사이트 구조 또는 접근 정책을 확인해야 합니다."
        )

    print(
        f"HTTP {request_count}회 요청으로 "
        f"{len(campaigns)}개 고유 캠페인을 찾았습니다."
    )

    if dry_run:
        return campaigns

    saved = upsert_campaigns(get_database_connection(), campaigns)
    print(f"{saved}개 캠페인을 DB에 동기화했습니다.")
    return campaigns


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="DB를 쓰지 않고 공개 목록 파싱 결과만 검증합니다.",
    )
    args = parser.parse_args()
    get_gangnam_data(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
