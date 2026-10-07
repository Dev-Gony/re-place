"""Anonymous ReviewNote public BLOG/BLOG_CLIP listing, including all public pages."""
import argparse
import json
import re
import time
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup

from common import Campaign, get_database_connection, upsert_campaigns

URL = "https://www.reviewnote.co.kr/campaigns"
API_URL = "https://www.reviewnote.co.kr/api/v2/campaigns"
PLATFORM = "리뷰노트(공개목록)"
MAX_BYTES = 4 * 1024 * 1024
MAX_PAGES = 1500
# Larger limits affect only page zero; subsequent pages always return 16.
# Keep the UI's page size so offsets and coverage are consistent.
PAGE_SIZE = 16
REQUEST_INTERVAL = 0.25
CHANNELS = ("BLOG", "BLOG_CLIP")
HEADERS = {"User-Agent": "RePlace/1.0 (+https://re-place.devgony.com/)",
           "Accept": "application/json", "Origin": "https://www.reviewnote.co.kr"}
TYPES = {"VISIT": "방문형", "DELIVERY": "배송형", "TAKEOUT": "구매형",
         "PAYBACK": "페이백", "REPORTER": "기자단", "ETC": "포장",
         "PLATFORM_REPORTER": "기자단", "TODAY": "당일지급"}
STATUSES = {"SELECT", "PROGRESS", "COMPLETE", "CANCELED", "REJECT", "REVIEW"}


def parse_listing(html: str, *, now: datetime | None = None) -> list[Campaign]:
    tag = BeautifulSoup(html, "html.parser").find("script", id="__NEXT_DATA__")
    if tag is None or not tag.string:
        raise ValueError("리뷰노트 공개 목록 데이터가 없습니다.")
    payload = json.loads(tag.string)
    data = payload["props"]["pageProps"]["data"]
    rows = data.get("objects")
    if not isinstance(rows, list) or not 1 <= len(rows) <= 1000:
        raise ValueError("리뷰노트 공개 목록 범위가 변경됐습니다.")
    return parse_rows(rows, now=now)


def parse_rows(rows: list[dict], *, now: datetime | None = None) -> list[Campaign]:
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
        if row.get("status") not in STATUSES or row.get("sort") not in TYPES:
            raise ValueError("리뷰노트 목록 상태/유형 계약 변경.")
        # Public list bundle's RP helper permits PAYBACK at SELECT or PROGRESS;
        # other kinds must be SELECT. Complete/canceled/review states are closed.
        allowed_statuses = {"SELECT", "PROGRESS"} if row["sort"] == "PAYBACK" else {"SELECT"}
        if row["status"] not in allowed_statuses:
            continue
        if due < observed:
            continue
        counts = [row.get(k) for k in ("applicantCount", "infNum", "infPoint")]
        if any(type(n) is not int or n < 0 for n in counts):
            raise ValueError("리뷰노트 모집 인원/포인트 계약 변경.")
        district = row.get("sido")
        city, sido = row.get("city"), district.get("name") if isinstance(district, dict) else None
        if not isinstance(city, str) or not isinstance(sido, str):
            raise ValueError("리뷰노트 지역 계약 변경.")
        # Despite the field name, sido.name is the district; city is the province.
        region = "배송" if city == "재택" else "/".join(dict.fromkeys([city, sido]))
        campaigns.append(Campaign(
            platform=PLATFORM, source_campaign_id=str(source_id),
            title=f"[{city}/{sido}] {title.strip()}" if sido != city else f"[{city}] {title.strip()}",
            link=f"https://www.reviewnote.co.kr/campaigns/{source_id}",
            media_type="블로그" if row["channel"] == "BLOG" else "블로그+숏폼",
            campaign_type=TYPES[row["sort"]], region=region or None,
            reward=reward.strip(), is_points=counts[2] > 0, points_amount=counts[2],
            apply_count=counts[0], recruit_count=counts[1],
            deadline_at=due.isoformat(), collected_at=observed.isoformat(),
        ))
    if not campaigns:
        raise ValueError("공개 목록에 마감 전 블로그 캠페인이 없습니다. 저장하지 않습니다.")
    print(f"리뷰노트 공개 목록 고유 {len(rows)}건 → 마감 전 블로그 포함 {len(campaigns)}건", flush=True)
    return campaigns


def fetch_page(channel: str, page: int) -> dict:
    headers = {**HEADERS, "Referer": f"{URL}?channel={channel}"}
    params = {"channel": channel, "gugunSelected": "", "s": "default",
              "coord": "", "limit": PAGE_SIZE, "page": page}
    with requests.get(API_URL, headers=headers, params=params,
                      timeout=(8, 25), stream=True, allow_redirects=False) as response:
        if response.status_code != 200:
            response.raise_for_status()
            raise RuntimeError("리뷰노트 공개 목록 API 응답 변경.")
        body = bytearray()
        for chunk in response.iter_content(chunk_size=65536):
            body.extend(chunk)
            if len(body) > MAX_BYTES:
                raise ValueError("리뷰노트 공개 목록 응답 크기 제한 초과.")
    return json.loads(body.decode("utf-8"))


def collect() -> list[Campaign]:
    rows_by_id = {}
    requests_count = 0
    for channel in CHANNELS:
        scope_ids, page_signatures = set(), set()
        for page in range(MAX_PAGES):
            if requests_count:
                time.sleep(REQUEST_INTERVAL)
            payload = fetch_page(channel, page)
            requests_count += 1
            if (not isinstance(payload, dict) or type(payload.get("page")) is not int
                    or payload["page"] != page or type(payload.get("has_more")) is not bool):
                raise ValueError("리뷰노트 페이지/종료 계약 변경. 저장하지 않습니다.")
            rows = payload.get("objects")
            if not isinstance(rows, list) or len(rows) > PAGE_SIZE or (not rows and payload["has_more"]):
                raise ValueError("리뷰노트 페이지 항목 계약 변경. 저장하지 않습니다.")
            ids = []
            for row in rows:
                if (not isinstance(row, dict) or type(row.get("id")) is not int
                        or row["id"] <= 0 or row.get("channel") != channel):
                    raise ValueError("리뷰노트 페이지 ID/매체 계약 변경. 저장하지 않습니다.")
                ids.append(row["id"])
            signature = tuple(sorted(ids))
            if len(ids) != len(set(ids)) or (rows and signature in page_signatures):
                raise ValueError("리뷰노트 중복/반복 페이지. 저장하지 않습니다.")
            page_signatures.add(signature)
            scope_ids.update(ids)
            # Offset listings can shift while new campaigns are published. Deduplicate
            # overlaps, retaining the latest observed metadata for the original ID.
            rows_by_id.update((row["id"], row) for row in rows)
            if page and page % 20 == 0:
                print(f"리뷰노트 {channel}: {page + 1}페이지, 고유 {len(scope_ids)}건 조회 중", flush=True)
            if not payload["has_more"]:
                if not scope_ids:
                    raise ValueError("리뷰노트 매체 목록이 비었습니다. 저장하지 않습니다.")
                print(f"리뷰노트 {channel}: {page + 1}페이지, 고유 {len(scope_ids)}건 완료", flush=True)
                break
        else:
            raise ValueError("리뷰노트 최대 페이지 초과. 부분 목록을 저장하지 않습니다.")
    # total_count is the current page length; total_pages grows page by page.
    # Only has_more=false proves termination, not either of these metadata fields.
    print(f"리뷰노트 공개 조회 {requests_count}요청 완료", flush=True)
    return parse_rows(list(rows_by_id.values()))


def get_reviewnote_public_data(*, dry_run: bool = True) -> list[Campaign]:
    campaigns = collect()
    if dry_run:
        print(f"리뷰노트 공개목록 dry-run {len(campaigns)}건. DB 저장 없음.", flush=True)
        return campaigns
    save_campaigns(campaigns)
    return campaigns


def save_campaigns(campaigns: list[Campaign]) -> None:
    """Reuse matching legacy row IDs, then atomically refresh the public snapshot."""
    if not campaigns:
        raise ValueError("빈 리뷰노트 snapshot을 저장하지 않습니다.")
    with get_database_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""select 1 from platform_sources where slug='reviewnote-public-list'
                and name=%s and status='active' and collection_enabled=true""", (PLATFORM,))
            if cursor.fetchone() is None:
                raise RuntimeError("리뷰노트 공개목록 registry 미활성. 저장하지 않습니다.")
            # campaigns.link is globally unique. The old blocked source can own
            # the very same original campaign. Preserve its row ID and personal
            # references; promote only IDs actually observed in this full cycle.
            # This update and the common upsert share one transaction/commit.
            cursor.execute("""update campaigns as legacy
                set platform=%s, source_campaign_id=incoming.source_id
                from unnest(%s::text[], %s::text[]) as incoming(source_id, link)
                where legacy.platform='리뷰노트' and legacy.link=incoming.link""",
                (PLATFORM, [c.source_campaign_id for c in campaigns], [c.link for c in campaigns]))
        saved = upsert_campaigns(connection, campaigns)
    print(f"리뷰노트 공개목록 {saved}건 DB 동기화 완료", flush=True)


def collect_reviewnote_public_production() -> None:
    get_reviewnote_public_data(dry_run=False)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--write", action="store_true")
    get_reviewnote_public_data(dry_run=not parser.parse_args().write)
