# Six-exam structural analysis

Basis: the six supplied Rikkyo UK Kokugo problem booklets only. No official answer booklet is present in this source set, so this document describes **question structure and observed demands**, not answer correctness or official scoring.

## Stable structural pattern

### FY24-A
- I: literary reading, 10 parent questions.
- II: expository/argumentative reading, 11 parent questions.
- III: kanji/orthography, 2 parent questions containing 10 answer units (6 + 4).

### FY24-B
- I and II: omitted in the supplied booklet for copyright reasons; question counts and contents are not reconstructed.
- III: kanji/orthography, 2 parent questions containing 10 answer units (6 + 4).
- IV: one chart/data-reading written task asking the learner to explain features visible in the data.

### FY25-A
- I: 10 kanji items.
- II: literary reading, 12 parent questions.
- III: expository reading, 11 parent questions.

### FY25-B
- I: 10 kanji items.
- II: literary reading, 9 parent questions.
- III: expository reading, 11 parent questions.

### FY26-A
- I: kanji/orthography, 2 parent questions containing 10 answer units (3 + 7).
- II: literary reading, 13 parent questions.
- III: expository reading, 8 parent questions.

### FY26-B
- I: 10 kanji items.
- II: literary reading, 10 parent questions.
- III: expository reading, 10 parent questions.

## What changed / what stayed stable

From FY25 onward, both A and B show a stable three-part macro-structure:

1. kanji/orthography,
2. literary reading,
3. expository reading.

FY24-A contains the same three broad domains but places kanji last. FY24-B is not directly comparable because I/II are omitted in the supplied booklet and IV adds a visible chart/data-reading task.

Therefore the downstream data model must not encode a fixed assumption such as “section I is always kanji.” The shared engine should receive section metadata from Rikkyo data.

## Observed demand families

Visible questions across the six booklets include:
- kanji reading / conversion from katakana to kanji;
- contextual vocabulary and word meaning;
- blank completion;
- content-consistency / best-choice selection;
- literary character feeling, motive and relationship;
- rhetorical/grammatical relation and modifier/phrase interpretation;
- extraction from the source text with a character limit;
- short written explanation with a character limit;
- longer written explanation;
- data/chart interpretation (visible in FY24-B IV).

These are **observed task families**, not yet a scored weakness taxonomy. A weakness taxonomy will be promoted only after each visible question has been mapped and the answer/scoring authority has been resolved.

## Implementation consequences

- Exam identity is `FYxx-A/B`, never numeric year only.
- Section order is school data.
- Stable question IDs are now registered even when answer authority is unresolved.
- FY24-B I/II remain explicit unavailable regions.
- The app must support both one-parent-many-answer-unit kanji sections and ten independent kanji items.
- The app must support written and data-reading tasks in addition to choice/text questions.
- No Rikkyo score target or diagnostic/final route is activated yet; Waseda 60/70/75 is not inherited by default.
