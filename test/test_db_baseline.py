"""Offline control-flow tests; these do not validate SQL against PostgreSQL."""
import contextlib
import io
import json
import unittest
from datetime import datetime, timezone
from unittest.mock import Mock, patch
from scripts import db_baseline as b


class Cursor:
    def __init__(self, conn):
        self.conn, self.sql = conn, ""

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, sql):
        self.sql = sql
        self.conn.queries.append(sql)
        if self.conn.fail_on == sql:
            raise RuntimeError("postgresql://private:secret@internal/db")

    def fetchone(self):
        if self.sql == b.CONTEXT_SQL:
            return {"checked_at": datetime(2026, 9, 29, tzinfo=timezone.utc),
                    "transaction_read_only": self.conn.confirmed, "query_timezone": "UTC"}
        return {"duplicate_key_groups": self.conn.duplicates}

    def fetchall(self):
        if self.sql == b.COLUMNS_SQL:
            return [{"column_name": name} for name in self.conn.columns]
        return self.conn.rows


class Connection:
    def __init__(self):
        self.columns, self.confirmed = b.REQUIRED_COLUMNS, "on"
        self.rows, self.queries = [], []
        self.fail_on, self.duplicates = None, 0
        self.read_only = self.rolled_back = self.closed = False

    def cursor(self):
        return Cursor(self)

    def rollback(self):
        self.rolled_back = True

    def close(self):
        self.closed = True


class BaselineTests(unittest.TestCase):
    def check(self, conn):
        connect = Mock(return_value=conn)
        result = b.run_check("local", True, {"DATABASE_URL": "private"}, connect)
        connect.assert_called_once_with("private", connect_timeout=10, application_name="re-place-baseline")
        self.assertTrue(conn.rolled_back and conn.closed)
        return result

    def test_consent_required(self):
        connect = Mock()
        report, code = b.run_check("production", False, {}, connect)
        self.assertEqual((report["status"], code), ("EXPLICIT_DB_READ_REQUIRED", 2))
        connect.assert_not_called()

    def test_known_environment_required(self):
        report, code = b.run_check("invalid", True, {})
        self.assertEqual((report["status"], code), ("INVALID_ENVIRONMENT", 2))

    def test_url_required_before_connecting(self):
        connect = Mock()
        report, code = b.run_check("local", True, {}, connect)
        self.assertEqual((report["status"], code), ("DATABASE_URL_MISSING", 2))
        connect.assert_not_called()

    def test_missing_driver(self):
        report, code = b.run_check("local", True, {"DATABASE_URL": "x"}, Mock(side_effect=ImportError()))
        self.assertEqual((report["status"], code), ("DEPENDENCY_MISSING", 2))

    def test_connection_failure_no_secrets(self):
        report, code = b.run_check("local", True, {"DATABASE_URL": "x"},
                                  Mock(side_effect=RuntimeError("postgresql://user:password@private/db")))
        self.assertEqual(code, 1)
        self.assertEqual(report, {"ok": False, "status": "DB_BASELINE_FAILED"})

    def test_empty_db_is_observation(self):
        conn = Connection()
        report, code = self.check(conn)
        self.assertEqual(code, 0)
        self.assertEqual(report["platforms"], [])
        self.assertEqual(report["status"], "OBSERVED")
        self.assertTrue(conn.read_only)

    def test_read_only_confirmation(self):
        conn = Connection()
        conn.confirmed = "off"
        report, code = self.check(conn)
        self.assertEqual((report["status"], code), ("READ_ONLY_NOT_CONFIRMED", 1))
        self.assertNotIn(b.AGGREGATES_SQL, conn.queries)

    def test_schema_mismatch_stops_aggregation(self):
        conn = Connection()
        conn.columns = {"platform"}
        report, code = self.check(conn)
        self.assertEqual((report["status"], code), ("SCHEMA_INCOMPLETE", 1))
        self.assertIn("deadline_at", report["missing_columns"])
        self.assertNotIn(b.AGGREGATES_SQL, conn.queries)

    def test_query_failure_no_secrets(self):
        conn = Connection()
        conn.fail_on = b.AGGREGATES_SQL
        report, code = self.check(conn)
        self.assertEqual(code, 1)
        self.assertNotIn("secret", json.dumps(report))

    def test_bounded_read_only_queries(self):
        conn = Connection()
        self.check(conn)
        self.assertEqual(conn.queries[:4], list(b.SETTINGS))
        self.assertFalse(any(q.lstrip().upper().startswith(("INSERT", "UPDATE", "DELETE", "CREATE", "DROP", "COMMIT")) for q in conn.queries))

    def test_cap_is_not_silent_truncation(self):
        conn = Connection()
        conn.rows = [{"platform": str(i)} for i in range(100)]
        report, code = self.check(conn)
        self.assertEqual((report["status"], code), ("PLATFORM_LIMIT_REACHED", 1))

    def test_null_zero_and_duplicates_preserved(self):
        conn = Connection()
        conn.rows = [{"platform": "fixture", "stored_rows": 0, "latest_collected_at": None}]
        conn.duplicates = 2
        report, code = self.check(conn)
        self.assertEqual(code, 0)
        self.assertEqual(report["platforms"], conn.rows)
        self.assertEqual(report["duplicate_key_groups"], 2)
        self.assertEqual(report["environment_label"], "local")

    def test_json_dates(self):
        report, _ = self.check(Connection())
        self.assertIn("2026-09-29T00:00:00+00:00", json.dumps(report, default=b.json_default))

    def test_cli_requires_consent(self):
        with patch.dict("os.environ", {"DATABASE_URL": "postgresql://secret"}), contextlib.redirect_stdout(io.StringIO()) as out:
            code = b.main(["--environment", "production"])
        self.assertEqual(code, 2)
        self.assertNotIn("postgresql", out.getvalue())

    def test_encoding_error_safe(self):
        with patch.object(b, "run_check", return_value=({"unsafe": object()}, 0)), contextlib.redirect_stdout(io.StringIO()) as out:
            code = b.main(["--environment", "local"])
        self.assertEqual(code, 1)
        self.assertEqual(json.loads(out.getvalue())["status"], "REPORT_ENCODING_FAILED")


if __name__ == "__main__":
    unittest.main()
