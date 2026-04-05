import os
import time
import random
import requests
from supabase import create_client, Client
from dotenv import load_dotenv

# 1. 환경 변수 및 DB 세팅
load_dotenv()
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(url, key)

REVU_TOKEN = os.getenv("REVU_BEARER_TOKEN")

def get_revu_data():
    api_url = "https://api.weble.net/v1/campaigns"
    
    headers = {
        "Authorization": f"Bearer {REVU_TOKEN}",
        "Origin": "https://www.revu.net",
        "Referer": "https://www.revu.net/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
    }

    page = 1
    total_saved = 0 # 누적 저장 개수 카운트

    print("🚀 레뷰(Revu) 전체 데이터 크롤링을 시작합니다...")

    # 무한 루프 시작 (페이지 끝에 도달할 때까지 반복)
    while True:
        params = {
            "cat": "지역",
            "class": "campaign",
            "type": "play",
            "sort": "latest",
            "page": page,
            "limit": 35,
            "media[]": ["blog", "instagram", "youtube", "clip"]
        }
        
        print(f"\n[{page}페이지] 데이터를 요청합니다...")
        
        try:
            response = requests.get(api_url, params=params, headers=headers)
            
            if response.status_code != 200:
                print(f"❌ API 접근 실패 (상태 코드: {response.status_code})")
                print("토큰이 만료되었거나 서버에서 차단했을 수 있습니다.")
                break

            json_data = response.json()
            items = json_data.get("items", [])
            total_count = json_data.get("total", 0) # API가 알려주는 전체 캠페인 수
            
            # 페이지에 더 이상 아이템이 없으면 루프 탈출
            if not items:
                print("더 이상 수집할 데이터가 없습니다. 크롤링을 종료합니다.")
                break
            
            extracted_data = []
            
            for item in items:
                media_raw = item.get("media", "")
                media_map = {"blog": "블로그", "instagram": "인스타그램", "youtube": "유튜브", "clip": "숏폼"}
                media_type = media_map.get(media_raw, media_raw)
                
                thumb_url = item.get("thumbnail", "")
                if thumb_url:
                    thumb_url = thumb_url.replace("\\/", "/")

                campaign = {
                    "platform": "레뷰",
                    "title": item.get("item", "제목 없음"),
                    "link": f"https://www.revu.net/campaign/detail/{item.get('id')}",
                    "image_url": thumb_url,
                    "media_type": media_type,
                    "reward": item.get("campaignData", {}).get("reward", "제공 내역 없음"),
                    "is_points": False,
                    "apply_count": item.get("campaignStats", {}).get("requestCount", 0),
                    "recruit_count": item.get("reviewerLimit", 0)
                }
                extracted_data.append(campaign)

            if extracted_data:
                # DB 저장
                supabase.table("campaigns").insert(extracted_data).execute()
                total_saved += len(extracted_data)
                print(f"✅ {page}페이지 {len(extracted_data)}개 DB 저장 완료! (누적: {total_saved}/{total_count}개)")

            # 다음 페이지로 가기 전에, 전체 개수를 다 채웠는지 검사
            if page * 35 >= total_count:
                print("\n마지막 페이지에 도달했습니다. 전체 크롤링을 성공적으로 마쳤습니다!")
                break
            
            page += 1 # 페이지 번호 1 증가
            
            # 🚨 봇 차단(IP 밴) 방지를 위한 랜덤 딜레이 (1.5초 ~ 3.5초 사이)
            sleep_time = random.uniform(1.5, 3.5)
            print(f"차단 방지: 다음 요청 전 {sleep_time:.2f}초 대기 중...")
            time.sleep(sleep_time)

        except Exception as e:
            print(f"크롤링 중 에러 발생: {e}")
            break

if __name__ == "__main__":
    get_revu_data()