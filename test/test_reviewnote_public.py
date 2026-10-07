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
               'city': '노원구', 'sido': {'name': '서울'}}
        campaign = crawler.parse_listing(html([row]), now=NOW)[0]
        self.assertEqual(campaign.region, '서울/노원구')
        self.assertEqual(campaign.media_type, '블로그+숏폼')
        self.assertEqual(campaign.campaign_type, '방문형')

    def test_excludes_expired_and_nonblog(self):
        expired = {**ROW, 'id': 2, 'applyEndAt': '2026-10-01T14:59:59Z'}
        instagram = {**ROW, 'id': 3, 'channel': 'INSTAGRAM'}
        self.assertEqual(len(crawler.parse_listing(html([ROW, expired, instagram]), now=NOW)), 1)

    def test_payback_ui_status_rule(self):
        payback = {**ROW, 'id': 2, 'sort': 'PAYBACK', 'status': 'PROGRESS'}
        closed = {**ROW, 'id': 3, 'status': 'PROGRESS'}
        self.assertEqual(len(crawler.parse_listing(html([ROW, payback, closed]), now=NOW)), 2)

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

    def test_bounded_public_html_only(self):
        response = MagicMock()
        response.__enter__.return_value = response
        response.status_code = 200
        response.iter_content.return_value = [b'x' * (crawler.MAX_BYTES + 1)]
        with patch.object(crawler.requests, 'get', return_value=response) as get:
            with self.assertRaises(ValueError):
                crawler.collect()
            self.assertEqual(get.call_args.args[0], crawler.URL)
            self.assertFalse(get.call_args.kwargs['allow_redirects'])
        response.status_code = 302
        with patch.object(crawler.requests, 'get', return_value=response), self.assertRaises(RuntimeError):
            crawler.collect()


if __name__ == '__main__':
    unittest.main()
