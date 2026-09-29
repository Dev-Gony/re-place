import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = (ROOT / "app" / "page.tsx").read_text(encoding="utf-8")


class SearchQueryContractTests(unittest.TestCase):
    def test_search_filters_use_bound_parameters(self):
        self.assertIn('addFilter("title ILIKE ?",', PAGE)
        self.assertIn('addFilter("platform = ANY(?::text[])", platforms)', PAGE)
        self.assertIn('addFilter("region_group = ?", regionGroup)', PAGE)
        self.assertIn('addFilter("region ILIKE ?",', PAGE)
        self.assertIn('addFilter("media_type = ?", media)', PAGE)
        self.assertIn('addFilter("campaign_type = ?", campaignType)', PAGE)

    def test_search_values_are_kept_in_parameter_arrays(self):
        self.assertIn("const values: unknown[] = [];", PAGE)
        self.assertIn("values.push(value);", PAGE)
        self.assertIn("pageValues,", PAGE)
        self.assertIn("values,", PAGE)

    def test_page_size_and_offset_are_bound(self):
        self.assertIn("LIMIT ${limitParam} OFFSET ${offsetParam}", PAGE)
        self.assertIn("const pageValues = [...values, PAGE_SIZE, from];", PAGE)

    def test_source_registry_controls_search_visibility(self):
        self.assertIn("FROM platform_sources", PAGE)
        self.assertIn("search_enabled = true", PAGE)
        self.assertIn("ps.status = 'active'", PAGE)
        self.assertIn("make_interval(hours => ps.freshness_hours)", PAGE)

    def test_known_expired_campaigns_are_hidden_by_default(self):
        self.assertIn(
            "(campaigns.deadline_at IS NULL OR campaigns.deadline_at >= now())",
            PAGE,
        )


if __name__ == "__main__":
    unittest.main()
