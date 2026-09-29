import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CRAWLERS = ROOT / "crawlers"
sys.path.insert(0, str(CRAWLERS))

from common import Campaign, parse_reward, parse_reward_components


class RewardComponentTests(unittest.TestCase):
    def test_mixed_reward_keeps_components_separate(self):
        parsed = parse_reward_components(
            "5만원 상당 식사권 + 원고료 2만원 + 리뷰플레이스 30,000P"
        )
        self.assertEqual(parsed["cash_fee_amount"], 20000)
        self.assertEqual(parsed["provided_value_amount"], 50000)
        self.assertEqual(parsed["points_amount"], 30000)
        self.assertIsNone(parsed["reimbursement_amount"])

    def test_reimbursement_is_not_cash_fee(self):
        parsed = parse_reward_components("구매 후 30,000원 페이백")
        self.assertEqual(parsed["reimbursement_amount"], 30000)
        self.assertIsNone(parsed["cash_fee_amount"])
        self.assertIsNone(parsed["provided_value_amount"])

    def test_generic_amount_defaults_to_provided_value(self):
        parsed = parse_reward_components("3만원 제공")
        self.assertEqual(parsed["provided_value_amount"], 30000)
        self.assertIsNone(parsed["cash_fee_amount"])

    def test_payback_campaign_generic_amount_defaults_to_reimbursement(self):
        parsed = parse_reward_components(
            "30,000원",
            campaign_type="페이백",
        )
        self.assertEqual(parsed["reimbursement_amount"], 30000)
        self.assertIsNone(parsed["provided_value_amount"])

    def test_cash_context_is_detected(self):
        parsed = parse_reward_components("원고료 최대 15,000원 지급")
        self.assertEqual(parsed["cash_fee_amount"], 15000)

    def test_points_do_not_become_won_value(self):
        parsed = parse_reward_components("50,000P", is_points=True)
        self.assertEqual(parsed["points_amount"], 50000)
        self.assertIsNone(parsed["provided_value_amount"])
        self.assertIsNone(parsed["cash_fee_amount"])

    def test_product_pack_count_is_not_misread_as_points(self):
        parsed = parse_reward_components("쏘피 안심숙면팬티 5P(M / L 중 택 1)")
        self.assertIsNone(parsed["points_amount"])

    def test_campaign_record_preserves_raw_reward_and_components(self):
        campaign = Campaign(
            platform="테스트",
            source_campaign_id="1",
            title="테스트 캠페인",
            link="https://example.com/1",
            reward="5만원 상당 식사권 + 원고료 2만원",
        )
        record = campaign.to_record()
        self.assertEqual(record["reward"], "5만원 상당 식사권 + 원고료 2만원")
        self.assertEqual(record["provided_value_amount"], 50000)
        self.assertEqual(record["cash_fee_amount"], 20000)

    def test_legacy_reward_kind_prefers_cash_without_summing(self):
        amount, kind = parse_reward("5만원 상당 제공 + 원고료 2만원")
        self.assertEqual(amount, 20000)
        self.assertEqual(kind, "cash")


if __name__ == "__main__":
    unittest.main()
