import copy
import importlib.util
import json
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('workbook_audit', Path('scripts/prepare_1000_bank.py'))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

class WorkbookAuditTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows = audit.read_excel(Path('questions_1000.xlsx'))
        cls.old = [json.loads(line) for line in Path('data/question-bank/reviewed_5000.jsonl').read_text().splitlines()]

    def test_original_content_preserved_and_review_deterministic(self):
        reviewed = audit.review(self.rows, self.old)
        self.assertEqual(reviewed, audit.review(self.rows, self.old))
        self.assertEqual(sum(row['active'] for row in reviewed), 913)
        for source, row in zip(self.rows, reviewed):
            for field in ['id', 'pool', 'topic', 'domain', 'question_ca', 'answer_ca', 'source_hint', 'notes']:
                self.assertEqual(source[field], row[field])
            self.assertEqual(source['fact_id'], row['original_fact_id'])

    def test_duplicate_text_or_id_is_rejected_before_database_changes(self):
        for field in ['id', 'question_ca']:
            changed = copy.deepcopy(self.rows)
            changed[1][field] = changed[0][field]
            with self.assertRaises(AssertionError): audit.review(changed, self.old)

    def test_unreviewed_source_flags_and_overlong_answers_rejected(self):
        for field, value in [('review_status', 'APPROVED'), ('active', '1'), ('answer_ca', 'una resposta amb més de cinc paraules')]:
            changed = copy.deepcopy(self.rows)
            changed[0][field] = value
            with self.assertRaises(AssertionError): audit.review(changed, self.old)

    def test_known_errors_remain_inactive_without_silent_correction(self):
        reviewed = {row['id']: row for row in audit.review(self.rows, self.old)}
        for ident in ['NEW26-PAU-064', 'NEW26-TECLA-096', 'NEW26-TECLA-178', 'NEW26-TECLA-179', 'NEW26-TP-185']:
            self.assertFalse(reviewed[ident]['active'])
            self.assertTrue(reviewed[ident]['review_note'])

if __name__ == '__main__': unittest.main()
