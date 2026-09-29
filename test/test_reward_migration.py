import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SQL = (ROOT / "db" / "migrations" / "20260929_reward_components.sql").read_text(
    encoding="utf-8"
)


class RewardMigrationTests(unittest.TestCase):
    def test_component_columns_are_added(self):
        for column in (
            "cash_fee_amount",
            "provided_value_amount",
            "points_amount",
            "reimbursement_amount",
        ):
            self.assertIn(column, SQL)

    def test_backfill_does_not_create_cross_category_total(self):
        self.assertNotIn("cash_fee_amount + provided_value_amount", SQL)
        self.assertNotIn("provided_value_amount + points_amount", SQL)

    def test_legacy_backfill_keeps_points_distinct(self):
        self.assertIn("points_amount", SQL)
        self.assertIn("regexp_match", SQL)


if __name__ == "__main__":
    unittest.main()
