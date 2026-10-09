import copy,importlib.util,json,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('bank_audit',Path('scripts/audit_question_bank.py'))
audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
class AuditTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.rows=[json.loads(x)for x in Path('data/question-bank/questions_5000.jsonl').read_text().splitlines()]
 def test_every_canonical_row_is_retained(self):
  reviewed,issues=audit.audit(self.rows)
  self.assertEqual(len(reviewed),5000);self.assertEqual(len(issues),404)
  for old,new in zip(self.rows,reviewed):
   for field in ['id','question_ca','answer_ca','difficulty','pool','fact_id']:self.assertEqual(old[field],new[field])
 def test_encoding_issue_quarantines_other_pool_variants(self):
  rows=copy.deepcopy(self.rows);rows[0]['question_ca']=rows[0]['question_ca'].replace('Quin','Quin�');reviewed,issues=audit.audit(rows)
  variants=[r for r in reviewed if r['fact_id']==rows[0]['fact_id']]
  self.assertGreater(len(variants),1);self.assertTrue(all(not r['active']for r in variants))
 def test_duplicate_id_and_text_are_rejected(self):
  rows=copy.deepcopy(self.rows);rows[1]['id']=rows[0]['id']
  with self.assertRaisesRegex(AssertionError,'Duplicate ID'):audit.audit(rows)
  rows=copy.deepcopy(self.rows);rows[1]['question_ca']=rows[0]['question_ca']
  with self.assertRaisesRegex(AssertionError,'Duplicate text'):audit.audit(rows)
 def test_obsolete_currency_and_capital_ambiguity_are_inactive(self):
  reviewed,_=audit.audit(self.rows)
  for r in reviewed:
   if r['fact_id'].endswith('_currency')and r['answer_ca']in audit.OLD_CURRENCIES:self.assertFalse(r['active'])
   if r['fact_id'].startswith('geo_nld_')and r['fact_id'].endswith(('capital','country_by_capital')):self.assertFalse(r['active'])
if __name__=='__main__':unittest.main()
