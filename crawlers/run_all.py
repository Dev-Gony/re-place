from collections.abc import Callable
from datetime import datetime, timezone
from time import perf_counter

from common import get_database_connection
from dinnerqueen_crawler import get_dinnerqueen_data
from mible_crawler import get_mible_data
from reviewplace_crawler import get_reviewplace_data
from reviewus_crawler import get_reviewus_data


Collector = tuple[str, Callable[[], None]]

COLLECTOR_MAP: dict[str, Callable[[], None]] = {
    "디너의여왕": get_dinnerqueen_data,
    "미블": get_mible_data,
    "리뷰플레이스": get_reviewplace_data,
    "리뷰어스": get_reviewus_data,
}


def get_enabled_collectors() -> list[Collector]:
    sql = """
        select name
          from platform_sources
         where status = 'active'
           and collection_enabled = true
         order by priority, name
    """

    with get_database_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql)
            names = [row[0] for row in cursor.fetchall()]

    unknown = [name for name in names if name not in COLLECTOR_MAP]
    if unknown:
        raise RuntimeError(
            "활성 source registry에 구현되지 않은 collector가 있습니다: "
            + ", ".join(unknown)
        )

    return [(name, COLLECTOR_MAP[name]) for name in names]


def run_all() -> None:
    failures: list[str] = []
    started_at = datetime.now(timezone.utc).isoformat()
    collectors = get_enabled_collectors()

    if not collectors:
        raise SystemExit("활성화된 운영 수집 플랫폼이 없습니다.")

    print(f"Re:Place crawler batch started at {started_at}")
    print("source registry 기준 운영 수집: " + ", ".join(name for name, _ in collectors))

    for name, collector in collectors:
        started = perf_counter()
        print(f"\n===== {name} 수집 시작 =====")

        try:
            collector()
        except Exception as exc:
            elapsed = perf_counter() - started
            failures.append(name)
            print(f"[FAIL] {name}: {exc} ({elapsed:.1f}s)")
        else:
            elapsed = perf_counter() - started
            print(f"[OK] {name} ({elapsed:.1f}s)")

    if failures:
        joined = ", ".join(failures)
        raise SystemExit(f"수집 실패 플랫폼: {joined}")

    print("\n운영 대상 플랫폼 수집이 정상 완료되었습니다.")


if __name__ == "__main__":
    run_all()
