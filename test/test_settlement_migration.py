import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SQL = (
    ROOT / "db" / "migrations" / "20260929_user_campaign_settlements.sql"
).read_text(encoding="utf-8")


class SettlementMigrationTests(unittest.TestCase):
    def test_settlement_is_private_and_record_scoped(self):
        self.assertIn("auth_user_id uuid not null", SQL)
        self.assertIn("record_id bigint not null", SQL)
        self.assertIn(
            "references public.user_campaign_records(id) on delete cascade",
            SQL,
        )
        self.assertIn("unique (auth_user_id, record_id)", SQL)

    def test_expected_benefit_types_are_separate(self):
        for column in (
            "expected_cash_amount",
            "expected_provided_value_amount",
            "expected_points_amount",
            "expected_reimbursement_amount",
        ):
            self.assertIn(column + " integer null", SQL)

    def test_actual_money_received_is_separate_from_provided_value(self):
        self.assertIn("actual_cash_received_amount integer null", SQL)
        self.assertIn("actual_reimbursement_received_amount integer null", SQL)
        self.assertNotIn("actual_provided_value_received_amount", SQL)

    def test_amounts_are_non_negative(self):
        self.assertGreaterEqual(SQL.count(">= 0"), 6)


if __name__ == "__main__":
    unittest.main()
