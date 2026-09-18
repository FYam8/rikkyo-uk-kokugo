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
