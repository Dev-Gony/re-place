import random
import re
import time
from datetime import datetime
from urllib.parse import urljoin, urlparse
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup

from common import (
    Campaign,
    extract_region_from_title,
    get_supabase_client,
    normalize_campaign_type,
    upsert_campaigns,
)


BASE_URL = "https://dinnerqueen.net"
LIST_URL = f"{BASE_URL}/taste?ct=%EC%A0%84%EC%B2%B4"
CAMPAIGN_PATH_RE = re.compile(r"^/taste/(\d+)$")
APPLY_RE = re.compile(r"신청\s*([\d,]+)\s*/\s*모집\s*([\d,]+)")
DETAIL_APPLY_RE = re.compile(r"([\d,]+)\s*/\s*([\d,]+)명")
PERIOD_RE = re.compile(
    r"(\d{2}\.\d{2}\.\d{2})\s*[–~-]\s*(\d{2}\.\d{2}\.\d{2})"
)

SKIP_LABELS = {
    "★",
    "배송",
    "맛집",
    "지역",
    "여가",
    "뷰티",
    "페이백",
    "기자단",
    "릴스",
    "클립",
    "랜덤픽",
    "프리미엄",
}


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


def find_card(anchor):
    for parent in anchor.parents:
        if not getattr(parent, "stripped_strings", None):
            continue

        text = " ".join(parent.stripped_strings)
        if APPLY_RE.search(text):
            return parent

        if len(text) > 1800:
            break

    return anchor.parent


def extract_title(card, source_id: str) -> str | None:
    for same_link in card.find_all("a", href=True):
        parsed = urlparse(urljoin(BASE_URL, same_link.get("href", "")))
        match = CAMPAIGN_PATH_RE.match(parsed.path)
        if not match or match.group(1) != source_id:
            continue

        text = " ".join(same_link.stripped_strings).strip()
        if text and len(text) <= 180:
            return text

    parts = [part.strip() for part in card.stripped_strings if part.strip()]
    apply_index = next(
        (index for index, part in enumerate(parts) if APPLY_RE.search(part)),
        len(parts),
    )

    for part in reversed(parts[:apply_index]):
        if part in SKIP_LABELS:
            continue
        if re.fullmatch(r"D(?:-\d+|'day)", part, flags=re.IGNORECASE):
            continue
        if part.startswith("신청 "):
            continue
        if len(part) < 2:
            continue
        return part

    return None


def extract_listing_campaigns(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    results: list[dict] = []
    seen_ids: set[str] = set()

    for anchor in soup.find_all("a", href=True):
        href = anchor.get("href", "").strip()
        parsed = urlparse(urljoin(BASE_URL, href))
        match = CAMPAIGN_PATH_RE.match(parsed.path)
        if not match:
            continue

        source_id = match.group(1)
        if source_id in seen_ids:
            continue

        card = find_card(anchor)
        if card is None:
            continue

        card_text = " ".join(card.stripped_strings)
        apply_match = APPLY_RE.search(card_text)
        if not apply_match:
            continue

        title = extract_title(card, source_id)
        if not title:
            continue

        apply_count = int(apply_match.group(1).replace(",", ""))
        recruit_count = int(apply_match.group(2).replace(",", ""))

        media_type = "블로그"
        if "릴스" in card_text:
            media_type = "숏폼(릴스)"
        elif "클립" in card_text:
            media_type = "숏폼"
        elif "인스타그램" in card_text or "인스타" in card_text:
            media_type = "인스타그램"

        raw_type = None
        if "배송" in card_text:
            raw_type = "배송"
        elif "페이백" in card_text:
            raw_type = "페이백"
        elif any(token in card_text for token in ("맛집", "지역", "여가", "뷰티")):
            raw_type = "방문"

        region = extract_region_from_title(title)

        results.append(
            {
                "source_id": source_id,
                "title": title,
                "link": f"{BASE_URL}/taste/{source_id}",
                "media_type": media_type,
                "campaign_type": normalize_campaign_type(
                    raw_type,
                    title=title,
                    region=region,
                ),
                "region": region,
                "apply_count": apply_count,
                "recruit_count": recruit_count,
            }
        )
        seen_ids.add(source_id)

    return results


def parse_deadline(text: str) -> str | None:
    match = PERIOD_RE.search(text)
    if not match:
        return None

    try:
        end_date = datetime.strptime(match.group(2), "%y.%m.%d")
    except ValueError:
        return None

    seoul = ZoneInfo("Asia/Seoul")
    end_of_day = end_date.replace(
        hour=23,
        minute=59,
        second=59,
        tzinfo=seoul,
    )
    return end_of_day.isoformat()


def extract_reward(parts: list[str]) -> str:
    try:
        start = parts.index("제공 내역") + 1
    except ValueError:
        return ""

    stop_labels = {
        "참여 전 필수 확인사항",
        "매장 정보 링크",
        "방문 및 예약",
        "블로그 키워드",
        "리뷰어 미션",
    }

    reward_parts: list[str] = []
    for part in parts[start:]:
        if part in stop_labels:
            break
        if part.lower().startswith("qz-collapse"):
            continue
        if part:
            reward_parts.append(part)

    return " ".join(reward_parts).strip()


def enrich_from_detail(
    session: requests.Session,
    item: dict,
) -> tuple[str, str | None]:
    response = session.get(item["link"], timeout=(10, 25))
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    parts = [part.strip() for part in soup.stripped_strings if part.strip()]
    text = " ".join(parts)

    reward = extract_reward(parts)
    deadline_at = parse_deadline(text)

    detail_count = DETAIL_APPLY_RE.search(text)
    if detail_count:
        item["apply_count"] = int(detail_count.group(1).replace(",", ""))
        item["recruit_count"] = int(detail_count.group(2).replace(",", ""))

    return reward, deadline_at


def get_dinnerqueen_data():
    print("디너의여왕(DinnerQueen) 크롤링을 시작합니다...")

    with build_session() as session:
        response = session.get(LIST_URL, timeout=(10, 30))
        response.raise_for_status()

        listing = extract_listing_campaigns(response.text)
        if not listing:
            raise RuntimeError("디너의여왕 캠페인 목록을 파싱하지 못했습니다.")

        print(f"목록에서 {len(listing)}개 캠페인을 찾았습니다.")

        campaigns: list[Campaign] = []
        detail_failures = 0

        for index, item in enumerate(listing, start=1):
            reward = ""
            deadline_at = None

            try:
                reward, deadline_at = enrich_from_detail(session, item)
            except Exception as exc:
                detail_failures += 1
                print(
                    f"[WARN] 상세 보강 실패 {item['source_id']}: {exc}"
                )

            campaigns.append(
                Campaign(
                    platform="디너의여왕",
                    source_campaign_id=item["source_id"],
                    title=item["title"],
                    link=item["link"],
                    media_type=item["media_type"],
                    reward=reward,
                    is_points="포인트" in reward,
                    apply_count=item["apply_count"],
                    recruit_count=item["recruit_count"],
                    region=item["region"],
                    campaign_type=item["campaign_type"],
                    deadline_at=deadline_at,
                )
            )

            if index < len(listing):
                time.sleep(random.uniform(0.6, 1.0))

    saved = upsert_campaigns(get_supabase_client(), campaigns)
    print(
        f"디너의여왕 {saved}개 캠페인 DB 동기화 완료 "
        f"(상세 보강 실패: {detail_failures}개)"
    )


if __name__ == "__main__":
    get_dinnerqueen_data()
