import json
import random
import time

import requests
from bs4 import BeautifulSoup

from common import (
    Campaign,
    extract_region_from_title,
    first_datetime,
    first_text,
    get_supabase_client,
    nested_datetime,
    nested_text,
    normalize_campaign_type,
    upsert_campaigns,
)


def get_reviewnote_data():
    print("리뷰노트(ReviewNote) 크롤링을 시작합니다...")
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
    }

    main_url = "https://www.reviewnote.co.kr/campaigns"
    response = requests.get(main_url, headers=headers, timeout=20)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    next_data_tag = soup.find("script", id="__NEXT_DATA__")
    if not next_data_tag:
        raise RuntimeError("리뷰노트 Build ID를 찾을 수 없습니다.")

    next_data = json.loads(next_data_tag.string)
    build_id = next_data.get("buildId")
    if not build_id:
        raise RuntimeError("리뷰노트 Build ID가 비어 있습니다.")

    print(f"동적 Build ID 추출 완료: {build_id}")

    client = get_supabase_client()
    page = 0
    total_saved = 0

    while True:
        api_url = f"https://www.reviewnote.co.kr/_next/data/{build_id}/campaigns.json"
        params = {"page": page}

        print(f"\n[{page + 1}페이지] 데이터를 요청합니다...")
        res = requests.get(api_url, params=params, headers=headers, timeout=20)
        res.raise_for_status()

        data = res.json()
        page_props = data.get("pageProps", {}).get("data", {})
        items = page_props.get("objects", [])
        total_pages = page_props.get("total_pages", 1)

        if not items:
            if page == 0:
                raise RuntimeError("리뷰노트에서 수집할 캠페인을 찾지 못했습니다.")
            print("더 이상 수집할 데이터가 없습니다.")
            break

        campaigns: list[Campaign] = []

        for item in items:
            source_id = item.get("id")
            if source_id is None:
                continue

            title = item.get("title", "제목 없음")
            channel = item.get("channel", "")
            media_map = {
                "BLOG": "블로그",
                "INSTAGRAM": "인스타그램",
                "REELS": "숏폼(릴스)",
                "BLOG_CLIP": "블로그+숏폼",
                "YOUTUBE": "유튜브",
            }

            image_key = item.get("imageKey", "")
            image_url = ""
            if image_key:
                encoded_key = image_key.replace("/", "%2F")
                image_url = f"https://firebasestorage.googleapis.com/v0/b/reviewnote-e92d9.appspot.com/o/{encoded_key}?alt=media"

            region = first_text(
                item,
                ("region", "area", "location", "district", "sigungu", "address"),
            ) or nested_text(
                item,
                (
                    ("region", "name"),
                    ("area", "name"),
                    ("location", "name"),
                    ("address", "region"),
                ),
            )
            if not region:
                region = extract_region_from_title(title)

            raw_campaign_type = first_text(
                item,
                ("campaignType", "campaign_type", "visitType", "visit_type", "type"),
            ) or nested_text(
                item,
                (("campaign", "type"), ("category", "type")),
            )
            campaign_type = normalize_campaign_type(
                raw_campaign_type,
                title=title,
                region=region,
            )

            deadline_at = first_datetime(
                item,
                (
                    "recruitEndAt",
                    "recruit_end_at",
                    "applyEndAt",
                    "apply_end_at",
                    "deadlineAt",
                    "deadline_at",
                    "endAt",
                    "end_at",
                    "deadline",
                ),
            ) or nested_datetime(
                item,
                (
                    ("campaign", "recruitEndAt"),
                    ("campaign", "deadlineAt"),
                    ("schedule", "applyEndAt"),
                    ("schedule", "endAt"),
                ),
            )

            campaigns.append(
                Campaign(
                    platform="리뷰노트",
                    source_campaign_id=str(source_id),
                    title=title,
                    link=f"https://www.reviewnote.co.kr/campaigns/{source_id}",
                    image_url=image_url,
                    media_type=media_map.get(channel, channel),
                    reward=item.get("offer", "제공 내역 없음"),
                    is_points=item.get("infPoint", 0) > 0,
                    apply_count=item.get("applicantCount", 0),
                    recruit_count=item.get("infNum", 0),
                    region=region,
                    campaign_type=campaign_type,
                    deadline_at=deadline_at,
                )
            )

        saved = upsert_campaigns(client, campaigns)
        total_saved += saved
        print(
            f"{page + 1}페이지 {saved}개 DB 동기화 완료! "
            f"(누적: {total_saved}개 / 전체 {total_pages}페이지)"
        )

        if page >= total_pages - 1:
            print("\n마지막 페이지에 도달했습니다. 전체 크롤링을 마칩니다!")
            break

        page += 1
        time.sleep(random.uniform(1.5, 3.0))


if __name__ == "__main__":
    get_reviewnote_data()
