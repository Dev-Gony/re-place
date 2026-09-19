import os
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(url, key)


def get_gangnam_data():
    base_url = "https://xn--939au0g4vj8sq.net"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    }

    print("강남맛집 사이트에 접속 중...")
    response = requests.get(base_url, headers=headers, timeout=20)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    items = soup.find_all("li", class_="list_item")
    print(f"총 {len(items)}개의 캠페인을 찾았습니다. 데이터 추출을 시작합니다.")

    extracted_data = []

    for item in items:
        title_tag = item.find("dt", class_="tit")
        if not title_tag:
            continue

        title = title_tag.text.strip()
        a_tag = title_tag.find("a")
        href = a_tag.get("href", "").strip() if a_tag else ""
        if not href:
            continue

        link = base_url + href if href.startswith("/") else href
        source_campaign_id = href

        img_tag = item.find("img", class_="thumb_img")
        image_url = "https:" + img_tag["src"] if img_tag and img_tag.get("src", "").startswith("//") else ""

        media_tag = item.find("em", class_="blog") or item.find("em", class_="insta")
        media_type = media_tag.text.strip() if media_tag else "블로그"

        sub_tit_tag = item.find("dd", class_="sub_tit")
        reward = sub_tit_tag.text.strip() if sub_tit_tag else ""

        apply_count, recruit_count = 0, 0
        numb_tag = item.find("span", class_="numb")
        if numb_tag:
            parts = numb_tag.text.split("/")
            if len(parts) == 2:
                apply_str = parts[0].replace("신청", "").strip()
                recruit_str = parts[1].replace("모집", "").strip()
                apply_count = int(apply_str) if apply_str.isdigit() else 0
                recruit_count = int(recruit_str) if recruit_str.isdigit() else 0

        extracted_data.append(
            {
                "platform": "강남맛집",
                "source_campaign_id": source_campaign_id,
                "title": title,
                "link": link,
                "image_url": image_url,
                "media_type": media_type,
                "reward": reward,
                "is_points": False,
                "apply_count": apply_count,
                "recruit_count": recruit_count,
            }
        )

    if extracted_data:
        try:
            print("데이터베이스에 저장을 시도합니다...")
            supabase.table("campaigns").upsert(
                extracted_data,
                on_conflict="platform,source_campaign_id",
            ).execute()
            print("성공적으로 DB에 저장되었습니다!")
        except Exception as e:
            print(f"DB 저장 중 에러 발생: {e}")
    else:
        print("추출된 데이터가 없습니다.")


if __name__ == "__main__":
    get_gangnam_data()
