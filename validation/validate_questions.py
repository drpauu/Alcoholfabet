#!/usr/bin/env python3
"""Validate the Pau & Tecla approved question bank without external packages."""
from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "data" / "questions_approved.json"
POOLS = {"PAU", "TECLA", "TECLA_PAU", "PAU_TECLA", "TP"}


def words(text: str) -> list[str]:
    return [w for w in re.split(r"\s+", text.strip()) if w]


def main() -> int:
    data = json.loads(PATH.read_text(encoding="utf-8"))
    errors: list[str] = []
    ids: set[str] = set()
    questions: set[tuple[str, str]] = set()
    counts: Counter[str] = Counter()

    for index, item in enumerate(data):
        prefix = f"item {index} ({item.get('id', 'missing-id')})"
        required = {
            "id", "pool", "topic", "difficulty", "questionCa", "answerCa",
            "reviewStatus", "factualReviewed", "languageReviewed", "active",
            "sourceType", "notes", "contentVersion"
        }
        missing = required - item.keys()
        if missing:
            errors.append(f"{prefix}: missing {sorted(missing)}")
            continue
        if item["id"] in ids:
            errors.append(f"{prefix}: duplicate id")
        ids.add(item["id"])
        if item["pool"] not in POOLS:
            errors.append(f"{prefix}: invalid pool {item['pool']}")
        counts[item["pool"]] += 1
        answer_count = len(words(item["answerCa"]))
        if not 1 <= answer_count <= 5:
            errors.append(f"{prefix}: answer has {answer_count} words")
        if not item["questionCa"].endswith("?"):
            errors.append(f"{prefix}: question must end with ?")
        key = (item["pool"], item["questionCa"].casefold())
        if key in questions:
            errors.append(f"{prefix}: duplicate question in pool")
        questions.add(key)
        if item["reviewStatus"] == "APPROVED":
            if not item["active"] or not item["factualReviewed"] or not item["languageReviewed"]:
                errors.append(f"{prefix}: approved question is not fully reviewed and active")

    if errors:
        print("VALIDATION FAILED")
        for error in errors:
            print(f"- {error}")
        return 1

    print("VALIDATION OK")
    print(f"Questions: {len(data)}")
    for pool in sorted(POOLS):
        print(f"{pool}: {counts[pool]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
