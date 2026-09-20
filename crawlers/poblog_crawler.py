import re

import requests
from bs4 import BeautifulSoup


BASE_URL = "https://4blog.net/"


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


def get_poblog_data():
    print("포블로그(Poblog) 구조 확인을 시작합니다...")

    with build_session() as session:
        response = session.get(BASE_URL, timeout=(10, 30))
        response.raise_for_status()

    html = response.text
    soup = BeautifulSoup(html, "html.parser")

    hrefs = [
        anchor.get("href", "")
        for anchor in soup.find_all("a", href=True)
    ]

    numbered_hrefs = [
        href
        for href in hrefs
        if re.search(r"\d{3,}", href)
    ][:80]

    script_srcs = [
        script.get("src", "")
        for script in soup.find_all("script", src=True)
    ][:50]

    campaign_snippets = []
    for match in list(re.finditer(r"모집|제공|리뷰|D-\d+", html))[:20]:
        start = max(0, match.start() - 220)
        end = min(len(html), match.end() + 420)
        campaign_snippets.append(re.sub(r"\s+", " ", html[start:end]))

    endpoint_hints = sorted(
        set(
            re.findall(
                r"[^\"'\s<>]{0,120}(?:ajax|api|campaign|review|more|list)[^\"'\s<>]{0,160}",
                html,
                flags=re.IGNORECASE,
            )
        )
    )[:60]

    print(f"[POBLOG DEBUG] status={response.status_code} length={len(html)}")
    print(f"[POBLOG DEBUG] href count={len(hrefs)}")
    print(f"[POBLOG DEBUG] numbered hrefs={numbered_hrefs}")
    print(f"[POBLOG DEBUG] script srcs={script_srcs}")
    print(f"[POBLOG DEBUG] endpoint hints={endpoint_hints}")
    print(f"[POBLOG DEBUG] campaign snippets={campaign_snippets}")

    raise RuntimeError("포블로그 구조 확인용 진단 실행")


if __name__ == "__main__":
    get_poblog_data()
