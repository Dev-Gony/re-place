import copy
import json
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'crawlers'))
import inflexer_revu_crawler as crawler

PAYLOAD = json.loads((ROOT / 'test/fixtures/inflexer_revu.json').read_text(encoding='utf-8'))
NOW = datetime(2026, 10, 7, 8, tzinfo=timezone.utc)


class InflexerRevuTests(unittest.TestCase):
    def test_dates_provenance_missing_counts_and_reward(self):
        visit, shipping = crawler.parse_payload(PAYLOAD, observed_at=NOW)
        self.assertEqual(visit.platform, '레뷰(인플렉서)')
        self.assertEqual(visit.deadline_at, '2026-10-07T23:59:59+09:00')
        self.assertEqual(visit.collected_at, NOW.isoformat())
        self.assertIsNone(visit.apply_count)
        self.assertIsNone(visit.recruit_count)
        self.assertEqual(visit.region, '강남')  # preserve the original title label
        self.assertEqual(visit.to_record()['provided_value_amount'], 200000)
        self.assertEqual(shipping.campaign_type, '배송형')
        self.assertEqual(shipping.region, '배송')

    def test_missing_application_deadline_never_uses_review_deadline(self):
        payload = copy.deepcopy(PAYLOAD)
        payload['result'][0]['apl_due_dt'] = None
        self.assertIsNone(crawler.parse_payload(payload)[0].deadline_at)
        payload['result'][0]['title'] = '[중구] 구분 불가 표본'
        self.assertIsNone(crawler.parse_payload(payload)[0].region)

    def test_other_platforms_are_never_imported(self):
        payload = copy.deepcopy(PAYLOAD)
        for row in payload['result']:
            row['domain'] = '리뷰노트'
            row['url'] = 'https://www.reviewnote.co.kr/'
        self.assertEqual(crawler.parse_payload(payload), [])

    def test_http_contract_and_result_limits(self):
        with self.assertRaises(crawler.ResultLimitError):
            crawler.parse_payload({'is_valid':False,'num_result':3642,'result':[]})
        for payload in ([], {}, {'is_valid':True,'num_result':3,'result':PAYLOAD['result']},
                        {'is_valid':False,'num_result':0,'result':[]},
                        {'is_valid':1,'num_result':0,'result':[]}):
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                crawler.parse_payload(payload)

    def test_invalid_metadata_is_rejected(self):
        invalid = (
            ('url','https://evil.test/campaign/1'), ('url','https://www.revu.net/campaign/1?x=y'),
            ('title',''), ('apl_due_dt','2026-02-30'), ('apl_due_dt','2026-09-01'),
            ('media','IP_'), ('type','NEW'), ('point','unknown'), ('offer',123),
        )
        for key,value in invalid:
            payload = copy.deepcopy(PAYLOAD)
            payload['result'][0][key] = value
            with self.subTest(key=key,value=value), self.assertRaises(ValueError):
                crawler.parse_payload(payload)

    def test_duplicate_id_in_response_fails(self):
        payload = copy.deepcopy(PAYLOAD)
        payload['result'][1] = payload['result'][0]
        with self.assertRaises(ValueError):
            crawler.parse_payload(payload)

    def test_public_endpoint_only_size_cap_and_redirects(self):
        session = MagicMock()
        response = session.get.return_value.__enter__.return_value
        response.status_code = 200
        response.iter_content.return_value = [json.dumps(PAYLOAD).encode()]
        self.assertEqual(len(crawler.request_rows(session,'search',{})),2)
        self.assertFalse(session.get.call_args.kwargs['allow_redirects'])
        with self.assertRaises(ValueError):
            crawler.request_rows(session,'reload',{})
        response.iter_content.return_value = [b'x'*(crawler.MAX_BYTES+1)]
        with self.assertRaises(ValueError):
            crawler.request_rows(session,'search',{})
        for status in (302,429):
            response.status_code = status
            response.raise_for_status.side_effect = RuntimeError('HTTP failure') if status==429 else None
            with self.assertRaises(RuntimeError):
                crawler.request_rows(session,'search',{})

    def test_partitions_deduplicate_and_refine_limit(self):
        rows = crawler.parse_payload(PAYLOAD)
        with patch.object(crawler,'REGIONS',('서울',)), patch.object(crawler,'SUBREGIONS',{'서울':('강남','노원')}), \
             patch.object(crawler,'CATEGORIES',('FD_',)), \
             patch.object(crawler,'request_rows',side_effect=[crawler.ResultLimitError(),rows,rows,rows,rows]) as fetch:
            result = crawler.collect(MagicMock(),sleep_between=False)
        self.assertEqual(len(result),2)
        queries = [call.args[2].get('query') for call in fetch.call_args_list]
        self.assertEqual(queries[:3],['서울','서울 강남','서울 노원'])
        self.assertEqual(fetch.call_args_list[-1].args[1],'press')

    def test_unresolved_limit_empty_all_http_failure_and_budget_fail(self):
        for behavior in (crawler.ResultLimitError(), RuntimeError('HTTP failure'), []):
            with patch.object(crawler,'REGIONS',('부산',)), patch.object(crawler,'CATEGORIES',()), \
                 patch.object(crawler,'request_rows',side_effect=behavior if isinstance(behavior,Exception) else None,
                              return_value=behavior):
                with self.assertRaises(RuntimeError):
                    crawler.collect(MagicMock(),sleep_between=False)
        with patch.object(crawler,'MAX_REQUESTS',1), patch.object(crawler,'request_rows',return_value=[]):
            with self.assertRaises(RuntimeError):
                crawler.collect(MagicMock(),sleep_between=False)

    def test_dry_run_inactive_registry_partial_failure_never_writes(self):
        rows = crawler.parse_payload(PAYLOAD)
        connection = MagicMock()
        connection.__enter__.return_value.cursor.return_value.__enter__.return_value.fetchone.return_value = None
        with patch.object(crawler,'collect',return_value=rows), \
             patch.object(crawler,'get_database_connection',return_value=connection) as db, \
             patch.object(crawler,'upsert_campaigns') as upsert:
            crawler.get_inflexer_revu_data()
            db.assert_not_called()
            with self.assertRaises(RuntimeError):
                crawler.get_inflexer_revu_data(dry_run=False)
            upsert.assert_not_called()
        with patch.object(crawler,'collect',side_effect=RuntimeError('partial')), \
             patch.object(crawler,'get_database_connection') as db:
            with self.assertRaises(RuntimeError):
                crawler.get_inflexer_revu_data(dry_run=False)
            db.assert_not_called()

    def test_active_registry_saves_complete_result(self):
        rows = crawler.parse_payload(PAYLOAD)
        connection = MagicMock()
        connection.__enter__.return_value.cursor.return_value.__enter__.return_value.fetchone.return_value = (1,)
        with patch.object(crawler,'collect',return_value=rows), \
             patch.object(crawler,'get_database_connection',return_value=connection), \
             patch.object(crawler,'upsert_campaigns',return_value=2) as upsert:
            crawler.get_inflexer_revu_data(dry_run=False)
            upsert.assert_called_once_with(connection.__enter__.return_value,rows)

    def test_manual_hosted_collection_is_not_a_pr_secret_test(self):
        workflow = (ROOT / '.github/workflows/collect-inflexer-revu.yml').read_text(encoding='utf-8')
        self.assertIn('workflow_dispatch:', workflow)
        self.assertNotIn('pull_request:', workflow)
        self.assertIn("inputs.write && secrets.PRODUCTION_DATABASE_URL || ''", workflow)
        self.assertIn('group: re-place-campaign-collection', workflow)
        self.assertIn('default: false', workflow)


if __name__ == '__main__':
    unittest.main()
