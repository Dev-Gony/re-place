"""Initial public ReviewNote HTML listing for a personal portfolio, not full API coverage."""
import argparse
import json
import re
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup

from common import Campaign, get_database_connection, upsert_campaigns

URL = "https://www.reviewnote.co.kr/campaigns"
PLATFORM = "리뷰노트(공개목록)"
MAX_BYTES = 4 * 1024 * 1024
TYPES = {"VISIT": "방문형", "DELIVERY": "배송형", "TAKEOUT": "포장",
         "PAYBACK": "페이백", "REPORTER": "기자단", "ETC": "기타"}


def parse_listing(html: str, *, now: datetime | None = None) -> list[Campaign]:
    tag = BeautifulSoup(html, "html.parser").find("script", id="__NEXT_DATA__")
    if tag is None or not tag.string:
        raise ValueError("리뷰노트 공개 목록 데이터가 없습니다.")
    payload = json.loads(tag.string)
    data = payload["props"]["pageProps"]["data"]
    rows = data.get("objects")
    # Static snapshot metadata is NOT pagination authority (observed has_more=true).
    if not isinstance(rows, list) or not 1 <= len(rows) <= 1000:
        raise ValueError("리뷰노트 공개 목록 범위가 변경됐습니다.")
    observed = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    seen, campaigns = set(), []
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("리뷰노트 공개 목록 항목 계약 변경.")
        source_id = row.get("id")
        if type(source_id) is not int or source_id <= 0 or source_id in seen:
            raise ValueError("리뷰노트 원문 ID 누락/중복.")
        seen.add(source_id)
        if row.get("channel") not in {"BLOG", "BLOG_CLIP"}:
            continue
        title, reward, raw_due = row.get("title"), row.get("offer"), row.get("applyEndAt")
        if not isinstance(title, str) or not 1 <= len(title.strip()) <= 2048:
            raise ValueError("리뷰노트 제목 계약 변경.")
        if not isinstance(reward, str) or len(reward) > 12000:
            raise ValueError("리뷰노트 제공 내역 계약 변경.")
        if not isinstance(raw_due, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})", raw_due):
            raise ValueError("리뷰노트 신청 마감일/시간대 누락.")
        due = datetime.fromisoformat(raw_due.replace("Z", "+00:00"))
        if row.get("status") not in {"SELECT", "PROGRESS"} or row.get("sort") not in TYPES:
            raise ValueError("리뷰노트 목록 상태/유형 계약 변경.")
        # Public detail UI enables PAYBACK at PROGRESS and other kinds at SELECT.
        expected_status = "PROGRESS" if row["sort"] == "PAYBACK" else "SELECT"
        if row["status"] != expected_status:
            continue
        if due < observed:
            continue
        counts = [row.get(k) for k in ("applicantCount", "infNum", "infPoint")]
        if any(type(n) is not int or n < 0 for n in counts):
            raise ValueError("리뷰노트 모집 인원/포인트 계약 변경.")
        city, sido = row.get("city"), row.get("sido", {}).get("name")
        if not isinstance(city, str) or not isinstance(sido, str):
            raise ValueError("리뷰노트 지역 계약 변경.")
        region = "배송" if city == "재택" else "/".join(dict.fromkeys([sido, city]))
        campaigns.append(Campaign(
            platform=PLATFORM, source_campaign_id=str(source_id),
            title=f"[{sido}/{city}] {title.strip()}" if sido != city else f"[{city}] {title.strip()}",
            link=f"https://www.reviewnote.co.kr/campaigns/{source_id}",
            media_type="블로그" if row["channel"] == "BLOG" else "블로그+숏폼",
            campaign_type=TYPES[row["sort"]], region=region or None,
            reward=reward.strip(), is_points=counts[2] > 0, points_amount=counts[2],
            apply_count=counts[0], recruit_count=counts[1],
            deadline_at=due.isoformat(), collected_at=observed.isoformat(),
        ))
    if not campaigns:
        raise ValueError("공개 초기 목록에 마감 전 블로그 캠페인이 없습니다. 저장하지 않습니다.")
    print(f"리뷰노트 공개 초기 목록 {len(rows)}건 → 마감 전 블로그 포함 {len(campaigns)}건", flush=True)
    return campaigns


def collect() -> list[Campaign]:
    with requests.get(URL, headers={"User-Agent": "RePlace/1.0 (+https://re-place.devgony.com/)"},
                      timeout=(8, 25), stream=True, allow_redirects=False) as response:
        if response.status_code != 200:
            response.raise_for_status()
            raise RuntimeError("리뷰노트 공개 HTML 응답 변경.")
        body = bytearray()
        for chunk in response.iter_content(chunk_size=65536):
            body.extend(chunk)
            if len(body) > MAX_BYTES:
                raise ValueError("리뷰노트 공개 HTML 크기 제한 초과.")
    return parse_listing(body.decode("utf-8"))


def get_reviewnote_public_data(*, dry_run: bool = True) -> list[Campaign]:
    campaigns = collect()
    if dry_run:
        print(f"리뷰노트 공개목록 dry-run {len(campaigns)}건. DB 저장 없음.", flush=True)
        return campaigns
    with get_database_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""select 1 from platform_sources where slug='reviewnote-public-list'
                and name=%s and status='active' and collection_enabled=true""", (PLATFORM,))
            if cursor.fetchone() is None:
                raise RuntimeError("리뷰노트 공개목록 registry 미활성. 저장하지 않습니다.")
        saved = upsert_campaigns(connection, campaigns)
    print(f"리뷰노트 공개목록 {saved}건 DB 동기화 완료", flush=True)
    return campaigns


def collect_reviewnote_public_production() -> None:
    get_reviewnote_public_data(dry_run=False)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--write", action="store_true")
    get_reviewnote_public_data(dry_run=not parser.parse_args().write)
