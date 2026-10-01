import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = (ROOT / "app" / "page.tsx").read_text(encoding="utf-8")
WORKBENCH = (ROOT / "app" / "campaign-workbench.tsx").read_text(encoding="utf-8")


class SearchQueryContractTests(unittest.TestCase):
    def test_search_filters_use_bound_parameters(self):
        self.assertIn('values.push(`%${q}%`);', PAGE)
        self.assertIn('title ILIKE ${queryParam}', PAGE)
        self.assertIn('region ILIKE ${queryParam}', PAGE)
        self.assertIn('platform ILIKE ${queryParam}', PAGE)
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

    def test_reward_amount_filter_does_not_sum_different_components(self):
        self.assertIn("GREATEST(COALESCE(cash_fee_amount, 0)", PAGE)
        self.assertNotIn("cash_fee_amount + provided_value_amount", PAGE)

    def test_reward_type_filters_use_component_columns(self):
        self.assertIn('cash_fee_amount IS NOT NULL', PAGE)
        self.assertIn('provided_value_amount IS NOT NULL', PAGE)
        self.assertIn('points_amount IS NOT NULL', PAGE)
        self.assertIn('reimbursement_amount IS NOT NULL', PAGE)

    def test_korean_deadlines_render_in_seoul_timezone(self):
        self.assertIn('timeZone: "Asia/Seoul"', PAGE)

    def test_missing_counts_are_not_rendered_as_zero(self):
        self.assertIn('value === null ? "미확인"', PAGE)
        self.assertIn('competitionLabel: ratio !== null ?', PAGE)
        self.assertIn(': "집계 전"', PAGE)
        self.assertIn('item.competitionLabel', WORKBENCH)
        self.assertNotIn('campaign.apply_count ?? 0', PAGE)
        self.assertNotIn('campaign.recruit_count ?? 0', PAGE)


if __name__ == "__main__":
    unittest.main()
