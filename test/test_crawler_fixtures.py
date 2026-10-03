import json
import sys
import unittest
from unittest.mock import Mock
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
CRAWLERS = ROOT / 'crawlers'
FIXTURES = ROOT / 'test' / 'fixtures'
sys.path.insert(0, str(CRAWLERS))

import dinnerqueen_crawler
import gangnam_crawler
import mible_crawler
import poblog_crawler
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
        self.assertEqual(len(campaigns), 3)

        local = next(item for item in campaigns if item.source_campaign_id == '3003')
        self.assertEqual(local.region, '광주 수완동')
        self.assertEqual(local.campaign_type, '방문형')
        self.assertEqual(local.apply_count, 42)
        self.assertEqual(local.recruit_count, 10)
        self.assertIsNotNone(local.deadline_at)

        station = next(item for item in campaigns if item.source_campaign_id == '3004')
        self.assertEqual(station.region, '홍대입구역')
        self.assertEqual(station.campaign_type, '방문형')
        self.assertIsNotNone(station.deadline_at)

        delivery = next(item for item in campaigns if item.source_campaign_id == '3005')
        self.assertEqual(delivery.campaign_type, '배송형')
        self.assertIsNotNone(delivery.deadline_at)

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

    def test_poblog_fixture(self):
        html = (FIXTURES / 'poblog.html').read_text(encoding='utf-8')
        campaigns = poblog_crawler.parse_page(html)
        self.assertEqual(len(campaigns), 2)

        local = next(item for item in campaigns if item.source_campaign_id == '410912')
        self.assertEqual(local.platform, '포블로그')
        self.assertEqual(local.title, '[서울/강남] 스테이크 체험단')
        self.assertEqual(local.campaign_type, '방문형')
        self.assertEqual(local.media_type, '숏폼(릴스)')
        self.assertEqual(local.region, '서울 강남')
        self.assertEqual(local.recruit_count, 3)
        self.assertIn('2026-10-12', local.deadline_at)

        delivery = next(item for item in campaigns if item.source_campaign_id == '410913')
        self.assertEqual(delivery.campaign_type, '페이백')
        self.assertEqual(delivery.media_type, '블로그')
        self.assertEqual(delivery.region, '배송')
        self.assertEqual(delivery.recruit_count, 10)
        self.assertTrue(delivery.is_points)

    def test_poblog_rejects_invalid_or_incomplete_cards(self):
        html = """<html><body>
        <a href="/campaign/not-a-number/">잘못된 링크</a>
        <div><a href="/campaign/410999/"><h3>구조 깨진 카드</h3></a></div>
        </body></html>"""
        self.assertEqual(poblog_crawler.parse_page(html), [])
        self.assertIsNone(
            poblog_crawler.parse_campaign_link('https://example.com/campaign/123/')
        )

    def test_poblog_api_item_fixture(self):
        item = json.loads(
            (FIXTURES / 'poblog_api.json').read_text(encoding='utf-8')
        )
        campaign = poblog_crawler.parse_api_item(item)
        self.assertIsNotNone(campaign)
        self.assertEqual(campaign.source_campaign_id, '410915')
        self.assertEqual(campaign.platform, '포블로그')
        self.assertEqual(campaign.campaign_type, '방문형')
        self.assertEqual(campaign.media_type, '숏폼(릴스)')
        self.assertEqual(campaign.region, '서울 강남')
        self.assertEqual(campaign.recruit_count, 5)
        self.assertEqual(campaign.apply_count, 17)
        self.assertIn('2026-10-12', campaign.deadline_at)

    def test_poblog_api_catalogue_uses_count_and_offset(self):
        first = Mock()
        first.raise_for_status.return_value = None
        first.json.return_value = {
            'count': 3,
            'list': [
                {
                    'url': '/campaign/410901/',
                    'title': '[서울/강남] 첫 캠페인',
                    'region': '서울/강남',
                    'period_info': '모집 10.02~10.12',
                    'recruit_count': 5,
                    'media': '블로그 방문형',
                },
                {
                    'url': '/campaign/410902/',
                    'title': '[제품/배송] 둘째 캠페인',
                    'period_info': '모집 10.02~10.13',
                    'recruit_count': 10,
                    'media': '블로그 배송형',
                },
            ],
        }
        second = Mock()
        second.raise_for_status.return_value = None
        second.json.return_value = {
            'count': 3,
            'list': [
                {
                    'url': '/campaign/410903/',
                    'title': '[서울/성수] 셋째 캠페인',
                    'region': '서울/성수',
                    'period_info': '모집 10.02~10.14',
                    'recruit_count': 2,
                    'media': '릴스 방문형',
                },
            ],
        }
        session = Mock()
        session.post.side_effect = [first, second]

        campaigns = poblog_crawler.collect_api_catalogue(
            session,
            limit=2,
            max_pages=3,
            sleep_between=False,
        )

        self.assertEqual(len(campaigns), 3)
        self.assertEqual(session.post.call_count, 2)
        first_data = session.post.call_args_list[0].kwargs['data']
        second_data = session.post.call_args_list[1].kwargs['data']
        self.assertEqual(first_data['page'], 1)
        self.assertEqual(first_data['offset'], 0)
        self.assertEqual(first_data['limit'], 2)
        self.assertEqual(second_data['page'], 2)
        self.assertEqual(second_data['offset'], 2)

    def test_poblog_api_fails_closed_on_early_empty_page(self):
        first = Mock()
        first.raise_for_status.return_value = None
        first.json.return_value = {'count': 10, 'list': []}
        session = Mock()
        session.post.return_value = first

        with self.assertRaises(RuntimeError):
            poblog_crawler.collect_api_catalogue(
                session,
                limit=20,
                max_pages=2,
                sleep_between=False,
            )

    def test_reviewplace_region_tag_fixture(self):
        html = """<html><body>
        <a href="/pr/?id=4999">
          NEW [릴스/경기/시흥] 인생곱창맛집! 품격있는곱창 드셔보세요
          ♥ [46,000원] 곱창 모듬구이 2인분
          D - 7 신청 0 / 10명
        </a>
        </body></html>"""
        soup = BeautifulSoup(html, 'html.parser')
        campaign = reviewplace_crawler.parse_campaign(soup.find('a'), '지역')
        self.assertIsNotNone(campaign)
        self.assertEqual(campaign.region, '경기 시흥')
        self.assertEqual(campaign.campaign_type, '방문형')
        self.assertEqual(campaign.media_type, '숏폼(릴스)')

    def test_reviewplace_influencer_tag_does_not_pollute_region(self):
        html = """<html><body>
        <a href="/pr/?id=4998">
          NEW [N인플/서울/강남] 준오헤어 스타일링
          ♥ 펌 or 컬러 중 택1
          D - 7 신청 1 / 2명
        </a>
        </body></html>"""
        soup = BeautifulSoup(html, 'html.parser')
        campaign = reviewplace_crawler.parse_campaign(soup.find('a'), '지역')
        self.assertIsNotNone(campaign)
        self.assertEqual(campaign.region, '서울 강남')
        self.assertEqual(campaign.campaign_type, '방문형')

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
        self.assertEqual(poblog_crawler.parse_page(broken), [])


if __name__ == '__main__':
    unittest.main()
