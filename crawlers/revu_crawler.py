import os
import random
import time

import requests
from dotenv import load_dotenv

from common import Campaign, get_supabase_client, upsert_campaigns


load_dotenv()
REVU_TOKEN = os.getenv("REVU_BEARER_TOKEN")


def get_revu_data():
    api_url = "https://api.weble.net/v1/campaigns"
    headers = {
        "Authorization": f"Bearer {REVU_TOKEN}",
        "Origin": "https://www.revu.net",
        "Referer": "https://www.revu.net/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
    }

    client = get_supabase_client()
    page = 1
    total_saved = 0

    print("레뷰(Revu) 전체 데이터 크롤링을 시작합니다...")

    while True:
        params = {
            "cat": "지역",
            "class": "campaign",
            "type": "play",
            "sort": "latest",
            "page": page,
            "limit": 35,
            "media[]": ["blog", "instagram", "youtube", "clip"],
        }

        print(f"\n[{page}페이지] 데이터를 요청합니다...")

        try:
            response = requests.get(api_url, params=params, headers=headers, timeout=20)

            if response.status_code != 200:
                print(f"API 접근 실패 (상태 코드: {response.status_code})")
                print("토큰이 만료되었거나 서버에서 차단했을 수 있습니다.")
                break

            json_data = response.json()
            items = json_data.get("items", [])
            total_count = json_data.get("total", 0)

            if not items:
                print("더 이상 수집할 데이터가 없습니다. 크롤링을 종료합니다.")
                break

            campaigns: list[Campaign] = []

            for item in items:
                source_id = item.get("id")
                if source_id is None:
                    continue

                media_raw = item.get("media", "")
                media_map = {
                    "blog": "블로그",
                    "instagram": "인스타그램",
                    "youtube": "유튜브",
                    "clip": "숏폼",
                }

                thumb_url = item.get("thumbnail", "")
                if thumb_url:
                    thumb_url = thumb_url.replace("\\/", "/")

                campaigns.append(
                    Campaign(
                        platform="레뷰",
                        source_campaign_id=str(source_id),
                        title=item.get("item", "제목 없음"),
                        link=f"https://www.revu.net/campaign/detail/{source_id}",
                        image_url=thumb_url,
                        media_type=media_map.get(media_raw, media_raw),
                        reward=item.get("campaignData", {}).get("reward", "제공 내역 없음"),
                        apply_count=item.get("campaignStats", {}).get("requestCount", 0),
                        recruit_count=item.get("reviewerLimit", 0),
                    )
                )

            saved = upsert_campaigns(client, campaigns)
            total_saved += saved
            print(
                f"{page}페이지 {saved}개 DB 동기화 완료! "
                f"(누적: {total_saved}/{total_count}개)"
            )

            if page * 35 >= total_count:
                print("\n마지막 페이지에 도달했습니다. 전체 크롤링을 성공적으로 마쳤습니다!")
                break

            page += 1
            sleep_time = random.uniform(1.5, 3.5)
            print(f"차단 방지: 다음 요청 전 {sleep_time:.2f}초 대기 중...")
            time.sleep(sleep_time)

        except Exception as exc:
            print(f"크롤링 중 에러 발생: {exc}")
            break


if __name__ == "__main__":
    get_revu_data()
