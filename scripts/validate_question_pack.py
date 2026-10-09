#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "questions_5000.jsonl"
EXPECTED = {"PAU": 1300, "TECLA": 1300, "TECLA_PAU": 750, "PAU_TECLA": 750, "TP": 900}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", s)).strip()


def words(s: str) -> int:
    s = re.sub(r"\([^)]*\)", lambda m: m.group(0).replace(" ", ""), s.strip())
    return len([x for x in re.split(r"\s+", s) if x])

rows = []
with PATH.open(encoding="utf-8") as fh:
    for line_no, line in enumerate(fh, 1):
        if line.strip():
            try:
                rows.append(json.loads(line))
            except Exception as exc:
                raise SystemExit(f"JSON invàlid a la línia {line_no}: {exc}")

errors: list[str] = []
if len(rows) != 5000:
    errors.append(f"S'esperaven 5000 files i n'hi ha {len(rows)}")

counts = Counter(r.get("pool") for r in rows)
if counts != Counter(EXPECTED):
    errors.append(f"Distribució incorrecta: {dict(counts)}")

ids = [r.get("id") for r in rows]
if len(set(ids)) != len(ids):
    errors.append("Hi ha IDs duplicats")

within_pool = [(r.get("pool"), norm(r.get("question_ca", ""))) for r in rows]
if len(set(within_pool)) != len(within_pool):
    errors.append("Hi ha textos de pregunta duplicats dins de la mateixa pila")

bad_phrases = [" a el ", " a els ", " de el ", " de els ", "s'anomenal", "identifical"]
for r in rows:
    rid = r.get("id", "?")
    q = r.get("question_ca", "")
    a = r.get("answer_ca", "")
    if not q.endswith("?"):
        errors.append(f"{rid}: la pregunta no acaba amb ?")
    wc = words(a)
    if wc < 1 or wc > 5:
        errors.append(f"{rid}: resposta de {wc} paraules: {a}")
    if not 1 <= int(r.get("difficulty", 0)) <= 7:
        errors.append(f"{rid}: dificultat invàlida")
    if not r.get("fact_id"):
        errors.append(f"{rid}: falta fact_id")
    if not str(r.get("source_url", "")).startswith("https://"):
        errors.append(f"{rid}: source_url invàlida")
    low = " " + q.lower() + " "
    for bad in bad_phrases:
        if bad in low:
            errors.append(f"{rid}: patró lingüístic sospitós: {bad.strip()}")

facts_by_pool = defaultdict(Counter)
for r in rows:
    facts_by_pool[r["pool"]][r["fact_id"]] += 1

print(f"OK: {len(rows)} preguntes")
print("Distribució:", dict(counts))
print("Factes únics:", len({r['fact_id'] for r in rows}))
print("Màxim de variants per pila:", {p: max(c.values()) for p, c in facts_by_pool.items()})

if errors:
    print(f"ERRORS: {len(errors)}")
    for e in errors[:100]:
        print("-", e)
    raise SystemExit(1)
print("VALIDACIÓ ESTRUCTURAL SUPERADA")
