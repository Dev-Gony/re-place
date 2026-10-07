import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import inflexer_probe as probe


class InflexerProbeTests(unittest.TestCase):
    def payload(self):
        return {"is_valid": True, "num_result": 1, "result": [{
            "domain": "레뷰", "url": "https://www.revu.net/campaign/1405938",
            "title": "[노원] 표본", "media": "BP_", "type": "VST",
            "apl_due_dt": "2026-10-11", "pub_due_dt": "2026-10-27",
        }]}

    def test_second_hand_scope_and_missing_counts(self):
        result = probe.parse_payload(self.payload(), query="노원")
        self.assertEqual(result["scope"], "keyword-search-sample")
        self.assertFalse(result["production_reuse_verified"])
        self.assertEqual(result["items"][0]["source_campaign_id"], "1405938")
        self.assertIsNone(result["items"][0]["upstream_collected_at"])
        self.assertIsNone(result["items"][0]["apply_count"])

    def test_truncated_or_unexpected_results_fail(self):
        for payload in ({"is_valid": False}, {"is_valid": True, "num_result": 2, "result": []}, []):
            with self.assertRaises(ValueError):
                probe.parse_payload(payload, query="노원")

    def test_external_urls_and_invalid_dates_fail(self):
        for key, value in (("url", "https://evil.test/campaign/1405938"), ("apl_due_dt", "2026-02-30")):
            payload = self.payload()
            payload["result"][0][key] = value
            with self.assertRaises(ValueError):
                probe.parse_payload(payload, query="노원")

    def test_query_is_bounded(self):
        for query in ("", " ", "x", "x" * 81):
            with self.assertRaises(ValueError):
                probe.validate_query(query)


if __name__ == "__main__":
    unittest.main()
