import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from common import (
    Campaign,
    extract_region_from_title,
    get_database_connection,
    normalize_campaign_type,
    upsert_campaigns,
)


def build_session() -> requests.Session:
    retry = Retry(
        total=3,
        connect=3,
        read=2,
        status=2,
        backoff_factor=2,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset({"GET"}),
    )
    session = requests.Session()
    session.mount("https://", HTTPAdapter(max_retries=retry))
    session.mount("http://", HTTPAdapter(max_retries=retry))
    return session


def get_gangnam_data():
    base_url = "https://xn--939au0g4vj8sq.net"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    }

    print("강남맛집 사이트에 접속 중...")
    with build_session() as session:
        response = session.get(
            base_url,
            headers=headers,
            timeout=(10, 30),
        )
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    items = soup.find_all("li", class_="list_item")
    print(f"총 {len(items)}개의 캠페인을 찾았습니다. 데이터 추출을 시작합니다.")

    campaigns: list[Campaign] = []

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

        region = extract_region_from_title(title)
        campaign_type = normalize_campaign_type(
            None,
            title=f"{title} {reward}",
            region=region,
        )

        campaigns.append(
            Campaign(
                platform="강남맛집",
                source_campaign_id=href,
                title=title,
                link=link,
                image_url=image_url,
                media_type=media_type,
                reward=reward,
                apply_count=apply_count,
                recruit_count=recruit_count,
                region=region,
                campaign_type=campaign_type,
            )
        )

    if not campaigns:
        raise RuntimeError("강남맛집에서 수집할 캠페인을 찾지 못했습니다.")

    saved = upsert_campaigns(get_database_connection(), campaigns)
    print(f"{saved}개 캠페인을 DB에 동기화했습니다.")


if __name__ == "__main__":
    get_gangnam_data()
