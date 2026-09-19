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
    campaign_type: str | None = None
    deadline_at: str | None = None
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
        return asdict(self)


def get_supabase_client() -> Client:
    load_dotenv()
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")

    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be configured")

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


def normalize_campaign_type(
    raw_value: str | None,
    *,
    title: str = "",
    region: str | None = None,
) -> str | None:
    source = (raw_value or "").strip().lower()

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

    return raw_value.strip() if raw_value and raw_value.strip() else None


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
