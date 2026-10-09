#!/usr/bin/env python3
"""Second, reproducible audit. Never rewrite canonical question/answer text.
Suspicious facts quarantine every formulation, across all pools. Not a claim of
exhaustive human factual certification. Reviewed exceptions live alongside code.
"""
import argparse,csv,hashlib,json,re,unicodedata
from collections import Counter,defaultdict
from pathlib import Path

EXPECTED={'PAU':1300,'TECLA':1300,'TECLA_PAU':750,'PAU_TECLA':750,'TP':900}
# Sources and review evidence: data/question-bank/REVIEW.md.
FACT_ISSUES={
 'cs_serial_graph':'AMBIGUITY: manca especificar serialitzabilitat per conflictes.',
 'cs_4nf':'AMBIGUITY: manca distingir dependències multivaluades amb determinant superclau.',
 'bio_window_hamming':'AMBIGUITY: diverses finestres redueixen els lòbuls laterals respecte de la rectangular.',
 'cult_delta_ebre':'AMBIGUITY: el delta inclou el Baix Ebre i el Montsià; no hi ha una comarca única inequívoca.',
 'cult_castell_neta':'AMBIGUITY: cal precisar el castell i l’estructura de reforç habitual.',
 'ast_olympus':'AMBIGUITY: «més gran» no precisa alçària, volum o superfície del volcà.',
 'geo_kaz_calling':'FACTUAL: +76 no és el prefix internacional del Kazakhstan; cal distingir +7 de la numeració nacional.',
 'geo_ury_currency':'FACTUAL: UYI és una unitat indexada, no la moneda principal (UYU).',
 'sit_recent_elements':'TEMPORAL: «més recent» i el recorregut històric no tenen una data de referència en la pregunta.',
 'mus_slur':'AMBIGUITY: una lligadura d’expressió indica articulació, no qualsevol línia de fraseig.',
}
# This official page and Ball de Bastons were accessible and checked. Other
# detailed element pages returned 403/503/timeouts; do not pretend verified.
VERIFIED_SITGES=set('sit_sitges_band sit_bastons_dancers sit_penedes_link sit_bastons_tunes sit_giants_types sit_gitanes_names sit_cobles sit_vinyet_celebrations sit_castellers sit_devil_groups sit_old_grallers sit_agricultural_rituals sit_fire_beasts sit_bastons_groups sit_giants_pairs sit_abps sit_gitanes_groups sit_bastons_names sit_oldest_continuity sit_grallers_1971 sit_bastons_instrument sit_first_review sit_devil_names'.split())
COMPLEX_CAPITALS={'nld','ben','mys','tza','civ','swz','bol','zaf','lka','nru','isr','pse','yem','idn','bdi','lby','sdn','ssd'}
OLD_CURRENCIES={'BYR','VEF','ZMK','MRO','STD','SLL','HRK','BGN','ZWL','CUC'}

def norm(s):
 s=''.join(c for c in unicodedata.normalize('NFKD',s)if not unicodedata.combining(c))
 return re.sub(r'\s+',' ',re.sub(r'[^a-z0-9]+',' ',s.lower())).strip()

def audit(rows):
 assert len(rows)==5000 and Counter(r['pool']for r in rows)==Counter(EXPECTED),'Wrong counts'
 assert len({r['id']for r in rows})==5000,'Duplicate ID'
 assert len({(r['pool'],norm(r['question_ca']))for r in rows})==5000,'Duplicate text'
 issues=defaultdict(set)
 answers=defaultdict(set)
 for r in rows:
  f=r['fact_id'];q=r['question_ca'];a=r['answer_ca'];text=q+' '+a
  answers[f].add(norm(a))
  assert 1<=len(a.split())<=5 and len(a.split())==r['answer_word_count'],'Answer words'
  assert 1<=r['difficulty']<=7 and r['variant_no']>=1 and r['source_url'].startswith('https://'),'Invalid metadata'
  if not q.endswith('?')or re.search(r'\s+[?,.;:]|\?\?|\s{2,}',q):issues[f].add('LANGUAGE: puntuació o espais sospitosos.')
  if any(c in text for c in ['�','Ã','Â','â€','\x00'])or re.search(r'[\u0300-\u036f]',text):issues[f].add('ENCODING: caràcters o normalització sospitosos.')
  if re.search(r"\b(a el|a els|de el|de els|s'anomenal|identifical)\b",q,re.I):issues[f].add('LANGUAGE: contracció o apòstrof incorrecte.')
  if re.search(r'\b(president|primera? ministre|rècord|vigent)\b',q,re.I):issues[f].add('TEMPORAL: càrrec, rècord o vigència sense data tancada.')
  if re.search(r'\bripple\b',q):issues[f].add('TERMINOLOGY: anglicisme sense terme català ni context d’ondulació.')
  if f in FACT_ISSUES:issues[f].add(FACT_ISSUES[f])
  if f.startswith('geo_'):
   country=f.split('_')[1]
   if f.endswith(('_capital','_country_by_capital'))and country in COMPLEX_CAPITALS:issues[f].add('AMBIGUITY: capital i seu del govern diferents o capitals múltiples; falta precisar la funció.')
   if country=='lao':issues[f].add('LANGUAGE: el nom de l’estat en català necessita revisió («Lao»).')
   if f.endswith('_currency')and a in OLD_CURRENCIES:issues[f].add('TEMPORAL: codi ISO de moneda retirat o substituït; no activar sense revisió.')
  if f.startswith('gen_codon_')and f.split('_')[-1]in {'UGA','AGA','AGG','AUA'}:issues[f].add('AMBIGUITY: cal especificar el codi genètic estàndard; hi ha codis alternatius.')
  if r['topic']=='Sitges'and f not in VERIFIED_SITGES:issues[f].add('SOURCE_PENDING: pàgina oficial detallada inaccessible o fet encara no confirmat en la font consultada.')
 for f,a in answers.items():
  if len(a)>1:issues[f].add('INCONSISTENT: variants del mateix fet amb respostes diferents.')
 reviewed=[];csv_rows=[]
 for original in rows:
  r=dict(original);reasons=sorted(issues[r['fact_id']]);r['review_note']=' | '.join(reasons)
  # Capital -> country is the same relation as country -> capital. Preserve
  # original fact_id while adding a stricter semantic exclusion key.
  r['semantic_key']=re.sub(r'_country_by_capital$','_capital',r['fact_id'])
  if reasons:
   r.update(review_status='DRAFT',active=False,factual_checked=False,language_checked=False)
   csv_rows.append({'id':r['id'],'fact_id':r['fact_id'],'pool':r['pool'],'review_status':'DRAFT','reason':r['review_note'],'source_url':r['source_url']})
  reviewed.append(r)
 return reviewed,csv_rows

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('input',type=Path);p.add_argument('--output',type=Path,default=Path('data/question-bank/reviewed_5000.jsonl'));p.add_argument('--issues',type=Path,default=Path('question_review_issues.csv'));args=p.parse_args()
 raw=args.input.read_bytes();rows=[json.loads(line)for line in raw.splitlines()if line.strip()];reviewed,issues=audit(rows)
 args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n'for r in reviewed));args.output.chmod(0o600)
 with args.issues.open('w',newline='')as fh:
  w=csv.DictWriter(fh,fieldnames=['id','fact_id','pool','review_status','reason','source_url']);w.writeheader();w.writerows(issues)
 report={'canonicalSha256':hashlib.sha256(raw).hexdigest(),'reviewedSha256':hashlib.sha256(args.output.read_bytes()).hexdigest(),'read':len(rows),'approved':5000-len(issues),'draft':len(issues),'facts':len({r['fact_id']for r in rows}),'selectionFacts':len({r['semantic_key']for r in reviewed}),'pools':{pool:{'imported':n,'active':sum(r['pool']==pool and r['active']for r in reviewed),'draft':sum(r['pool']==pool and not r['active']for r in reviewed)}for pool,n in EXPECTED.items()},'topics':dict(Counter(r['topic']for r in reviewed)),'issuesByReason':dict(Counter(reason for r in issues for reason in r['reason'].split(' | ')))}
 Path('data/question-bank/AUDIT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
