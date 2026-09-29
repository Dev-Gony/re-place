import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SQL = (ROOT / "db" / "migrations" / "20260929_source_registry.sql").read_text(
    encoding="utf-8"
)


class SourceRegistryMigrationTests(unittest.TestCase):
    def test_registry_policy_columns_exist(self):
        self.assertIn("collection_enabled boolean", SQL)
        self.assertIn("search_enabled boolean", SQL)
        self.assertIn("freshness_hours integer", SQL)

    def test_blocked_and_paused_sources_are_not_searchable(self):
        for slug in ("reviewnote", "revu", "gangnam", "4blog"):
            marker = "('" + slug + "'"
            self.assertIn(marker, SQL)

        self.assertIn("'reviewnote', '리뷰노트'", SQL)
        self.assertIn("'blocked'", SQL)
        self.assertIn("'revu', '레뷰'", SQL)
        self.assertIn("'gangnam', '강남맛집'", SQL)

    def test_active_sources_are_enabled_for_collection_and_search(self):
        for slug in ("dinnerqueen", "mible", "reviewplace", "reviewus"):
            self.assertIn("('" + slug + "'", SQL)
        self.assertGreaterEqual(SQL.count("true, true, 30"), 4)


if __name__ == "__main__":
    unittest.main()
