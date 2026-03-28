import os
import requests
from supabase import create_client, Client
from dotenv import load_dotenv

# 1. 환경 변수 및 DB 세팅
load_dotenv()
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(url, key)

REVU_TOKEN = os.getenv("REVU_BEARER_TOKEN")

def get_revu_data(page=1):
    # 실제 레뷰 데이터를 뿌려주는 백엔드 API 주소 (cURL 분석 결과)
    api_url = "https://api.weble.net/v1/campaigns"
    
    # URL 파라미터 세팅
    params = {
        "cat": "지역",
        "class": "campaign",
        "type": "play",
        "sort": "latest",
        "page": page,
        "limit": 35,
        "media[]": ["blog", "instagram", "youtube", "clip"]
    }
    
    # 레뷰 서버를 안심시키는 완벽한 위장 + 인증 헤더
    headers = {
        "Authorization": f"Bearer {REVU_TOKEN}",
        "Origin": "https://www.revu.net",
        "Referer": "https://www.revu.net/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
    }

    print(f"레뷰 API에서 {page}페이지 데이터를 가져오는 중...")
    
    try:
        response = requests.get(api_url, params=params, headers=headers)
        
        # 상태 코드가 200(정상)이 아니면 에러 출력
        if response.status_code != 200:
            print(f"❌ API 접근 실패 (상태 코드: {response.status_code})")
            print("응답 내용:", response.text)
            return

        json_data = response.json()
        items = json_data.get("items", [])
        
        print(f"총 {len(items)}개의 캠페인을 찾았습니다. 데이터 파싱을 시작합니다.")
        
        extracted_data = []
        
        for item in items:
            media_raw = item.get("media", "")
            media_map = {"blog": "블로그", "instagram": "인스타그램", "youtube": "유튜브", "clip": "숏폼"}
            media_type = media_map.get(media_raw, media_raw)
            
            # 썸네일 이미지 URL 정리
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

        # 추출된 데이터를 DB에 저장
        if extracted_data:
            print("데이터베이스에 저장을 시도합니다...")
            result = supabase.table("campaigns").insert(extracted_data).execute()
            print("✅ 성공적으로 레뷰 데이터를 DB에 저장했습니다!")
        else:
            print("추출된 데이터가 없습니다.")

    except Exception as e:
        print(f"크롤링 중 에러 발생: {e}")

if __name__ == "__main__":
    get_revu_data(page=1)