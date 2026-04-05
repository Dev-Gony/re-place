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

    # 1. Build ID 추출
    main_url = "https://www.reviewnote.co.kr/campaigns"
    response = requests.get(main_url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')
    
    next_data_tag = soup.find('script', id='__NEXT_DATA__')
    if not next_data_tag:
        print("❌ Build ID를 찾을 수 없습니다. (사이트 구조 변경 의심)")
        return
        
    next_data = json.loads(next_data_tag.string)
    build_id = next_data.get('buildId')
    print(f"✅ 동적 Build ID 추출 완료: {build_id}")

    page = 0
    total_saved = 0

    while True:
        api_url = f"https://www.reviewnote.co.kr/_next/data/{build_id}/campaigns.json"
        params = {"page": page}
        
        print(f"\n[{page+1}페이지] 데이터를 요청합니다...")
        res = requests.get(api_url, params=params, headers=headers)
        
        if res.status_code != 200:
            print(f"❌ API 접근 실패 (상태 코드: {res.status_code})")
            break
            
        data = res.json()
        page_props = data.get("pageProps", {}).get("data", {})
        items = page_props.get("objects", [])
        total_pages = page_props.get("total_pages", 1)
        
        if not items:
            print("더 이상 수집할 데이터가 없습니다.")
            break
            
        extracted_data = []
        
        for item in items:
            channel = item.get("channel", "")
            media_map = {
                "BLOG": "블로그", "INSTAGRAM": "인스타그램", 
                "REELS": "숏폼(릴스)", "BLOG_CLIP": "블로그+숏폼", "YOUTUBE": "유튜브"
            }
            media_type = media_map.get(channel, channel)
            
            # 파이어베이스 이미지 주소 원복 (슬래시 인코딩)
            image_key = item.get("imageKey", "")
            if image_key:
                encoded_key = image_key.replace("/", "%2F")
                image_url = f"https://firebasestorage.googleapis.com/v0/b/reviewnote-e92d9.appspot.com/o/{encoded_key}?alt=media"
            else:
                image_url = ""
                
            campaign = {
                "platform": "리뷰노트",
                "title": item.get("title", "제목 없음"),
                "link": f"https://www.reviewnote.co.kr/campaigns/{item.get('id')}", 
                "image_url": image_url,
                "media_type": media_type,
                "reward": item.get("offer", "제공 내역 없음"),
                "is_points": item.get("infPoint", 0) > 0,
                "apply_count": item.get("applicantCount", 0),
                "recruit_count": item.get("infNum", 0)
            }
            extracted_data.append(campaign)
            
        if extracted_data:
            try:
                # DB 저장 시도 (에러 발생 시 터미널에 명확히 출력)
                supabase.table("campaigns").insert(extracted_data).execute()
                total_saved += len(extracted_data)
                print(f"✅ {page+1}페이지 {len(extracted_data)}개 DB 저장 완료! (누적: {total_saved}개 / 전체 {total_pages}페이지)")
            except Exception as db_error:
                print(f"❌ DB 저장 실패! (이유: {db_error})")
            
        if page >= total_pages - 1:
            print("\n마지막 페이지에 도달했습니다. 전체 크롤링을 마칩니다!")
            break
            
        page += 1
        time.sleep(random.uniform(1.5, 3.0))

if __name__ == "__main__":
    get_reviewnote_data()