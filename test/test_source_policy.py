import sys
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
CRAWLERS = ROOT / "crawlers"
sys.path.insert(0, str(CRAWLERS))

import run_all


class FakeCursor:
    def __init__(self, rows):
        self.rows = rows
        self.sql = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, sql):
        self.sql = sql

    def fetchall(self):
        return self.rows


class FakeConnection:
    def __init__(self, rows):
        self.cursor_instance = FakeCursor(rows)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def cursor(self):
        return self.cursor_instance


class SourcePolicyTests(unittest.TestCase):
    def test_blocked_source_has_no_production_collector_mapping(self):
        self.assertNotIn("리뷰노트", run_all.COLLECTOR_MAP)
        self.assertNotIn("레뷰", run_all.COLLECTOR_MAP)
        self.assertIn("레뷰(인플렉서)", run_all.COLLECTOR_MAP)
        self.assertIn("강남맛집", run_all.COLLECTOR_MAP)
        self.assertNotIn("슈퍼멤버스", run_all.COLLECTOR_MAP)
        self.assertNotIn("아싸뷰", run_all.COLLECTOR_MAP)

    def test_registry_drives_enabled_collectors(self):
        connection = FakeConnection([
            ("디너의여왕",),
            ("미블",),
            ("리뷰플레이스",),
            ("리뷰어스",),
        ])
        with patch.object(run_all, "get_database_connection", return_value=connection):
            collectors = run_all.get_enabled_collectors()

        self.assertEqual(
            [name for name, _ in collectors],
            ["디너의여왕", "미블", "리뷰플레이스", "리뷰어스"],
        )
        self.assertIn("collection_enabled = true", connection.cursor_instance.sql)
        self.assertIn("status = 'active'", connection.cursor_instance.sql)

    def test_unknown_enabled_registry_source_fails_closed(self):
        connection = FakeConnection([("새플랫폼",)])
        with patch.object(run_all, "get_database_connection", return_value=connection):
            with self.assertRaises(RuntimeError):
                run_all.get_enabled_collectors()

    def test_assaview_policy_gate_is_documented(self):
        registry = (ROOT / "docs" / "SOURCE_USAGE_REGISTER.md").read_text(
            encoding="utf-8"
        )

        self.assertIn("| \uC544\uC2F8\uBDF0 | paused-policy |", registry)
        self.assertIn("RPL-041", registry)

    def test_assaview_live_probe_is_dry_run_only(self):
        workflow = (
            ROOT / ".github" / "workflows" / "assaview-live-probe.yml"
        ).read_text(encoding="utf-8")

        self.assertIn("python crawlers/assaview_crawler.py --dry-run", workflow)
        self.assertNotIn("--write", workflow)
        self.assertNotIn("DATABASE_URL", workflow)


if __name__ == "__main__":
    unittest.main()
