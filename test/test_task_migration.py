import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SQL = (ROOT / "db" / "migrations" / "20260929_user_campaign_tasks.sql").read_text(
    encoding="utf-8"
)


class UserCampaignTaskMigrationTests(unittest.TestCase):
    def test_tasks_are_owned_and_linked_to_records(self):
        self.assertIn("auth_user_id uuid not null", SQL)
        self.assertIn(
            "references public.user_campaign_records(id) on delete cascade",
            SQL,
        )

    def test_task_types_are_constrained(self):
        for task_type in ("visit", "content", "submit", "other"):
            self.assertIn("'" + task_type + "'", SQL)

    def test_due_date_is_required_and_completion_is_separate(self):
        self.assertIn("due_at timestamptz not null", SQL)
        self.assertIn("completed_at timestamptz null", SQL)

    def test_owner_due_and_record_indexes_exist(self):
        self.assertIn("user_campaign_tasks_owner_due_idx", SQL)
        self.assertIn("user_campaign_tasks_record_idx", SQL)


if __name__ == "__main__":
    unittest.main()
