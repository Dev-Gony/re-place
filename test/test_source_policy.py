import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CRAWLERS = ROOT / "crawlers"
sys.path.insert(0, str(CRAWLERS))

import run_all


class SourcePolicyTests(unittest.TestCase):
    def test_reviewnote_is_not_in_production_collectors(self):
        active_names = [name for name, _ in run_all.COLLECTORS]
        self.assertNotIn("리뷰노트", active_names)

    def test_reviewnote_is_explicitly_blocked(self):
        self.assertIn("리뷰노트", run_all.BLOCKED_COLLECTORS)

    def test_active_collector_set_matches_reviewed_sources(self):
        active_names = [name for name, _ in run_all.COLLECTORS]
        self.assertEqual(
            active_names,
            ["디너의여왕", "미블", "리뷰플레이스", "리뷰어스"],
        )


if __name__ == "__main__":
    unittest.main()
