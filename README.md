# Rikkyo UK Kokugo

立教英国学院 国語対策アプリの private source repository。

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

## 2026-09-25 review checkpoint — HOLD

The unofficial `Rikkyo_Japanese_Answers_FY24-FY26_AB.pdf` was recovered and read.
All 79 previously unresolved questions now have explicit `REVIEW_REQUIRED`
candidate records, source references and provisional reasoning/rubrics. These
records are not eligible for scoring. The original FY25 A/B 63 verified records
are unchanged and protected by content hashes. All 142 stable IDs and source-page
mappings are preserved. FY24-B I/II remain unavailable; their missing question
count is unknown, not zero.

This checkpoint does **not** complete the requested application. The old practice
bank was not recovered, a replacement bank has not been authored, engine
integration is incomplete, and browser/CLEAN loops have not run. Production and
Pages remain on HOLD. No release tag is created.

See [review report](docs/review-20260925.md),
[shared engine gaps](docs/shared-engine-integration-gaps.md) and
[release gate](metadata/release_gate.json).

Local validation:

```sh
node tools/validate_scaffold.mjs
python tools/test_authority_baseline.py
```
