import re
from urllib.parse import parse_qs, urljoin, urlparse

import requests
from bs4 import BeautifulSoup


BASE_URL = "https://kr.reviewus.co.kr/"
DETAIL_RE = re.compile(r"review_campaign\.php\?cp_id=(\d+)")


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


def get_reviewus_data():
    print("리뷰어스 구조 확인을 시작합니다...")

    with build_session() as session:
        response = session.get(BASE_URL, timeout=(10, 30))
        response.raise_for_status()

    html = response.text
    soup = BeautifulSoup(html, "html.parser")

    campaign_links = []
    samples = []

    for anchor in soup.find_all("a", href=True):
        href = anchor.get("href", "").strip()
        parsed = urlparse(urljoin(BASE_URL, href))
        query = parse_qs(parsed.query)
        cp_ids = query.get("cp_id")

        if not parsed.path.endswith("review_campaign.php") or not cp_ids:
            continue

        source_id = cp_ids[0]
        campaign_links.append((source_id, parsed.geturl()))

        text = " ".join(anchor.stripped_strings).strip()
        if text:
            samples.append((source_id, text[:1000]))

    snippets = []
    for match in list(re.finditer(r"D-Day|신청\s*\d+\s*/\s*모집\s*\d+|배송형|방문형|제공내역", html))[:30]:
        start = max(0, match.start() - 260)
        end = min(len(html), match.end() + 520)
        snippets.append(re.sub(r"\s+", " ", html[start:end]))

    print(f"[REVIEWUS DEBUG] status={response.status_code} length={len(html)}")
    print(f"[REVIEWUS DEBUG] campaign links={campaign_links[:50]}")
    print(f"[REVIEWUS DEBUG] samples={samples[:25]}")
    print(f"[REVIEWUS DEBUG] snippets={snippets}")
    print("[REVIEWUS DEBUG] diagnostic complete")


if __name__ == "__main__":
    get_reviewus_data()
