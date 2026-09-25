# Rikkyo UK Kokugo

立教英国学院 国語対策アプリの source repository。

## Architecture

`FYam8/waseshibu-source` is the upstream master engine.

```
waseshibu-source (shared Kokugo engine)
        |
        v
rikkyo-uk-kokugo (Rikkyo-owned data/config/build)
```

The relationship is one-way. Shared engine fixes flow from Waseda upstream to Rikkyo after Rikkyo regression tests. Rikkyo content never flows into Waseda.

## Non-negotiable boundaries

Shared upstream owns UI, UX, Today/learning-path mechanics, answer UI, resume/persistence mechanics, weakness-repair progression, STEP1/STEP2/STEP3 mechanics, practice history/revision mechanics, kobun grading/event mechanics, review-priority mechanics, PWA shell and safety checks.

Rikkyo owns FY24/FY25/FY26 A/B exam data, problem assets, grading/answer authority, original/practice questions, kanji/kobun content, curated explanations, weakness mappings, exam ordering/labels and school-specific strategy configuration.

Existing Rikkyo original/practice analysis must be reused when authoritative artifacts are recovered. Do not regenerate or replace it merely to fit the Waseda engine. Missing fields are added; existing stable content is preserved.

## Current state

Scaffold only. No public deployment is enabled. Content build remains fail-closed until the Rikkyo authority inventory is complete and school-specific required data has been supplied.

See `docs/content-inventory.md`.

## 2026-09-25 continuation — HOLD

Fresh source re-reading and re-solution promoted 78 of the 79 candidates.
Answer Authority is now **141 verified / 1 REVIEW_REQUIRED**. The remaining
`FY26-B-III-Q01` is excluded from scoring. Existing FY25 A/B 63 answers and all
142 stable source mappings remain unchanged. FY24-B I/II remain unavailable.

A **new**, app-authored bank contains 24 units (10 kanji, 7 literary, 7
expository) and 168 items: 48 basic, 72 transfer, 24 mixed, 24 next-day retention.
The historical bank was not recovered. Content review and engine integration
remain incomplete; these are authored items, not a claim of production readiness.

Reusable answer-token, visible-section and school-disclaimer changes are in
[upstream draft PR #40](https://github.com/FYam8/waseshibu-source/pull/40).
Rikkyo does not contain a forked UI. The approved upstream pin is unchanged.

This is not yet a runnable production app. Holdout isolation, shared integration,
content QA and desktop/mobile CLEAN loops remain release blockers. Pages and
release tagging remain disabled.

See [continuation report](docs/continuation-20260925.md),
[initial review report](docs/review-20260925.md),
[shared engine gaps](docs/shared-engine-integration-gaps.md) and
[release gate](metadata/release_gate.json).

```sh
node tools/validate_scaffold.mjs
python tools/test_authority_baseline.py
python tools/test_practice_bank.py
```
