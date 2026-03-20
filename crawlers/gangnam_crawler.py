import os
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv

# 1. .env 파일 로드
load_dotenv()

# 환경 변수에서 값 가져오기
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")

# Supabase 클라이언트 생성
supabase: Client = create_client(url, key)

def get_gangnam_data():
    # 실제 접속 테스트를 위해 메인 주소 사용
    target_url = "https://xn--939au0g4vj8sq.net/" 
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    }
    
    try:
        response = requests.get(target_url, headers=headers)
        print(f"사이트 응답 코드: {response.status_code}")
        
        # 2. DB 저장 테스트 데이터 (id, created_at 제외)
        # 💡 중요: DB에서 'Default Value'와 'Identity' 설정이 되어있어야 합니다.
        test_data = {
            "platform": "강남맛집",
            "title": ".env 연결 성공 테스트!",
            "link": target_url,
            "media_type": "블로그",
            "is_points": False
        }
        
        # 3. 데이터 삽입 실행
        result = supabase.table("campaigns").insert(test_data).execute()
        print("🎉 축하합니다! DB 저장에 성공했습니다.")
        print(result)
        
    except Exception as e:
        print(f"❌ 작업 중 에러 발생: {e}")

if __name__ == "__main__":
    get_gangnam_data()