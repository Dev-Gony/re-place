import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = (ROOT / 'app' / 'page.tsx').read_text(encoding='utf-8')


class SearchQueryContractTests(unittest.TestCase):
    def test_search_filters_use_bound_parameters(self):
        self.assertIn('addFilter("title ILIKE ?",', PAGE)
        self.assertIn('addFilter("platform = ANY(?::text[])", platforms)', PAGE)
        self.assertIn('addFilter("region_group = ?", regionGroup)', PAGE)
        self.assertIn('addFilter("region ILIKE ?",', PAGE)

    def test_user_values_are_not_interpolated_into_sql_templates(self):
        sql_blocks = re.findall(r'queryDb(?:<[^>]+>)?\\(\\s*`([^`]+)`', PAGE, re.S)
        combined = '\n'.join(sql_blocks)
        for name in ('q', 'region', 'regionGroup', 'media', 'campaignType', 'reward'):
            self.assertNotIn('${' + name + '}', combined)

    def test_page_size_and_offset_are_bound(self):
        self.assertIn('LIMIT ${limitParam} OFFSET ${offsetParam}', PAGE)
        self.assertIn('pageValues', PAGE)


if __name__ == '__main__':
    unittest.main()
