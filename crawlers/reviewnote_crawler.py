import os
import time
import random
import json
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv

# 1. 환경 변수 및 DB 세팅
load_dotenv()
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(url, key)

def get_reviewnote_data():
    print("🚀 리뷰노트(ReviewNote) 크롤링을 시작합니다...")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
    }

    # 1. 동적 Build ID 추출을 위한 첫 페이지 접근
    main_url = "https://www.reviewnote.co.kr/campaigns"
    response = requests.get(main_url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')
    
    # HTML 최하단에 숨겨진 Next.js 데이터 덩어리 찾기
    next_data_tag = soup.find('script', id='__NEXT_DATA__')
    if not next_data_tag:
        print("❌ Next.js 동적 데이터를 찾을 수 없습니다. 사이트 구조가 변경되었을 수 있습니다.")
        return
        
    next_data = json.loads(next_data_tag.string)
    build_id = next_data.get('buildId')
    print(f"✅ 동적 Build ID 추출 완료: {build_id}")

    # 리뷰노트는 데이터 구조상 page가 0부터 시작함
    page = 0 
    total_saved = 0

    while True:
        # 2. 알아낸 Build ID를 활용해 숨겨진 API(JSON) 호출
        api_url = f"https://www.reviewnote.co.kr/_next/data/{build_id}/campaigns.json"
        
        # 일반/프리미엄 모두 가져오기 위해 필수 파라미터 제외하고 page만 넘김 (필요시 isPremium 파라미터 추가 가능)
        params = {
            "page": page
        }
        
        print(f"\n[{page+1}페이지] 데이터를 요청합니다...")
        
        try:
            res = requests.get(api_url, params=params, headers=headers)
            
            if res.status_code != 200:
                print(f"❌ API 접근 실패 (상태 코드: {res.status_code})")
                break
                
            data = res.json()
            page_props = data.get("pageProps", {}).get("data", {})
            items = page_props.get("objects", [])
            total_pages = page_props.get("total_pages", 1) # 전체 페이지 수
            
            if not items:
                print("더 이상 수집할 데이터가 없습니다.")
                break
                
            extracted_data = []
            
            for item in items:
                # 매체 이름 한글화
                channel = item.get("channel", "")
                media_map = {
                    "BLOG": "블로그",
                    "INSTAGRAM": "인스타그램",
                    "REELS": "숏폼(릴스)",
                    "BLOG_CLIP": "블로그+숏폼",
                    "YOUTUBE": "유튜브"
                }
                media_type = media_map.get(channel, channel)
                
                # 이미지 주소 가공 (S3 버킷 등을 사용하는 경우를 대비한 기본 포맷)
                # TODO: 프론트엔드에서 이미지가 깨진다면 'https://reviewnote.co.kr' 처럼 원본 CDN 주소 확인 필요
                image_key = item.get("imageKey", "")
                image_url = f"https://reviewnote-image.s3.ap-northeast-2.amazonaws.com/{image_key}" if image_key else ""
                
                campaign = {
                    "platform": "리뷰노트",
                    "title": item.get("title", "제목 없음"),
                    "link": f"https://www.reviewnote.co.kr/campaigns/{item.get('id')}", 
                    "image_url": image_url,
                    "media_type": media_type,
                    "reward": item.get("offer", "제공 내역 없음"),
                    "is_points": item.get("infPoint", 0) > 0, # 포인트 제공 여부
                    "apply_count": item.get("applicantCount", 0),
                    "recruit_count": item.get("infNum", 0)
                }
                extracted_data.append(campaign)
                
            if extracted_data:
                # Supabase DB 적재
                supabase.table("campaigns").insert(extracted_data).execute()
                total_saved += len(extracted_data)
                print(f"✅ {page+1}페이지 {len(extracted_data)}개 DB 저장 완료! (누적: {total_saved}개 / 전체 {total_pages}페이지)")
                
            # 마지막 페이지 도달 확인
            if page >= total_pages - 1:
                print("\n마지막 페이지에 도달했습니다. 전체 크롤링을 성공적으로 마쳤습니다!")
                break
                
            page += 1 # 리뷰노트 페이지 인덱스 증가
            
            # 차단 방지를 위한 랜덤 딜레이
            sleep_time = random.uniform(1.5, 3.5)
            print(f"차단 방지: 다음 요청 전 {sleep_time:.2f}초 대기 중...")
            time.sleep(sleep_time)
            
        except Exception as e:
            print(f"크롤링 중 에러 발생: {e}")
            break

if __name__ == "__main__":
    get_reviewnote_data() # 주의: 함수 이름이 get_reviewnote_data 이면 아래도 동일하게 변경해야함
    # 올바른 실행 함수 호출
    # get_reviewnote_data()