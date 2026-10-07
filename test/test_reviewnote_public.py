import copy
import json
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'crawlers'))
import reviewnote_public_crawler as crawler

NOW = datetime(2026, 10, 7, tzinfo=timezone.utc)
ROW = {'id': 1462459, 'title': '테스트 캠페인', 'status': 'SELECT',
       'sort': 'DELIVERY', 'channel': 'BLOG', 'infNum': 1, 'infPoint': 10000,
       'offer': '상품 제공', 'city': '재택', 'sido': {'name': '재택'},
       'applyEndAt': '2026-10-30T14:59:59.999Z',
       'reviewEndAt': '2026-11-13T14:59:59.999Z', 'applicantCount': 0}


def html(rows):
    data = {'props': {'pageProps': {'data': {'objects': rows, 'page': 0,
             'has_more': True, 'total_pages': 2, 'total_count': len(rows)}}}}
    return '<script id="__NEXT_DATA__" type="application/json">' + json.dumps(data) + '</script>'


class ReviewnotePublicTests(unittest.TestCase):
    def test_preserves_real_deadline_counts_points_and_source(self):
        campaign = crawler.parse_listing(html([ROW]), now=NOW)[0]
        self.assertEqual(campaign.platform, '리뷰노트(공개목록)')
        self.assertEqual(campaign.link, 'https://www.reviewnote.co.kr/campaigns/1462459')
        self.assertEqual(campaign.deadline_at, '2026-10-30T14:59:59.999000+00:00')
        self.assertEqual(campaign.apply_count, 0)
        self.assertEqual(campaign.points_amount, 10000)
        self.assertEqual(campaign.region, '배송')
        self.assertEqual(campaign.image_url, '')

    def test_blog_clip_and_regional_type(self):
        row = {**ROW, 'sort': 'VISIT', 'channel': 'BLOG_CLIP',
               'city': '서울', 'sido': {'name': '노원구'}}
        campaign = crawler.parse_listing(html([row]), now=NOW)[0]
        self.assertEqual(campaign.region, '서울/노원구')
        self.assertEqual(campaign.media_type, '블로그+숏폼')
        self.assertEqual(campaign.campaign_type, '방문형')

    def test_public_ui_sort_names_purchase_pickup_reporter(self):
        purchase = {**ROW, 'sort': 'TAKEOUT'}
        pickup = {**ROW, 'id': 2, 'sort': 'ETC', 'city': '서울', 'sido': {'name': '강남구'}}
        reporter = {**ROW, 'id': 3, 'sort': 'PLATFORM_REPORTER'}
        today = {**ROW, 'id': 4, 'sort': 'TODAY'}
        campaigns = crawler.parse_listing(html([purchase, pickup, reporter, today]), now=NOW)
        self.assertEqual([x.campaign_type for x in campaigns], ['구매형', '포장', '기자단', '당일지급'])

    def test_observed_public_row_field_roles(self):
        fixture = Path(__file__).parent / 'fixtures' / 'reviewnote_public.json'
        row = json.loads(fixture.read_text(encoding='utf-8'))
        campaign = crawler.parse_listing(html([row]), now=NOW)[0]
        self.assertEqual(campaign.region, '인천/부평구')
        self.assertEqual(campaign.title, '[인천/부평구] 위니미니네일')
        self.assertEqual(campaign.apply_count, 9)
        self.assertEqual(campaign.recruit_count, 3)
        self.assertEqual(campaign.points_amount, 5000)

    def test_excludes_expired_and_nonblog(self):
        expired = {**ROW, 'id': 2, 'applyEndAt': '2026-10-01T14:59:59Z'}
        instagram = {**ROW, 'id': 3, 'channel': 'INSTAGRAM'}
        self.assertEqual(len(crawler.parse_listing(html([ROW, expired, instagram]), now=NOW)), 1)

    def test_payback_ui_status_rule(self):
        payback = {**ROW, 'id': 2, 'sort': 'PAYBACK', 'status': 'PROGRESS'}
        closed = {**ROW, 'id': 3, 'status': 'PROGRESS'}
        selecting_payback = {**ROW, 'id': 4, 'sort': 'PAYBACK', 'status': 'SELECT'}
        complete_payback = {**ROW, 'id': 5, 'sort': 'PAYBACK', 'status': 'COMPLETE'}
        self.assertEqual(len(crawler.parse_listing(html([ROW, payback, closed, selecting_payback, complete_payback]), now=NOW)), 3)

    def test_contract_errors_fail(self):
        for update in [{'id': True}, {'id': 0}, {'title': ''}, {'applyEndAt': None},
                       {'applyEndAt': '2026-10-30'}, {'applicantCount': -1},
                       {'infNum': None}, {'infPoint': '100'}, {'sort': 'NEW'},
                       {'status': 'NEW'}, {'offer': None}]:
            with self.subTest(update=update), self.assertRaises(ValueError):
                crawler.parse_listing(html([{**ROW, **update}]), now=NOW)
        with self.assertRaises(ValueError):
            crawler.parse_listing(html([ROW, copy.deepcopy(ROW)]), now=NOW)

    def test_no_review_deadline_fallback_and_empty_fails(self):
        row = dict(ROW)
        del row['applyEndAt']
        for content in [html([row]), html([]), '<html>Login</html>']:
            with self.assertRaises(ValueError):
                crawler.parse_listing(content, now=NOW)

    def test_no_db_for_dry_run_or_fetch_failure(self):
        with patch.object(crawler, 'collect', return_value=['campaign']), patch.object(crawler, 'get_database_connection') as db:
            crawler.get_reviewnote_public_data()
            db.assert_not_called()
        with patch.object(crawler, 'collect', side_effect=ValueError('changed')), patch.object(crawler, 'get_database_connection') as db:
            with self.assertRaises(ValueError):
                crawler.get_reviewnote_public_data(dry_run=False)
            db.assert_not_called()

    def test_registry_gate_and_atomic_write(self):
        connection = MagicMock()
        connection.__enter__.return_value = connection
        cursor = connection.cursor.return_value.__enter__.return_value
        cursor.fetchone.return_value = None
        with patch.object(crawler, 'collect', return_value=['campaign']), patch.object(crawler, 'get_database_connection', return_value=connection), patch.object(crawler, 'upsert_campaigns') as save:
            with self.assertRaises(RuntimeError):
                crawler.get_reviewnote_public_data(dry_run=False)
            save.assert_not_called()
            cursor.fetchone.return_value = (1,)
            crawler.get_reviewnote_public_data(dry_run=False)
            save.assert_called_once_with(connection, ['campaign'])

    def test_bounded_anonymous_public_api_only(self):
        response = MagicMock()
        response.__enter__.return_value = response
        response.status_code = 200
        response.iter_content.return_value = [b'x' * (crawler.MAX_BYTES + 1)]
        with patch.object(crawler.requests, 'get', return_value=response) as get:
            with self.assertRaises(ValueError):
                crawler.fetch_page('BLOG', 0)
            self.assertEqual(get.call_args.args[0], crawler.API_URL)
            self.assertFalse(get.call_args.kwargs['allow_redirects'])
            self.assertEqual(get.call_args.kwargs['params']['limit'], 16)
            self.assertEqual(get.call_args.kwargs['headers']['Referer'], crawler.URL + '?channel=BLOG')
            self.assertEqual(set(get.call_args.kwargs['headers']), {'User-Agent', 'Accept', 'Origin', 'Referer'})
        response.status_code = 302
        with patch.object(crawler.requests, 'get', return_value=response), self.assertRaises(RuntimeError):
            crawler.fetch_page('BLOG', 0)

    def test_all_pages_and_both_channels_before_save(self):
        clip = {**ROW, 'id': 3, 'channel': 'BLOG_CLIP'}
        pages = [
            {'page': 0, 'has_more': True, 'total_pages': 2, 'total_count': 1, 'objects': [ROW]},
            {'page': 1, 'has_more': True, 'total_pages': 3, 'total_count': 1, 'objects': [{**ROW, 'id': 2}]},
            {'page': 2, 'has_more': False, 'total_pages': 3, 'total_count': 0, 'objects': []},
            {'page': 0, 'has_more': False, 'objects': [clip]},
        ]
        with patch.object(crawler, 'fetch_page', side_effect=pages) as fetch, patch.object(crawler.time, 'sleep') as sleep:
            campaigns = crawler.collect()
        self.assertEqual([x.source_campaign_id for x in campaigns], ['1462459', '2', '3'])
        self.assertEqual(len({x.collected_at for x in campaigns}), 1)
        self.assertEqual(fetch.call_args_list[-1].args, ('BLOG_CLIP', 0))
        self.assertEqual(sleep.call_count, 3)

    def test_offset_overlap_deduplicates_with_latest_metadata(self):
        pages = [
            {'page': 0, 'has_more': True, 'objects': [ROW]},
            {'page': 1, 'has_more': False, 'objects': [{**ROW, 'applicantCount': 5}, {**ROW, 'id': 2}]},
            {'page': 0, 'has_more': False, 'objects': [{**ROW, 'id': 3, 'channel': 'BLOG_CLIP'}]},
        ]
        with patch.object(crawler, 'fetch_page', side_effect=pages), patch.object(crawler.time, 'sleep'):
            campaigns = crawler.collect()
        self.assertEqual(len(campaigns), 3)
        self.assertEqual(campaigns[0].apply_count, 5)

    def test_incomplete_or_changed_pages_never_connect_db(self):
        bad = [
            {'page': 1, 'has_more': False, 'objects': [ROW]},
            {'page': 0, 'has_more': 'false', 'objects': [ROW]},
            {'page': 0, 'has_more': True, 'objects': []},
            {'page': 0, 'has_more': False, 'objects': []},
            {'page': 0, 'has_more': False, 'objects': [ROW, ROW]},
            {'page': 0, 'has_more': False, 'objects': [{**ROW, 'channel': 'INSTAGRAM'}]},
            {'page': 0, 'has_more': False, 'objects': [{**ROW, 'id': True}]},
            {'page': 0, 'has_more': False, 'objects': [{**ROW, 'id': n + 1} for n in range(17)]},
        ]
        for payload in bad:
            with self.subTest(payload=payload), patch.object(crawler, 'fetch_page', return_value=payload), patch.object(crawler, 'get_database_connection') as db:
                with self.assertRaises(ValueError):
                    crawler.get_reviewnote_public_data(dry_run=False)
                db.assert_not_called()

    def test_later_page_failure_and_page_bound_preserve_previous_snapshot(self):
        first = {'page': 0, 'has_more': True, 'objects': [ROW]}
        for sequence, max_pages in [([first, RuntimeError('HTTP 429')], 600), ([first], 1),
                                    ([first, {**first, 'page': 1}], 600),
                                    ([{**first, 'has_more': False}, RuntimeError('HTTP 403')], 600)]:
            with patch.object(crawler, 'fetch_page', side_effect=sequence), patch.object(crawler, 'MAX_PAGES', max_pages), patch.object(crawler.time, 'sleep'), patch.object(crawler, 'get_database_connection') as db:
                with self.assertRaises((ValueError, RuntimeError)):
                    crawler.get_reviewnote_public_data(dry_run=False)
                db.assert_not_called()


if __name__ == '__main__':
    unittest.main()
