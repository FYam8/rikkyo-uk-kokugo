# Rikkyo Kokugo authority inventory

Status: **HOLD / fail closed**

## Confirmed source set

The project source set contains the six Rikkyo Kokugo problem booklets:

- FY24-A
- FY24-B
- FY25-A
- FY25-B
- FY26-A
- FY26-B

These establish the exam identities. They do **not** by themselves establish official answer keys, official partial-credit rules, or app-authored original/practice content.

## Existing Rikkyo assets

Policy: preserve and reuse any previously analyzed Rikkyo Kokugo original/practice questions, explanations, weakness mappings and stable IDs when an authoritative artifact is recovered.

At repository initialization, this repository was empty. No authoritative Rikkyo Kokugo data artifact has therefore been imported into GitHub yet. Do not synthesize a replacement and call it recovered data.

## Required before build is enabled

1. Inventory all six exams as `FY24-A`, `FY24-B`, `FY25-A`, `FY25-B`, `FY26-A`, `FY26-B`.
2. Recover/reuse existing Rikkyo-owned original/practice data where available.
3. Establish answer/scoring authority for each past-paper question; unresolved items remain review-required and cannot silently receive invented official status.
4. Create only missing school adapters/data required by the shared engine.
5. Define Rikkyo learning strategy/score targets from the Rikkyo analysis; do not inherit Waseda 60/70/75 merely because the engine supports those values.
6. Run downstream regression plus real-browser tests before public deployment.

## Shared vs Rikkyo-owned

Shared engine comes from the pinned `waseshibu-source` commit in `upstream.lock.json`.

Rikkyo-owned: problem/answer metadata, raw source material, practice bank, kanji/kobun datasets, curated review content, review profiles, school learning configuration and school-specific build adapters.
