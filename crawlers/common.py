import os
from dataclasses import asdict, dataclass

from dotenv import load_dotenv
from supabase import Client, create_client


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
