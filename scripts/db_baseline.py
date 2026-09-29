"""RPL-001: explicit read-only DB observations, not a production health verdict."""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date, datetime
from typing import Any, Callable, Mapping

ENVIRONMENTS = ("local", "preview", "production", "collector")
REQUIRED_COLUMNS = frozenset({
    "platform", "source_campaign_id", "title", "link", "collected_at",
    "deadline_at", "reward_amount", "reward_kind", "region_group",
})
COLUMNS_SQL = """
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'campaigns'
ORDER BY ordinal_position
"""
CONTEXT_SQL = """
SELECT CURRENT_TIMESTAMP AS checked_at,
       current_setting('transaction_read_only') AS transaction_read_only,
       current_setting('TimeZone') AS query_timezone
"""
AGGREGATES_SQL = """
SELECT platform, count(*) AS stored_rows,
       max(collected_at) AS latest_collected_at,
       count(*) FILTER (WHERE collected_at >= CURRENT_TIMESTAMP - interval '24 hours'
           AND collected_at <= CURRENT_TIMESTAMP) AS seen_in_24h,
       count(*) FILTER (WHERE collected_at IS NULL) AS missing_collected_at,
       count(*) FILTER (WHERE collected_at > CURRENT_TIMESTAMP) AS future_collected_at,
       count(*) FILTER (WHERE deadline_at IS NULL) AS unknown_deadline,
       count(*) FILTER (WHERE deadline_at < CURRENT_TIMESTAMP) AS past_deadline,
       count(*) FILTER (WHERE reward_amount IS NULL) AS unknown_reward_amount,
       count(*) FILTER (WHERE reward_kind IS NULL OR btrim(reward_kind) = '') AS missing_reward_kind,
       count(*) FILTER (WHERE region_group IS NULL OR btrim(region_group) = '') AS missing_region_group,
       count(*) FILTER (WHERE source_campaign_id IS NULL OR btrim(source_campaign_id::text) = ''
           OR title IS NULL OR btrim(title) = '' OR link IS NULL OR btrim(link) = '') AS invalid_required_fields
FROM public.campaigns GROUP BY platform ORDER BY platform LIMIT 100
"""
DUPLICATES_SQL = """
SELECT count(*) AS duplicate_key_groups FROM (
    SELECT platform, source_campaign_id FROM public.campaigns
    GROUP BY platform, source_campaign_id HAVING count(*) > 1
) AS duplicates
"""
SETTINGS = (
    "SET LOCAL statement_timeout = '15s'",
    "SET LOCAL lock_timeout = '2s'",
    "SET LOCAL idle_in_transaction_session_timeout = '20s'",
    "SET LOCAL TIME ZONE 'UTC'",
)


def collect_baseline(connection: Any) -> dict[str, Any]:
    """Use a dedicated, newly opened psycopg 3 connection with dict rows."""
    connection.read_only = True
    try:
        with connection.cursor() as cursor:
            for statement in SETTINGS:
                cursor.execute(statement)
            cursor.execute(CONTEXT_SQL)
            context = cursor.fetchone()
            if not context or context.get("transaction_read_only") != "on":
                return {"ok": False, "status": "READ_ONLY_NOT_CONFIRMED"}
            cursor.execute(COLUMNS_SQL)
            missing = sorted(REQUIRED_COLUMNS - {r["column_name"] for r in cursor.fetchall()})
            if missing:
                return {"ok": False, "status": "SCHEMA_INCOMPLETE", "missing_columns": missing}
            cursor.execute(AGGREGATES_SQL)
            rows = cursor.fetchall()
            if len(rows) >= 100:
                return {"ok": False, "status": "PLATFORM_LIMIT_REACHED"}
            cursor.execute(DUPLICATES_SQL)
            duplicates = cursor.fetchone()
            return {
                "ok": True, "status": "OBSERVED", "checked_at": context["checked_at"],
                "transaction_read_only": True, "query_timezone": context["query_timezone"],
                "platforms": rows, "duplicate_key_groups": duplicates["duplicate_key_groups"],
                "limitations": [
                    "Stored rows and seen_in_24h are not active campaigns or new inserts.",
                    "Past deadlines use stored values; source timezone correctness is not verified.",
                    "This does not certify deployment, source coverage, or data quality.",
                    "Environment is caller-supplied, not independently verified.",
                ],
            }
    finally:
        connection.rollback()  # Never commit, including the success path.


def default_connect(dsn: str, **kwargs: Any) -> Any:
    import psycopg
    from psycopg.rows import dict_row
    return psycopg.connect(dsn, row_factory=dict_row, **kwargs)


def run_check(environment: str, allow_db_read: bool, env: Mapping[str, str],
              connect: Callable[..., Any] = default_connect) -> tuple[dict[str, Any], int]:
    if environment not in ENVIRONMENTS:
        return {"ok": False, "status": "INVALID_ENVIRONMENT"}, 2
    if not allow_db_read:
        return {"ok": False, "status": "EXPLICIT_DB_READ_REQUIRED"}, 2
    dsn = env.get("DATABASE_URL", "").strip()
    if not dsn:
        return {"ok": False, "status": "DATABASE_URL_MISSING"}, 2
    connection = None
    try:
        connection = connect(dsn, connect_timeout=10, application_name="re-place-baseline")
        report = collect_baseline(connection)
        report["environment_label"] = environment
        return report, 0 if report["ok"] else 1
    except ImportError:
        return {"ok": False, "status": "DEPENDENCY_MISSING"}, 2
    except Exception:
        # Do not serialize exceptions, DSNs, roles, hosts, or stack traces.
        return {"ok": False, "status": "DB_BASELINE_FAILED"}, 1
    finally:
        if connection is not None:
            try:
                connection.close()
            except Exception:
                pass


def json_default(value: Any) -> str:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    raise TypeError("Unsupported report value")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--environment", required=True, choices=ENVIRONMENTS)
    parser.add_argument("--allow-db-read", action="store_true",
                        help="Allow read-only queries; may wake a suspended DB.")
    args = parser.parse_args(argv)
    report, code = run_check(args.environment, args.allow_db_read, os.environ)
    try:
        output = json.dumps(report, ensure_ascii=True, default=json_default, indent=2)
    except (TypeError, ValueError):
        output = '{"ok": false, "status": "REPORT_ENCODING_FAILED"}'
        code = 1
    print(output)
    return code


if __name__ == "__main__":
    sys.exit(main())
