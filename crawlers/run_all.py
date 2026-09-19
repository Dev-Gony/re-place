from collections.abc import Callable
from datetime import datetime, timezone
from time import perf_counter

from gangnam_crawler import get_gangnam_data
from reviewnote_crawler import get_reviewnote_data
from revu_crawler import get_revu_data


Collector = tuple[str, Callable[[], None]]

COLLECTORS: list[Collector] = [
    ("강남맛집", get_gangnam_data),
    ("리뷰노트", get_reviewnote_data),
    ("레뷰", get_revu_data),
]


def run_all() -> None:
    failures: list[str] = []
    started_at = datetime.now(timezone.utc).isoformat()

    print(f"Re:Place crawler batch started at {started_at}")

    for name, collector in COLLECTORS:
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

    print("\n모든 플랫폼 수집이 정상 완료되었습니다.")


if __name__ == "__main__":
    run_all()
