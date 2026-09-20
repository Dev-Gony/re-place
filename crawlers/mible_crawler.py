import re

import requests
from bs4 import BeautifulSoup


BASE_URL = "https://www.mrblog.net/"
CAMPAIGN_RE = re.compile(r"^/campaigns/(\d+)$")


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


def get_mible_data():
    print("미블(Mible) 구조 확인을 시작합니다...")

    with build_session() as session:
        response = session.get(BASE_URL, timeout=(10, 30))
        response.raise_for_status()

    html = response.text
    soup = BeautifulSoup(html, "html.parser")

    campaign_links = []
    for anchor in soup.find_all("a", href=True):
        href = anchor.get("href", "").strip()
        match = CAMPAIGN_RE.match(href)
        if match:
            campaign_links.append((match.group(1), href, " ".join(anchor.stripped_strings)[:180]))

    script_srcs = [
        script.get("src", "")
        for script in soup.find_all("script", src=True)
    ][:60]

    snippets = []
    for match in list(re.finditer(r"신청|모집|제공|D-Day|일 남음", html))[:20]:
        start = max(0, match.start() - 220)
        end = min(len(html), match.end() + 420)
        snippets.append(re.sub(r"\s+", " ", html[start:end]))

    print(f"[MIBLE DEBUG] status={response.status_code} length={len(html)}")
    print(f"[MIBLE DEBUG] campaign links={campaign_links[:40]}")
    print(f"[MIBLE DEBUG] script srcs={script_srcs}")
    print(f"[MIBLE DEBUG] snippets={snippets}")
    print("[MIBLE DEBUG] diagnostic complete")


if __name__ == "__main__":
    get_mible_data()
