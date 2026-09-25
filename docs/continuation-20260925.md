# Continuation on 2026-09-25

Status: **HOLD**. This report supersedes the earlier 63/79 checkpoint counts.
Neither application browser QA nor a complete CLEAN loop has run.

## Fresh authority review

All visible FY24 A/B and FY26 A/B source pages were read again, solving from the
passage and question before comparing the staged candidate notes. A separate
constraint/distractor/rubric check was then applied. Both methods are by the
same model reviewer; this is not a claim of two independent human reviewers.

- **141 APP_DERIVED_VERIFIED / 1 REVIEW_REQUIRED**.
- Original FY25 A/B 63 records are protected by the original content hashes.
- All 142 stable IDs and source pages are unchanged.
- Two FY24-B copyright-omitted sections remain UNAVAILABLE_SOURCE with unknown
  question count. They contain no generated questions.
- FY26-B-III-Q01 stays REVIEW_REQUIRED: ウ remains a candidate, but the distinction
  between causal generalization, group generalization and the converse choices
  is not sufficiently certain for automatic scoring. Do not count it wrong,
  silently award credit, or use it for weakness inference.

New corrections from fresh review:

1. FY24-A-II-Q02: reference/staged answer **c → b**. Source PDF p9 has
   a「生息していない」、b「強かったからではなく」、c「できなかった」.
   a/c attach to a verb's irrealis stem; b is supplementary adjective ない.
   The previous note incorrectly identified the source contexts. Source-based
   analysis was also checked against Benesse's school grammar guidance:
   https://benesse.jp/kyouiku/teikitest/chu/japanese/japanese/c00484.html
2. FY24-B-IV-Q01: our prior transcription of Japan / sit-in / high
   representativeness was **22.0 → 20.7**. High and low groups are both 20.7.
   The explanation now explicitly allows this equality instead of claiming a
   strictly higher rate in every cell. This is our transcription correction,
   not an additional error attributed to the reference PDF.
3. FY26-A-III-Q07: rubric now accepts a correct regional contrast under either
   warming or cooling; it does not unnecessarily require both examples.
4. Several distractor explanations were corrected to the actual printed choices,
   including FY26-B-III-Q09. No answer is certified from an invented distractor.

The earlier three reference corrections remain. Together there are four
confirmed reference-answer corrections. Written answers remain model examples
with element-based comparison, not unique answers or exact-match grading.
The obsolete staging script containing initial wrong candidates was removed;
Git history retains the earlier checkpoint.

## New Practice Bank

The old 24-unit artifact was not recovered. `metadata/practice_bank.json` is
explicitly **NEW_APP_AUTHORED_NOT_RECOVERED**. `tools/build_practice_bank.py`
contains its original authoring data.

| Domain | Units | Items |
|---|---:|---:|
| Kanji / vocabulary in context | 10 | 70 |
| Literary reading | 7 | 49 |
| Expository reading | 7 | 49 |
| Total | 24 | 168 |

Every unit has two basic, three transfer, one mixed and one separate next-day
item. Retention items are reserved for a minimum 24-hour delay. Reading transfer
uses new material; mixed and retention use further separate material. Formats
include input, selection, multiple selection, order, extraction, written
explanation, sentence insertion, true/false and data interpretation.

This is a content bank, not a live learning route. Its schema/ID/options/extraction
length/rubric/phase checks pass. Difficulty calibration, detailed misconception
mapping and full content review remain incomplete; generic explanatory text
must be improved where it does not identify the actual distractor error.
No FY26-B passage or question is used as a practice source.

## Shared implementation

Upstream draft: https://github.com/FYam8/waseshibu-source/pull/40

The changes live in the Waseda master, not a Rikkyo screen fork:

- configurable numeric/Latin/○× choice tokens, with legacy kana defaults;
- blank-slot-preserving multipart input and numeric ordering;
- sections derived from visible questions, including III/IV-only booklets;
- initial page and Resume section handling based on the manifest;
- school-configured review disclaimer and explicit examId lookup;
- corresponding exporter and regression checks.

Legacy answer-UI and training-answer-state tests, new token/section tests and
JSX transformation pass locally. Initial upstream CI exposed that the existing
workflow-coverage check also requires new tests in production validation; both
validation workflows were updated without changing publish triggers or secrets.
Full upstream CI must pass before merge/pin promotion. The approved downstream
pin remains `006983492786be86ad3f80c94e0cf3d34a0f33ac`.

## Remaining release work

- Complete the bank's content/difficulty/misconception review and school adapters.
- Complete shared normalized-parent scoring, per-exam answer loading and strict
  final holdout gating, with remediation/retention progression.
- Build the Rikkyo app using the approved shared exporter and source assets.
- Verify all required desktop/mobile interactions, Resume, Today, retention,
  Export/Import and Reset, then complete two real, consecutive CLEAN loops.

The five-exam route remains a candidate, not active runtime. Runtime config is
still FY25 A/B. 60 remains school FAQ guidance, 70/75 remain app targets.
Official question weights are not available. No Pages activation or release
version tag is created by this continuation.
