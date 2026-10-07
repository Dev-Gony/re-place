"""Bounded public search evidence. This tool never opens a database connection.

Inflexer's search API is a second-hand source, not an official REVU feed.
RPL-045 adds a separately scoped production adapter. This diagnostic remains
DB-free; user authorization is not recorded as verified rights-holder permission.
"""
import argparse
import json
import re
from datetime import date, datetime, timezone
from urllib.parse import parse_qs, urlparse

import requests

SEARCH_URL = "https://inflexer.net:5000/search"
MAX_BYTES = 2 * 1024 * 1024


def validate_query(query: str) -> str:
    query = query.strip()
    if not 2 <= len(query) <= 80:
        raise ValueError("query must contain 2 to 80 characters")
    return query


def parse_payload(payload: object, *, query: str) -> dict:
    if not isinstance(payload, dict) or payload.get("is_valid") is not True:
        raise ValueError("인플렉서 결과가 제한되거나 계약이 변경됐습니다. 전체 목록으로 사용하지 않습니다.")
    rows = payload.get("result")
    total = payload.get("num_result")
    if not isinstance(rows, list) or type(total) is not int or total != len(rows):
        raise ValueError("인플렉서 결과 개수/응답 구조가 일치하지 않습니다.")
    evidence = []
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("검색 결과가 객체가 아닙니다.")
        platform = row.get("domain")
        if platform not in {"레뷰", "강남맛집"}:
            continue
        url = row.get("url")
        if not isinstance(url, str):
            raise ValueError("원문 링크가 없습니다.")
        parsed = urlparse(url)
        if parsed.scheme != "https":
            raise ValueError("예상하지 못한 원문 링크입니다.")
        if platform == "레뷰":
            match = re.fullmatch(r"/campaign/(\d+)", parsed.path)
            source_id = match[1] if match and parsed.netloc == "www.revu.net" else None
        else:
            source_id = parse_qs(parsed.query).get("id", [None])[0]
            if parsed.netloc not in {"gangnam-review.net", "xn--939au0g4vj8sq.net", "강남맛집.net"} or parsed.path.rstrip("/") != "/cp":
                source_id = None
            if source_id and not source_id.isdigit():
                source_id = None
        if not source_id or not isinstance(row.get("title"), str) or not row["title"].strip():
            raise ValueError("검색 결과 원문 ID/제목을 검증할 수 없습니다.")
        for field in ("apl_stt_dt", "apl_due_dt", "pub_due_dt"):
            value = row.get(field)
            if value is not None:
                if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
                    raise ValueError("검색 결과 날짜 계약이 변경됐습니다.")
                date.fromisoformat(value)
        evidence.append({
            "platform": platform, "source_campaign_id": source_id,
            "title": row["title"].strip(), "link": url,
            "reward": row.get("offer"), "media_code": row.get("media"),
            "type_code": row.get("type"), "point_code": row.get("point"),
            "application_start_date": row.get("apl_stt_dt"),
            "application_end_date": row.get("apl_due_dt"),
            "review_end_date": row.get("pub_due_dt"),
            "apply_count": None, "recruit_count": None,
            "upstream_collected_at": None,
        })
    return {
        "provider": "inflexer", "endpoint": SEARCH_URL,
        "query": query, "scope": "keyword-search-sample",
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "total_search_results": total, "target_results": len(evidence),
        "production_reuse_verified": False, "items": evidence,
    }


def probe(query: str) -> dict:
    query = validate_query(query)
    with requests.get(SEARCH_URL, params={
        "query": query, "media": "BP_", "type": ["VST", "SHP"], "target": "TOTAL",
    }, timeout=(8, 20), stream=True) as response:
        response.raise_for_status()
        body = bytearray()
        for chunk in response.iter_content(chunk_size=65536):
            body.extend(chunk)
            if len(body) > MAX_BYTES:
                raise ValueError("검색 표본 응답이 크기 제한을 초과했습니다.")
    return parse_payload(json.loads(body), query=query)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--query", required=True, help="단일 검색어; 전체 목록 수집 기능 없음")
    args = parser.parse_args()
    print(json.dumps(probe(args.query), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
