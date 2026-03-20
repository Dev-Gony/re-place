import os
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv

# 1. 환경 변수 및 DB 세팅
load_dotenv()
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(url, key)

def get_gangnam_data():
    base_url = "https://xn--939au0g4vj8sq.net"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    }
    
    print("강남맛집 사이트에 접속 중...")
    response = requests.get(base_url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')
    
    # 찾아오신 HTML 구조를 바탕으로 'list_item' 클래스를 가진 모든 상자를 찾습니다.
    items = soup.find_all('li', class_='list_item')
    print(f"총 {len(items)}개의 캠페인을 찾았습니다. 데이터 추출을 시작합니다.")
    
    extracted_data = []
    
    for item in items:
        # 1. 제목 찾기
        title_tag = item.find('dt', class_='tit')
        if not title_tag:
            continue
        title = title_tag.text.strip()
        
        # 2. 링크 찾기 (부분 주소로 되어 있어서 앞부분을 붙여줍니다)
        a_tag = title_tag.find('a')
        link = base_url + a_tag['href'] if a_tag else ""
        
        # 3. 이미지 주소 찾기 (앞에 https: 를 붙여줍니다)
        img_tag = item.find('img', class_='thumb_img')
        image_url = "https:" + img_tag['src'] if img_tag and img_tag['src'].startswith('//') else ""
        
        # 4. 매체 타입 (블로그, 인스타 등)
        media_tag = item.find('em', class_='blog') or item.find('em', class_='insta')
        media_type = media_tag.text.strip() if media_tag else "블로그"
        
        # 5. 제공 내역 (보상)
        sub_tit_tag = item.find('dd', class_='sub_tit')
        reward = sub_tit_tag.text.strip() if sub_tit_tag else ""
        
        # 6. 신청 및 모집 인원 추출 ("신청 46 / 모집 30" 같은 텍스트를 숫자로 쪼갭니다)
        apply_count, recruit_count = 0, 0
        numb_tag = item.find('span', class_='numb')
        if numb_tag:
            parts = numb_tag.text.split('/')
            if len(parts) == 2:
                # 숫자만 남기기 위해 글자와 공백을 제거합니다.
                apply_str = parts[0].replace('신청', '').strip()
                recruit_str = parts[1].replace('모집', '').strip()
                apply_count = int(apply_str) if apply_str.isdigit() else 0
                recruit_count = int(recruit_str) if recruit_str.isdigit() else 0
                
        # 추출한 1개의 캠페인 데이터를 DB 형식에 맞게 딕셔너리로 만듭니다.
        campaign = {
            "platform": "강남맛집",
            "title": title,
            "link": link,
            "image_url": image_url,
            "media_type": media_type,
            "reward": reward,
            "is_points": False,
            "apply_count": apply_count,
            "recruit_count": recruit_count
        }
        extracted_data.append(campaign)

    # 추출된 데이터를 DB에 한 번에 집어넣습니다.
    if extracted_data:
        try:
            print("데이터베이스에 저장을 시도합니다...")
            result = supabase.table("campaigns").insert(extracted_data).execute()
            print("성공적으로 DB에 저장되었습니다!")
        except Exception as e:
            print(f"DB 저장 중 에러 발생: {e}")
    else:
        print("추출된 데이터가 없습니다.")

if __name__ == "__main__":
    get_gangnam_data()