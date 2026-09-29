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
        self.assertNotIn("강남맛집", run_all.COLLECTOR_MAP)

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


if __name__ == "__main__":
    unittest.main()
