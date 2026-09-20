import os
import re
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Iterable

from dotenv import load_dotenv
from supabase import Client, create_client


_REGION_PATTERN = re.compile(r"^\[([^\]]+)\]")


@dataclass(frozen=True)
class Campaign:
    platform: str
    source_campaign_id: str
    title: str
    link: str
    image_url: str = ""
    media_type: str = ""
    reward: str = ""
    is_points: bool = False
    apply_count: int = 0
    recruit_count: int = 0
    region: str | None = None
    region_group: str | None = None
    campaign_type: str | None = None
    deadline_at: str | None = None
    reward_amount: int | None = None
    reward_kind: str | None = None
    collected_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def to_record(self) -> dict:
        if not self.platform.strip():
            raise ValueError("platform is required")
        if not self.source_campaign_id.strip():
            raise ValueError("source_campaign_id is required")
        if not self.title.strip():
            raise ValueError("title is required")
        if not self.link.strip():
            raise ValueError("link is required")

        record = asdict(self)
        amount, kind = parse_reward(self.reward, self.is_points)
        if record["reward_amount"] is None:
            record["reward_amount"] = amount
        if record["reward_kind"] is None:
            record["reward_kind"] = kind
        if record["region_group"] is None:
            record["region_group"] = normalize_region_group(self.region)
        return record


def get_supabase_client() -> Client:
    load_dotenv()
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured")

    return create_client(url, key)


def upsert_campaigns(client: Client, campaigns: list[Campaign]) -> int:
    if not campaigns:
        return 0

    records = [campaign.to_record() for campaign in campaigns]
    client.table("campaigns").upsert(
        records,
        on_conflict="platform,source_campaign_id",
    ).execute()
    return len(records)


def first_text(data: dict[str, Any], keys: Iterable[str]) -> str | None:
    for key in keys:
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
        if isinstance(value, (int, float)):
            return str(value)
    return None


def nested_text(data: dict[str, Any], paths: Iterable[tuple[str, ...]]) -> str | None:
    for path in paths:
        value: Any = data
        for key in path:
            if not isinstance(value, dict) or key not in value:
                value = None
                break
            value = value[key]

        if isinstance(value, str) and value.strip():
            return value.strip()
        if isinstance(value, (int, float)):
            return str(value)

    return None


def extract_region_from_title(title: str) -> str | None:
    match = _REGION_PATTERN.match(title.strip())
    if not match:
        return None
    return match.group(1).strip() or None


def normalize_region_group(region: str | None) -> str | None:
    if not region:
        return None

    value = region.strip()

    if value in ("전국", "재택", "배송"):
        return "지역무관"

    mappings = (
        ("서울", ("서울", "강남", "송파", "종로", "용산", "성수", "서초", "강동", "강서", "논현", "홍대", "노원", "마포", "잠실", "성북", "영등포", "압구정", "관악", "여의도", "청담", "합정", "선릉", "동대문", "광진", "은평", "신촌", "건대", "신사", "구로", "금천", "동작", "양천", "중랑", "도봉")),
        ("경기·인천", ("경기", "수원", "용인", "부천", "분당", "성남", "안양", "고양", "동탄", "화성", "일산", "안산", "파주", "평택", "김포", "남양주", "하남", "의정부", "광명", "시흥", "군포", "양주", "구리", "오산", "포천", "이천", "여주", "과천", "인천", "부평", "송도", "청라")),
        ("충청·대전·세종", ("충북", "충남", "청주", "충주", "제천", "천안", "아산", "공주", "당진", "서산", "보령", "대전", "둔산", "세종")),
        ("전라·광주", ("전북", "전남", "전주", "군산", "익산", "정읍", "여수", "순천", "목포", "나주", "광주", "상무")),
        ("경상·부산·대구·울산", ("경북", "경남", "포항", "경주", "구미", "안동", "창원", "김해", "진주", "양산", "거제", "통영", "부산", "서면", "해운대", "광안리", "남포", "기장", "대구", "동성로", "수성", "울산")),
        ("강원", ("강원", "강릉", "춘천", "속초", "원주", "홍천", "양양", "평창")),
        ("제주", ("제주", "서귀포")),
    )

    for group, keywords in mappings:
        if any(keyword in value for keyword in keywords):
            return group

    return None

def normalize_campaign_type(
    raw_value: str | None,
    *,
    title: str = "",
    region: str | None = None,
) -> str | None:
    source = f"{raw_value or ''} {title}".strip().lower()

    if any(token in source for token in ("visit", "play", "방문")):
        return "방문형"
    if any(token in source for token in ("delivery", "ship", "배송")):
        return "배송형"
    if any(token in source for token in ("pickup", "takeout", "포장")):
        return "포장"
    if any(token in source for token in ("payback", "페이백")):
        return "페이백"

    if region == "재택" or title.strip().startswith("[재택]"):
        return "배송형"

    return None



def parse_reward(reward: str, is_points: bool = False) -> tuple[int | None, str]:
    text = (reward or "").strip()

    if is_points or "포인트" in text:
        return None, "points"

    if "%" in text:
        return None, "discount"

    man_match = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*만\s*원", text)
    if man_match:
        amount = round(float(man_match.group(1)) * 10000)
        return amount, "amount"

    won_match = re.search(r"([0-9][0-9,]*)\s*원", text)
    if won_match:
        amount = int(won_match.group(1).replace(",", ""))
        return amount, "amount"

    return None, "provided"

def normalize_datetime(value: Any) -> str | None:
    if value is None or value == "":
        return None

    if isinstance(value, (int, float)):
        timestamp = float(value)
        if timestamp > 10_000_000_000:
            timestamp /= 1000
        try:
            return datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat()
        except (OverflowError, OSError, ValueError):
            return None

    if not isinstance(value, str):
        return None

    text = value.strip()
    if not text:
        return None

    normalized = text.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)

    return parsed.astimezone(timezone.utc).isoformat()


def first_datetime(data: dict[str, Any], keys: Iterable[str]) -> str | None:
    for key in keys:
        parsed = normalize_datetime(data.get(key))
        if parsed:
            return parsed
    return None


def nested_datetime(
    data: dict[str, Any],
    paths: Iterable[tuple[str, ...]],
) -> str | None:
    for path in paths:
        value: Any = data
        for key in path:
            if not isinstance(value, dict) or key not in value:
                value = None
                break
            value = value[key]

        parsed = normalize_datetime(value)
        if parsed:
            return parsed

    return None
