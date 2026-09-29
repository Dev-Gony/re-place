import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CRAWLERS = ROOT / "crawlers"
sys.path.insert(0, str(CRAWLERS))

from common import Campaign, normalize_datetime, normalize_region_group


class DataSemanticsTests(unittest.TestCase):
    def test_naive_korean_datetime_is_interpreted_as_seoul_time(self):
        self.assertEqual(
            normalize_datetime("2026-10-01T00:30:00"),
            "2026-09-30T15:30:00+00:00",
        )

    def test_timezone_aware_datetime_keeps_absolute_instant(self):
        self.assertEqual(
            normalize_datetime("2026-10-01T00:30:00Z"),
            "2026-10-01T00:30:00+00:00",
        )

    def test_source_timezone_can_be_overridden(self):
        self.assertEqual(
            normalize_datetime(
                "2026-10-01T00:30:00",
                source_timezone="UTC",
            ),
            "2026-10-01T00:30:00+00:00",
        )

    def test_invalid_timezone_is_unknown_not_utc_guess(self):
        self.assertIsNone(
            normalize_datetime(
                "2026-10-01T00:30:00",
                source_timezone="Not/AZone",
            )
        )

    def test_campaign_missing_counts_remain_unknown(self):
        campaign = Campaign(
            platform="테스트",
            source_campaign_id="missing",
            title="결측 테스트",
            link="https://example.com/missing",
        )
        record = campaign.to_record()
        self.assertIsNone(record["apply_count"])
        self.assertIsNone(record["recruit_count"])

    def test_actual_zero_count_is_preserved(self):
        campaign = Campaign(
            platform="테스트",
            source_campaign_id="zero",
            title="0명 테스트",
            link="https://example.com/zero",
            apply_count=0,
            recruit_count=10,
        )
        record = campaign.to_record()
        self.assertEqual(record["apply_count"], 0)
        self.assertEqual(record["recruit_count"], 10)

    def test_explicit_region_markers_win_over_ambiguous_district_names(self):
        self.assertEqual(
            normalize_region_group("부산광역시 강서구"),
            "경상·부산·대구·울산",
        )
        self.assertEqual(normalize_region_group("서울 강서구"), "서울")
        self.assertEqual(
            normalize_region_group("경기도 광주시"),
            "경기·인천",
        )
        self.assertEqual(
            normalize_region_group("광주광역시 북구"),
            "전라·광주",
        )

    def test_region_special_and_unknown_values(self):
        self.assertEqual(normalize_region_group("배송"), "지역무관")
        self.assertEqual(normalize_region_group("전국"), "지역무관")
        self.assertIsNone(normalize_region_group(""))
        self.assertIsNone(normalize_region_group("지역정보없음"))


if __name__ == "__main__":
    unittest.main()
