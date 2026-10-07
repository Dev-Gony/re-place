"""Blog campaigns from Inflexer's public UI APIs; not an official REVU feed.

Coverage is the configured regional searches, 11 product categories and press
listing. It is not asserted to equal REVU's complete catalogue.
"""
import argparse
import json
import re
import time
from datetime import date, datetime, time as day_time, timezone
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from common import Campaign, extract_region_from_title, get_database_connection, upsert_campaigns

API_BASE = "https://inflexer.net:5000"
PLATFORM = "레뷰(인플렉서)"
MAX_BYTES = 2 * 1024 * 1024
MAX_REQUESTS = 128
SEOUL = ZoneInfo("Asia/Seoul")
CATEGORIES = ("FD_", "BT_", "CL_", "HG_", "LF_", "HB_", "IT_", "CA_", "PA_", "PT_", "ET_")
REGIONS = (
    "서울", "경기", "인천", "부산", "대구", "대전", "광주", "울산", "세종",
    "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
    "강원도", "강원특별자치도", "충청북도", "충청남도", "전라북도",
    "전북특별자치도", "전라남도", "경상북도", "경상남도",
)
SUBREGIONS = {
    "서울": (
        "종로", "중구", "용산", "성동", "광진", "동대문", "중랑", "성북", "강북",
        "도봉", "노원", "은평", "서대문", "마포", "양천", "강서", "구로", "금천",
        "영등포", "동작", "관악", "서초", "강남", "송파", "강동",
    ),
    "경기": (
        "수원", "성남", "의정부", "안양", "부천", "광명", "평택", "동두천", "안산",
        "고양", "과천", "구리", "남양주", "오산", "시흥", "군포", "의왕", "하남",
        "용인", "파주", "이천", "안성", "김포", "화성", "광주", "양주", "포천",
        "여주", "연천", "가평", "양평",
    ),
}


class ResultLimitError(RuntimeError):
    """The UI asks users to refine this overly broad search."""


def build_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({
        "User-Agent": "RePlace/1.0 (+https://re-place.devgony.com/)",
        "Accept": "application/json", "Referer": "https://inflexer.net/",
    })
    # 429 is not retried: preserve the old dataset when the provider throttles.
    retry = Retry(total=2, backoff_factor=1, status_forcelist=(502, 503, 504),
                  allowed_methods=frozenset({"GET"}), respect_retry_after_header=False)
    session.mount("https://", HTTPAdapter(max_retries=retry))
    return session


def parse_date(value: object) -> date | None:
    if value is None:
        return None
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError("인플렉서 날짜 계약이 변경됐습니다.")
    return date.fromisoformat(value)


def parse_payload(payload: object, *, observed_at: datetime | None = None) -> list[Campaign]:
    if not isinstance(payload, dict):
        raise ValueError("인플렉서 JSON 객체가 아닙니다.")
    rows, total, valid = payload.get("result"), payload.get("num_result"), payload.get("is_valid")
    if not isinstance(rows, list) or type(total) is not int or total < 0 or type(valid) is not bool:
        raise ValueError("인플렉서 응답 계약이 변경됐습니다.")
    if not valid:
        if total > 0 and not rows:
            raise ResultLimitError(f"인플렉서 검색 결과 제한: {total}건")
        raise ValueError("인플렉서 검색 제한/오류 응답입니다.")
    if total != len(rows) or total > 5000:
        raise ValueError("인플렉서 결과 개수 불일치/잘림입니다.")
    observed = (observed_at or datetime.now(timezone.utc)).astimezone(timezone.utc).isoformat()
    campaigns = []
    seen = set()
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get("domain"), str):
            raise ValueError("인플렉서 결과 항목이 변경됐습니다.")
        # Never import other providers, including the blocked ReviewNote source.
        if row["domain"] != "레뷰":
            continue
        link, title = row.get("url"), row.get("title")
        if not isinstance(link, str) or not isinstance(title, str) or not 1 <= len(title.strip()) <= 2048:
            raise ValueError("레뷰 원문 링크/제목이 없습니다.")
        parsed = urlparse(link)
        match = re.fullmatch(r"/campaign/([1-9]\d*)", parsed.path)
        if parsed.scheme != "https" or parsed.netloc != "www.revu.net" or not match or parsed.query or parsed.fragment:
            raise ValueError("레뷰 원문 호스트/ID 계약이 변경됐습니다.")
        source_id = match[1]
        if source_id in seen:
            raise ValueError("인플렉서 한 응답에 중복 레뷰 ID가 있습니다.")
        seen.add(source_id)
        start = parse_date(row.get("apl_stt_dt"))
        due = parse_date(row.get("apl_due_dt"))
        parse_date(row.get("pub_due_dt"))  # Review due date is NOT application due.
        if start and due and start > due:
            raise ValueError("레뷰 신청 날짜 순서가 잘못됐습니다.")
        if row.get("media") != "BP_":
            raise ValueError("블로그 조회에 예상하지 못한 매체가 반환됐습니다.")
        types = {"VST": "방문형", "SHP": "배송형", "PRS": "기자단"}
        if row.get("type") not in types or row.get("point") not in {None, "O", "X"}:
            raise ValueError("레뷰 유형/포인트 코드가 변경됐습니다.")
        reward = row.get("offer")
        if reward is None:
            reward = ""
        if not isinstance(reward, str) or len(reward) > 12000:
            raise ValueError("레뷰 제공 내역 계약이 변경됐습니다.")
        kind = types[row["type"]]
        region = extract_region_from_title(title)
        if kind == "배송형" and not region:
            region = "배송"
        campaigns.append(Campaign(
            platform=PLATFORM, source_campaign_id=source_id, title=title.strip(),
            link=f"https://www.revu.net/campaign/{source_id}",
            media_type="블로그", campaign_type=kind, region=region,
            reward=reward.strip(), is_points=row.get("point") == "O" or "포인트" in reward,
            deadline_at=datetime.combine(due, day_time(23, 59, 59), SEOUL).isoformat() if due else None,
            # Counts and original collection time are absent in this feed.
            apply_count=None, recruit_count=None, collected_at=observed,
        ))
    return campaigns


def request_rows(session: requests.Session, endpoint: str, params: dict) -> list[Campaign]:
    if endpoint not in {"search", "shipping", "press"}:
        raise ValueError("공개 읽기 endpoint만 허용합니다.")
    with session.get(f"{API_BASE}/{endpoint}", params=params, timeout=(8, 25),
                     stream=True, allow_redirects=False) as response:
        if response.status_code != 200:
            response.raise_for_status()
            raise RuntimeError("인플렉서가 예상하지 못한 HTTP 응답을 반환했습니다.")
        body = bytearray()
        for chunk in response.iter_content(chunk_size=65536):
            body.extend(chunk)
            if len(body) > MAX_BYTES:
                raise ValueError("인플렉서 응답 크기 제한을 초과했습니다.")
    return parse_payload(json.loads(body))


def collect(session: requests.Session, *, sleep_between: bool = True) -> list[Campaign]:
    campaigns: dict[str, Campaign] = {}
    requests_made = 0

    def fetch(endpoint: str, **filters) -> list[Campaign]:
        nonlocal requests_made
        if requests_made >= MAX_REQUESTS:
            raise RuntimeError("인플렉서 최대 요청 수 초과. 저장하지 않습니다.")
        if requests_made and sleep_between:
            time.sleep(1)
        requests_made += 1
        params = {"media": "BP_", "target": "TOTAL", **filters}
        if endpoint != "press":
            params["point"] = ["O", "X"]
        rows = request_rows(session, endpoint, params)
        for row in rows:
            campaigns[row.source_campaign_id] = row
        scope = filters.get("query", filters.get("category", "기자단"))
        print(f"인플렉서 {endpoint}/{scope}: 레뷰 {len(rows)}건, 고유 누적 {len(campaigns)}건", flush=True)
        return rows

    for region in REGIONS:
        try:
            fetch("search", query=region, type="VST")
        except ResultLimitError:
            children = SUBREGIONS.get(region)
            if not children:
                raise RuntimeError(f"인플렉서 {region} 검색 제한을 해소하지 못했습니다. 저장하지 않습니다.")
            for child in children:
                # The public UI explicitly asks for a more specific keyword.
                # Do not accept partial rows or invent pagination parameters.
                fetch("search", query=f"{region} {child}", type="VST")
    for category in CATEGORIES:
        fetch("shipping", category=category, type="SHP")
    fetch("press", type="PRS")
    if not campaigns:
        raise RuntimeError("인플렉서 레뷰 조회 범위가 모두 비었습니다. 저장하지 않습니다.")
    print(f"인플렉서 공개 블로그 조회 범위 완료: {requests_made}요청, 레뷰 고유 {len(campaigns)}건", flush=True)
    return list(campaigns.values())


def get_inflexer_revu_data(*, dry_run: bool = True) -> list[Campaign]:
    with build_session() as session:
        campaigns = collect(session)
    if dry_run:
        print(f"레뷰(인플렉서) dry-run {len(campaigns)}건. DB 저장 없음.")
        return campaigns
    with get_database_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                select 1 from platform_sources where slug='revu-inflexer'
                 and name=%s and status='active' and collection_enabled=true
            """, (PLATFORM,))
            if cursor.fetchone() is None:
                raise RuntimeError("레뷰(인플렉서) registry 미활성. 저장하지 않습니다.")
        saved = upsert_campaigns(connection, campaigns)
    print(f"레뷰(인플렉서) {saved}건 DB 동기화 완료", flush=True)
    return campaigns


def collect_inflexer_revu_production() -> None:
    get_inflexer_revu_data(dry_run=False)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="공개 조회만 실행 (기본)")
    mode.add_argument("--write", action="store_true", help="활성 registry 확인 후 DB 저장")
    get_inflexer_revu_data(dry_run=not parser.parse_args().write)
