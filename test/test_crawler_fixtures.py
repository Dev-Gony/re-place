import json
import sys
import unittest
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
CRAWLERS = ROOT / 'crawlers'
FIXTURES = ROOT / 'test' / 'fixtures'
sys.path.insert(0, str(CRAWLERS))

import dinnerqueen_crawler
import gangnam_crawler
import mible_crawler
import reviewnote_crawler
import reviewplace_crawler
import reviewus_crawler


class CrawlerFixtureTests(unittest.TestCase):
    def test_reviewnote_fixture(self):
        item = json.loads((FIXTURES / 'reviewnote.json').read_text(encoding='utf-8'))
        campaign = reviewnote_crawler.parse_reviewnote_item(item)
        self.assertIsNotNone(campaign)
        self.assertEqual(campaign.platform, '리뷰노트')
        self.assertEqual(campaign.source_campaign_id, '1001')
        self.assertEqual(campaign.media_type, '블로그')
        self.assertEqual(campaign.campaign_type, '방문형')
        self.assertEqual(campaign.region, '서울 강남')
        self.assertEqual(campaign.apply_count, 12)
        self.assertEqual(campaign.recruit_count, 5)
        self.assertIn('2026-10-05', campaign.deadline_at)

    def test_reviewnote_missing_id_is_rejected(self):
        self.assertIsNone(reviewnote_crawler.parse_reviewnote_item({'title': 'broken'}))

    def test_dinnerqueen_fixture(self):
        html = (FIXTURES / 'dinnerqueen.html').read_text(encoding='utf-8')
        campaigns = dinnerqueen_crawler.extract_listing_campaigns(html)
        self.assertEqual(len(campaigns), 1)
        item = campaigns[0]
        self.assertEqual(item['source_id'], '2002')
        self.assertEqual(item['title'], '[서울 성수] 파스타 체험단')
        self.assertEqual(item['apply_count'], 18)
        self.assertEqual(item['recruit_count'], 6)
        self.assertEqual(item['campaign_type'], '방문형')

    def test_mible_fixture(self):
        html = (FIXTURES / 'mible.html').read_text(encoding='utf-8')
        campaigns = mible_crawler.parse_page(html)
        self.assertEqual(len(campaigns), 1)
        campaign = campaigns[0]
        self.assertEqual(campaign.source_campaign_id, '3003')
        self.assertEqual(campaign.campaign_type, '배송형')
        self.assertEqual(campaign.apply_count, 42)
        self.assertEqual(campaign.recruit_count, 10)
        self.assertIsNotNone(campaign.deadline_at)

    def test_mible_missing_counts_remain_unknown(self):
        html = """<html><body>
        <a href="/campaigns/3999">
          <div class="subject">[배송] 카운트 미확인 체험단</div>
          <div class="desc">제품 제공</div>
          <span>배송</span>
        </a>
        </body></html>"""
        campaigns = mible_crawler.parse_page(html)
        self.assertEqual(len(campaigns), 1)
        self.assertIsNone(campaigns[0].apply_count)
        self.assertIsNone(campaigns[0].recruit_count)

    def test_gangnam_recommend_json_fixture(self):
        payload = json.loads(
            (FIXTURES / 'gangnam_recommend.json').read_text(encoding='utf-8')
        )
        campaigns = [
            gangnam_crawler.parse_recommend_item(item)
            for item in payload['items']
        ]
        campaigns = [item for item in campaigns if item is not None]
        self.assertEqual(len(campaigns), 2)

        payback = next(
            item for item in campaigns
            if item.source_campaign_id == '2306425'
        )
        self.assertEqual(payback.platform, '강남맛집')
        self.assertEqual(payback.apply_count, 393)
        self.assertEqual(payback.recruit_count, 5)
        self.assertEqual(payback.campaign_type, '페이백')
        self.assertEqual(payback.media_type, '블로그')
        self.assertTrue(payback.link.endswith('/cp/?id=2306425'))

        reporter = next(
            item for item in campaigns
            if item.source_campaign_id == '2313424'
        )
        self.assertEqual(reporter.campaign_type, '기자단')
        self.assertTrue(reporter.is_points)

    def test_gangnam_source_id_is_numeric(self):
        self.assertEqual(
            gangnam_crawler.canonical_source_id('/cp/?id=2313424'),
            '2313424',
        )

    def test_gangnam_invalid_campaign_link_is_rejected(self):
        self.assertIsNone(gangnam_crawler.canonical_source_id('/cp/?foo=123'))
        self.assertIsNone(gangnam_crawler.canonical_source_id('/notice/?id=123'))
        self.assertIsNone(
            gangnam_crawler.canonical_source_id(
                'https://example.com/cp/?id=123'
            )
        )

    def test_reviewplace_fixture(self):
        html = (FIXTURES / 'reviewplace.html').read_text(encoding='utf-8')
        soup = BeautifulSoup(html, 'html.parser')
        campaign = reviewplace_crawler.parse_campaign(soup.find('a'), '제품')
        self.assertIsNotNone(campaign)
        self.assertEqual(campaign.source_campaign_id, '4004')
        self.assertEqual(campaign.campaign_type, '배송형')
        self.assertEqual(campaign.region, '배송')
        self.assertTrue(campaign.is_points)
        self.assertEqual(campaign.apply_count, 25)
        self.assertEqual(campaign.recruit_count, 5)

    def test_reviewus_fixture(self):
        html = (FIXTURES / 'reviewus.html').read_text(encoding='utf-8')
        soup = BeautifulSoup(html, 'html.parser')
        campaign = reviewus_crawler.parse_campaign(soup.find('a'))
        self.assertIsNotNone(campaign)
        self.assertEqual(campaign.source_campaign_id, '5005')
        self.assertEqual(campaign.media_type, '숏폼(릴스)')
        self.assertEqual(campaign.campaign_type, '방문형')
        self.assertEqual(campaign.apply_count, 11)
        self.assertEqual(campaign.recruit_count, 4)

    def test_broken_html_does_not_fabricate_campaigns(self):
        broken = "<html><body><a href='/campaigns/9999'>구조 변경됨</a></body></html>"
        self.assertEqual(mible_crawler.parse_page(broken), [])
        self.assertEqual(dinnerqueen_crawler.extract_listing_campaigns(broken), [])


if __name__ == '__main__':
    unittest.main()
