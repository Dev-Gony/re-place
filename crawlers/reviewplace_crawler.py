import re
from urllib.parse import urljoin, urlparse, parse_qs

import requests
from bs4 import BeautifulSoup


BASE_URL = "https://www.reviewplace.co.kr"
LIST_URL = f"{BASE_URL}/pr/?ct1=%EC%A0%9C%ED%92%88"


def build_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/146.0.0.0 Safari/537.36"
            )
        }
    )
    return session


def get_reviewplace_data():
    print("리뷰플레이스 구조 확인을 시작합니다...")

    with build_session() as session:
        response = session.get(LIST_URL, timeout=(10, 30))
        response.raise_for_status()

    html = response.text
    soup = BeautifulSoup(html, "html.parser")

    campaign_links = []
    card_samples = []

    for anchor in soup.find_all("a", href=True):
        href = anchor.get("href", "").strip()
        parsed = urlparse(urljoin(BASE_URL, href))
        query = parse_qs(parsed.query)

        if not parsed.path.endswith("/pr/") or "id" not in query:
            continue

        source_id = query["id"][0]
        campaign_links.append((source_id, parsed.geturl()))

        text = " ".join(anchor.stripped_strings)
        if text:
            card_samples.append((source_id, text[:900]))

    pagination_links = [
        anchor.get("href", "")
        for anchor in soup.find_all("a", href=True)
        if "page=" in anchor.get("href", "")
    ][:80]

    snippets = []
    for match in list(re.finditer(r"신청|모집|D\s*-\s*\d+|오늘마감|P", html))[:25]:
        start = max(0, match.start() - 220)
        end = min(len(html), match.end() + 420)
        snippets.append(re.sub(r"\s+", " ", html[start:end]))

    print(f"[REVIEWPLACE DEBUG] status={response.status_code} length={len(html)}")
    print(f"[REVIEWPLACE DEBUG] campaign links={campaign_links[:40]}")
    print(f"[REVIEWPLACE DEBUG] card samples={card_samples[:20]}")
    print(f"[REVIEWPLACE DEBUG] pagination links={pagination_links}")
    print(f"[REVIEWPLACE DEBUG] snippets={snippets}")
    print("[REVIEWPLACE DEBUG] diagnostic complete")


if __name__ == "__main__":
    get_reviewplace_data()
