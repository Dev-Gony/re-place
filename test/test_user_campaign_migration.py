import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SQL = (ROOT / "db" / "migrations" / "20260929_user_campaigns.sql").read_text(
    encoding="utf-8"
)


class UserCampaignMigrationTests(unittest.TestCase):
    def test_private_tables_use_uuid_owner(self):
        self.assertGreaterEqual(SQL.count("auth_user_id uuid not null"), 2)

    def test_favorites_are_unique_per_owner_and_campaign(self):
        self.assertIn("unique (auth_user_id, campaign_id)", SQL)

    def test_linked_records_are_unique_but_manual_records_are_not(self):
        self.assertIn(
            "user_campaign_records (auth_user_id, campaign_id)",
            SQL,
        )
        self.assertIn("where campaign_id is not null", SQL)

    def test_status_values_are_constrained(self):
        for status in (
            "saved",
            "applied",
            "selected",
            "visited",
            "review_pending",
            "completed",
            "cancelled",
        ):
            self.assertIn("'" + status + "'", SQL)


if __name__ == "__main__":
    unittest.main()
