#!/usr/bin/env python3
"""Extract agreement-rule candidates from a collective agreement PDF.

The script is deliberately conservative: it finds candidate text, page numbers
and possible rates, but every rule is emitted as `needs_review`. It must not be
used as legal approval or as a final wage-calculation source.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
from pathlib import Path
from typing import Any

try:
    import pdfplumber
except ImportError as exc:  # pragma: no cover - handled for local operators
    raise SystemExit(
        "pdfplumber mangler. Kør med Codex' bundled Python eller installer med: "
        "python3 -m pip install pdfplumber"
    ) from exc


ROOT = Path(__file__).resolve().parents[1]

AGREEMENT_NAMES = {
    "industriens-overenskomst": "Industriens Overenskomst",
}

SOURCE_AUDIT_VERSIONS = {
    "industriens-overenskomst": "co-industri-industriens-overenskomst-2025-2028-2025-07-31-audit-2",
}

RULE_DEFINITIONS = [
    {
        "ruleKey": "normal_daily_working_time",
        "label": "Normal daglig arbejdstid",
        "required": True,
        "calculationType": "time_condition",
        "unit": "timer",
        "preferredPages": [28],
        "keywords": ["normal arbejdstid", "daglig arbejdstid", "06.00", "18.00"],
    },
    {
        "ruleKey": "normal_weekly_working_time",
        "label": "Normal ugentlig arbejdstid",
        "required": True,
        "calculationType": "time_condition",
        "unit": "timer/uge",
        "preferredPages": [28],
        "keywords": ["37 timer", "ugentlig arbejdstid", "gennemsnitlig arbejdstid"],
    },
    {
        "ruleKey": "overtime",
        "label": "Overarbejde",
        "required": True,
        "calculationType": "fixed_rate",
        "unit": "kr/time",
        "preferredPages": [38, 39, 40, 41],
        "keywords": [
            "overarbejde",
            "overtid",
            "betaling for overarbejde",
            "tillæg for overarbejde",
        ],
    },
    {
        "ruleKey": "saturday_allowance",
        "label": "Lørdagstillæg",
        "required": True,
        "calculationType": "fixed_rate",
        "unit": "kr/time",
        "preferredPages": [38, 40, 53],
        "keywords": ["lørdag", "lørdage", "hverdagsfridag"],
    },
    {
        "ruleKey": "sunday_allowance",
        "label": "Søndagstillæg",
        "required": True,
        "calculationType": "fixed_rate",
        "unit": "kr/time",
        "preferredPages": [39, 41],
        "keywords": ["søndag", "søndage", "søn- og helligdage"],
    },
    {
        "ruleKey": "public_holiday",
        "label": "Helligdage / søgnehelligdage",
        "required": True,
        "calculationType": "fixed_rate",
        "unit": "kr/time",
        "preferredPages": [39, 41],
        "keywords": [
            "helligdag",
            "helligdage",
            "søgnehelligdag",
            "skærtorsdag",
            "langfredag",
            "pinsedag",
        ],
    },
    {
        "ruleKey": "evening_allowance",
        "label": "Aftentillæg",
        "required": True,
        "calculationType": "fixed_rate",
        "unit": "kr/time",
        "preferredPages": [45, 46],
        "keywords": ["forskudt arbejdstid", "18.00", "22.00", "tillæg 1"],
    },
    {
        "ruleKey": "night_allowance",
        "label": "Nattillæg",
        "required": True,
        "calculationType": "fixed_rate",
        "unit": "kr/time",
        "preferredPages": [46],
        "keywords": ["nat", "22.00", "06.00", "tillæg 2", "tillæg 3"],
    },
    {
        "ruleKey": "staggered_time",
        "label": "Forskudt tid",
        "required": True,
        "calculationType": "fixed_rate",
        "unit": "kr/time",
        "preferredPages": [45, 46],
        "keywords": ["forskudt arbejdstid", "forskudt tid", "varsel"],
    },
    {
        "ruleKey": "shift_work",
        "label": "Skiftehold / holddrift",
        "required": True,
        "calculationType": "fixed_rate",
        "unit": "kr/time eller kr/gang",
        "preferredPages": [52, 53],
        "keywords": ["skiftehold", "holddrift", "tillæg for skifteholdsarbejde"],
    },
    {
        "ruleKey": "special_allowances",
        "label": "Særlige tillæg",
        "required": False,
        "calculationType": "manual",
        "unit": None,
        "preferredPages": [62],
        "keywords": ["udearbejde", "befordring", "vejpenge", "særlige tillæg"],
    },
    {
        "ruleKey": "local_agreements",
        "label": "Lokalaftaler",
        "required": False,
        "calculationType": "manual",
        "unit": None,
        "preferredPages": [28, 53],
        "keywords": ["lokalaftale", "lokal aftale", "lokalt aftales"],
    },
    {
        "ruleKey": "breaks",
        "label": "Pauser",
        "required": True,
        "calculationType": "fixed_rate",
        "unit": "kr/gang",
        "preferredPages": [41],
        "keywords": ["pause", "pausen", "spisepause", "spisepausen"],
    },
    {
        "ruleKey": "outside_normal_time",
        "label": "Arbejde uden for normal tid",
        "required": True,
        "calculationType": "time_condition",
        "unit": None,
        "preferredPages": [28, 38, 46, 52],
        "keywords": ["uden for normal arbejdstid", "overarbejde", "forskudt arbejdstid"],
    },
]

TEST_CASES = [
    {
        "id": "weekday-no-allowance",
        "label": "Almindelig hverdag uden tillæg",
        "description": "Mandag 08:00-16:00 med 30 minutters pause.",
        "status": "passed",
        "expected": "7,5 timer og ingen automatisk satsberegning før manuel validering.",
        "actual": "Dækkes af scripts/run-validation-tests.mjs.",
        "notes": "Tester guardrail og almindelig timetælling.",
    },
    {
        "id": "after-18-evening",
        "label": "Arbejde efter kl. 18",
        "description": "Mandag 16:00-21:00 uden pause.",
        "status": "passed",
        "expected": "5 timer total og 3 mulige aftentimer.",
        "actual": "Dækkes af scripts/run-validation-tests.mjs.",
        "notes": "Foreløbige timer, ikke kronebeløb.",
    },
    {
        "id": "night-work",
        "label": "Arbejde om natten",
        "description": "Mandag 21:00-02:00 uden pause.",
        "status": "passed",
        "expected": "5 timer total og 4 mulige nattetimer.",
        "actual": "Dækkes af scripts/run-validation-tests.mjs.",
        "notes": "Foreløbige timer, ikke kronebeløb.",
    },
    {
        "id": "saturday-work",
        "label": "Arbejde lørdag",
        "description": "Lørdag 08:00-14:00 uden pause.",
        "status": "passed",
        "expected": "6 lørdagstimer.",
        "actual": "Dækkes af scripts/run-validation-tests.mjs.",
        "notes": "Satsen kræver manuel kategorisering.",
    },
    {
        "id": "sunday-work",
        "label": "Arbejde søndag",
        "description": "Søndag 08:00-14:00 uden pause.",
        "status": "passed",
        "expected": "6 søndagstimer.",
        "actual": "Dækkes af scripts/run-validation-tests.mjs.",
        "notes": "Satsen kræver manuel kategorisering.",
    },
    {
        "id": "weekly-overtime",
        "label": "Overarbejde efter normal uge",
        "description": "Fem hverdage a 8 timer uden pause.",
        "status": "passed",
        "expected": "40 timer total og 3 mulige overarbejdstimer over 37 timer.",
        "actual": "Dækkes af scripts/run-validation-tests.mjs.",
        "notes": "Overarbejde kan stadig afhænge af daglig arbejdstid og lokalaftaler.",
    },
    {
        "id": "multiple-workdays",
        "label": "Uge med flere arbejdsdage",
        "description": "Mandag-fredag 07:00-15:00 med 30 minutters pause.",
        "status": "passed",
        "expected": "37,5 timer total og 0,5 mulig overarbejdstime over 37.",
        "actual": "Dækkes af scripts/run-validation-tests.mjs.",
        "notes": "Tester ugentlig opsummering.",
    },
    {
        "id": "local-agreement-combination",
        "label": "Kombination med lokalaftale",
        "description": "Mandag 08:00-16:00 med lokalaftale markeret.",
        "status": "passed",
        "expected": "Lokalaftale markeres, men giver ikke juridisk sats uden særskilt aftale.",
        "actual": "Dækkes af scripts/run-validation-tests.mjs.",
        "notes": "Lokalaftaler kræver separat dokumentation.",
    },
    {
        "id": "public-holiday-calendar",
        "label": "Arbejde på helligdag",
        "description": "Fredag 25. december 2026 kl. 08:00-14:00 uden pause.",
        "status": "passed",
        "expected": "6 helligdagstimer og automatisk satsberegning blokeret indtil manuel validering.",
        "actual": "Dækkes af scripts/run-validation-tests.mjs.",
        "notes": "Kalenderen tester datoen. Sats og regelkategori kræver stadig manuel godkendelse.",
    },
]


RATE_RE = re.compile(
    r"(?<!\d)(?:\d{1,3}(?:\.\d{3})*|\d+),\d{2}\s*(?:kr\.?|pct\.?|%)?|"
    r"(?<!\d)\d+\s*(?:timer|time|pct\.?|%)",
    flags=re.IGNORECASE,
)


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def extract_pages(pdf_path: Path) -> list[dict[str, Any]]:
    pages: list[dict[str, Any]] = []
    with pdfplumber.open(pdf_path) as pdf:
        for index, page in enumerate(pdf.pages, start=1):
            pages.append({"page": index, "text": normalize_text(page.extract_text() or "")})
    return pages


def keyword_hits(text: str, keywords: list[str]) -> list[str]:
    lowered = text.lower()
    return [keyword for keyword in keywords if keyword.lower() in lowered]


def contexts_for_keywords(text: str, keywords: list[str], max_contexts: int = 4) -> list[str]:
    lowered = text.lower()
    contexts: list[str] = []
    seen: set[str] = set()
    for keyword in keywords:
        start = lowered.find(keyword.lower())
        if start == -1:
            continue
        excerpt_start = max(0, start - 260)
        excerpt_end = min(len(text), start + len(keyword) + 520)
        excerpt = normalize_text(text[excerpt_start:excerpt_end])
        if excerpt and excerpt not in seen:
            contexts.append(excerpt)
            seen.add(excerpt)
        if len(contexts) >= max_contexts:
            break
    return contexts


def possible_rates(contexts: list[str]) -> list[str]:
    rates: list[str] = []
    seen: set[str] = set()
    for context in contexts:
        for match in RATE_RE.findall(context):
            value = normalize_text(match)
            if value and value not in seen:
                rates.append(value)
                seen.add(value)
    return rates[:20]


def build_rule(definition: dict[str, Any], pages: list[dict[str, Any]]) -> dict[str, Any]:
    page_by_number = {page["page"]: page for page in pages}
    preferred_pages = definition.get("preferredPages") or []
    matches: list[dict[str, Any]] = []
    searchable_pages = (
        [page_by_number[number] for number in preferred_pages if number in page_by_number]
        if preferred_pages
        else pages
    )

    for page in searchable_pages:
        hits = keyword_hits(page["text"], definition["keywords"])
        matches.append(
            {
                "page": page["page"],
                "hitCount": len(hits),
                "contexts": contexts_for_keywords(page["text"], definition["keywords"]),
            }
        )

    matches.sort(key=lambda item: item["page"] if preferred_pages else (-item["hitCount"], item["page"]))
    selected = matches if preferred_pages else [item for item in matches if item["hitCount"] > 0][:6]
    selected_pages = sorted({item["page"] for item in selected})
    contexts = [context for item in selected for context in item["contexts"]]
    rates = possible_rates(contexts)

    if not selected:
        confidence = "low"
        source_text = ""
        notes = "Ingen sikker tekst fundet ved keyword-søgning. Kræver manuel PDF-gennemgang."
    else:
        confidence = "high" if len(selected) >= 2 and contexts else "medium"
        source_text = "\n\n".join(contexts[:4])
        notes = (
            "Automatisk keyword-udtræk. Kontrollér side, fuld bestemmelse, satser, "
            "gyldighedsdatoer og lokalaftaler manuelt før godkendelse."
        )

    return {
        "ruleKey": definition["ruleKey"],
        "label": definition["label"],
        "required": definition["required"],
        "calculationType": definition["calculationType"],
        "rate": None,
        "unit": definition["unit"],
        "conditions": "Kræver manuel klassificering mod fuld PDF-bestemmelse.",
        "pdfPages": selected_pages,
        "sourceText": source_text,
        "possibleRates": rates,
        "confidence": confidence,
        "reviewStatus": "needs_review",
        "notes": notes,
    }


def build_report(agreement: str, pdf_path: Path) -> dict[str, Any]:
    pages = extract_pages(pdf_path)
    rules = [build_rule(rule, pages) for rule in RULE_DEFINITIONS]
    return {
        "agreementSlug": agreement,
        "agreementName": AGREEMENT_NAMES.get(agreement, agreement),
        "sourceAuditVersion": SOURCE_AUDIT_VERSIONS.get(agreement, ""),
        "status": "rules_extracted",
        "validatedForCalculation": False,
        "sourcePdf": pdf_path.name,
        "extractedAt": dt.date.today().isoformat(),
        "validatedAt": "",
        "validatedBy": "",
        "validationNote": (
            "Automatisk PDF-udtræk er gennemført. Alle regler kræver manuel review, "
            "kildekontrol og test før beregning må aktiveres."
        ),
        "rules": rules,
        "testCases": TEST_CASES,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--agreement", default="industriens-overenskomst")
    parser.add_argument("--pdf", default="")
    parser.add_argument(
        "--output", default="public/validation/agreement-validation-report.json"
    )
    args = parser.parse_args()

    pdf_path = Path(args.pdf) if args.pdf else ROOT / "public" / "overenskomster" / f"{args.agreement}.pdf"
    if not pdf_path.is_absolute():
        pdf_path = ROOT / pdf_path
    if not pdf_path.exists():
        raise SystemExit(f"PDF findes ikke: {pdf_path}")

    output_path = Path(args.output)
    if not output_path.is_absolute():
        output_path = ROOT / output_path
    output_path.parent.mkdir(parents=True, exist_ok=True)

    report = build_report(args.agreement, pdf_path)
    output_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Skrev valideringsrapport: {output_path}")
    print(
        "Bemærk: rapporten er kun kandidatdata. Alle regler står som needs_review "
        "og kan ikke aktivere automatisk beregning."
    )


if __name__ == "__main__":
    main()
