import sys
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, patch
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "crawlers"))
import gangnam_crawler as crawler

HTML = (ROOT / "test/fixtures/gangnam_list.html").read_text(encoding="utf-8")
END = "<li class='list-no-item'>조회된 캠페인이 없습니다.</li>"
NOW = datetime(2026, 10, 7, 12, tzinfo=ZoneInfo("Asia/Seoul"))


def response(html):
    result = MagicMock()
    result.text = html
    return result


class GangnamPublicListTests(unittest.TestCase):
    def test_live_shape_and_seoul_deadline(self):
        rows, last = crawler.parse_list_page(HTML, now=NOW)
        self.assertFalse(last)
        visit, shipping = rows
        self.assertEqual(visit.source_campaign_id, "2321704")
        self.assertEqual(visit.region, "인천 연수")
        self.assertEqual(visit.apply_count, 0)
        self.assertEqual(visit.recruit_count, 10)
        self.assertEqual(visit.media_type, "블로그")
        self.assertEqual(visit.deadline_at, "2026-10-15T23:59:59+09:00")
        self.assertEqual(visit.to_record()["provided_value_amount"], 68000)
        self.assertEqual(shipping.apply_count, 2083)
        self.assertEqual(shipping.region, "배송")
        self.assertEqual(shipping.deadline_at, "2026-11-01T23:59:59+09:00")

    def test_missing_data_and_multiple_media_are_unknown(self):
        html = HTML.replace('<em class="blog">Blog</em>', '<em>Blog</em><em>Instagram</em>')
        html = html.replace("8일 남음", "마감 미정").replace("신청 0", "신청 집계 전")
        row = crawler.parse_list_page(html, now=NOW)[0][0]
        self.assertIsNone(row.media_type)
        self.assertIsNone(row.deadline_at)
        self.assertIsNone(row.apply_count)

    def test_only_explicit_empty_marker_is_end(self):
        self.assertEqual(crawler.parse_list_page(END), ([], True))
        for html in ("", "<html>로그인</html>", '<li class="list-no-item">오류</li>', HTML + END):
            with self.subTest(html=html), self.assertRaises(RuntimeError):
                crawler.parse_list_page(html)

    def test_changed_id_and_external_links_fail(self):
        for html in (HTML.replace('data-product="2321704"', 'data-product="1"'), HTML.replace('/cp/?id=2321704', 'https://evil.test/cp/?id=2321704')):
            with self.assertRaises(RuntimeError):
                crawler.parse_list_page(html)

    def test_today_deadline_and_utc_input_use_seoul_day(self):
        utc_now = datetime(2026, 10, 6, 16, tzinfo=ZoneInfo("UTC"))
        today = crawler.parse_list_page(HTML.replace("8일 남음", "오늘 마감"), now=utc_now)[0][0]
        self.assertEqual(today.deadline_at, "2026-10-07T23:59:59+09:00")
        sibling_badge = HTML.replace('<span class="dday"><em class="day_c">8일 남음</em></span>', '<em class="today">오늘마감</em>')
        today = crawler.parse_list_page(sibling_badge, now=utc_now)[0][0]
        self.assertEqual(today.deadline_at, "2026-10-07T23:59:59+09:00")

    def test_pagination_deduplicates_overlap_and_requires_end(self):
        second = HTML.replace("2315743", "9999999")
        session = MagicMock()
        session.get.side_effect = [response(HTML), response(second), response(END)]
        rows = crawler.collect_all(session, max_pages=3, sleep_between=False, now=NOW)
        self.assertEqual(len(rows), 3)
        self.assertEqual([call.kwargs["params"]["rpage"] for call in session.get.call_args_list], [0, 1, 2])

    def test_repeat_limit_first_empty_and_http_failure(self):
        for pages, limit in (([HTML, HTML], 2), ([HTML], 1), ([END], 1)):
            session = MagicMock()
            session.get.side_effect = [response(page) for page in pages]
            with self.assertRaises(RuntimeError):
                crawler.collect_all(session, max_pages=limit, sleep_between=False)
        session = MagicMock()
        session.get.return_value.raise_for_status.side_effect = RuntimeError("HTTP failure")
        with self.assertRaises(RuntimeError):
            crawler.collect_all(session, max_pages=1, sleep_between=False)

    def test_dry_run_never_connects_and_inactive_source_never_writes(self):
        rows = crawler.parse_list_page(HTML, now=NOW)[0]
        with patch.object(crawler, "collect_all", return_value=rows), patch.object(crawler, "get_database_connection") as connect:
            self.assertEqual(crawler.get_gangnam_data(), rows)
            connect.assert_not_called()
            connect.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value.fetchone.return_value = None
            with patch.object(crawler, "upsert_campaigns") as upsert, self.assertRaises(RuntimeError):
                crawler.get_gangnam_data(dry_run=False)
            upsert.assert_not_called()

    def test_active_source_writes_after_complete_collection(self):
        rows = crawler.parse_list_page(HTML, now=NOW)[0]
        with patch.object(crawler, "collect_all", return_value=rows), patch.object(crawler, "get_database_connection"), patch.object(crawler, "upsert_campaigns", return_value=2) as upsert:
            crawler.get_gangnam_data(dry_run=False)
            self.assertEqual(upsert.call_args.args[1], rows)

    def test_partial_collection_never_opens_database(self):
        with patch.object(crawler, "collect_all", side_effect=RuntimeError("page limit")), patch.object(crawler, "get_database_connection") as connect:
            with self.assertRaises(RuntimeError):
                crawler.get_gangnam_data(dry_run=False)
            connect.assert_not_called()

    def test_duplicate_ids_in_one_page_fail(self):
        session = MagicMock()
        session.get.return_value = response(HTML.replace("2315743", "2321704"))
        with self.assertRaises(RuntimeError):
            crawler.collect_all(session, max_pages=1, sleep_between=False)

    def test_blank_tail_requires_confirmation_and_middle_gap_fails(self):
        session = MagicMock()
        session.get.side_effect = [response(HTML), response(""), response(" ")]
        rows = crawler.collect_all(session, max_pages=3, sleep_between=False)
        self.assertEqual(len(rows), 2)
        self.assertEqual(session.get.call_count, 3)
        session.get.side_effect = [response(HTML), response(""), response(HTML)]
        with self.assertRaises(RuntimeError):
            crawler.collect_all(session, max_pages=3, sleep_between=False)


if __name__ == "__main__":
    unittest.main()
