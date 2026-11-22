import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SQL = (ROOT / "db" / "migrations" / "20261121_ledger_tracking.sql").read_text(
    encoding="utf-8"
)


class LedgerTrackingMigrationTests(unittest.TestCase):
    def test_migration_is_additive_and_transactional(self):
        self.assertTrue(SQL.strip().splitlines()[2].startswith("begin;"))
        self.assertIn("commit;", SQL)
        self.assertNotIn("drop column", SQL.lower())
        self.assertNotIn("drop table", SQL.lower())
        self.assertNotIn("delete from", SQL.lower())
        self.assertNotIn("update public", SQL.lower())

    def test_published_url_is_optional_and_http_only(self):
        self.assertIn("add column if not exists published_url text null", SQL)
        self.assertIn("char_length(published_url) <= 1000", SQL)
        self.assertIn("'^https?://'", SQL)

    def test_cash_payment_due_is_separate_from_received_at(self):
        self.assertIn(
            "add column if not exists cash_payment_due_at timestamptz null", SQL
        )
        self.assertNotIn("cash_received_at", SQL)


if __name__ == "__main__":
    unittest.main()
