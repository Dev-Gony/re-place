from collections.abc import Callable
from datetime import datetime, timezone
from time import perf_counter

from gangnam_crawler import get_gangnam_data
from reviewnote_crawler import get_reviewnote_data
from dinnerqueen_crawler import get_dinnerqueen_data


Collector = tuple[str, Callable[[], None]]

COLLECTORS: list[Collector] = [
    ("강남맛집", get_gangnam_data),
    ("리뷰노트", get_reviewnote_data),
    ("디너의여왕", get_dinnerqueen_data),
]


def run_all() -> None:
    failures: list[str] = []
    started_at = datetime.now(timezone.utc).isoformat()

    print(f"Re:Place crawler batch started at {started_at}")
    print("레뷰 수집은 현재 운영 배치에서 일시 제외되어 있습니다.")

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

    print("\n운영 대상 플랫폼 수집이 정상 완료되었습니다.")


if __name__ == "__main__":
    run_all()
