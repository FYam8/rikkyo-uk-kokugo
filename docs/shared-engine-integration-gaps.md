# Shared-first integration findings

Inspected upstream: `FYam8/waseshibu-source` at
`4912d3e2ff2e46bd83270ee9b88e9c32cccb4015`.
Approved downstream pin remains unchanged. These are static source findings,
not browser test results and not a complete shared-engine audit.

The shared exporter requires school-owned drills, kanji, review modules and
content builders that this scaffold does not yet provide. Missing modules must
fail closed. Do not insert Waseda school data as placeholders.

| Gap | Observed shared code | Required shared capability and regression |
|---|---|---|
| Numeric, Latin and true/false responses | `src/answerUi.js` tokenizes only ア–コ; `ChoiceAnswerEditor` uses those buttons | Options from the question schema, preserve blank slots, round-trip numeric order and ○/×. Keep Waseda legacy serialized responses working. |
| Partial booklet and variable sections | `src/main.jsx` section navigation uses `[1,2,3]` | Derive section identities from manifest; FY24-B III/IV only, no synthetic I/II; retain Waseda navigation. |
| Answer authority wording | `ReviewCard` contains fixed answer-sheet/scoring wording | Consume school review presentation config; Rikkyo must say unofficial example/rubric and normalized correctness. |
| Parent normalization | `finalizeScore` stores maxScore 100 and sums item scores | Configurable parent credit with missing/review items excluded and explicit denominator; no assertion of official points. |
| Final holdout | Shared answer manifest is loaded as a whole; reserved exam start is confirmable | Per-exam answer payloads and route access policy; load final answers only after final submission; exclude final from Today, weakness training and practice inputs. Test network requests and build imports, not just hidden buttons. |
| Misconception inference | `autoMissReason` primarily maps the broad review type | School-supplied distractor/rubric-element mapping consumed by shared inference; uncertain causes remain uncertain. |
| Retention and route progression | Route and drill progression are separate shared modules | Verify repair/next-day retention gates and no automatic exam advancement before required remediation; do not fork the Rikkyo flow. |

Implement reusable behavior upstream first, run Waseda regression there, then
pin an approved commit and export it with the Rikkyo data overlay. Keep Rikkyo
answers, original drills, source evidence, labels, weakness mappings and school
strategy downstream. No downstream `main.jsx`, parallel Today implementation,
or copied Waseda bank should be used to bypass these requirements.

Shared drill progression requires two stable basic outcomes and a three-answer
transfer round before mixed confirmation. A nominal bank of 24 units is not
sufficient by itself: each supported skill needs enough distinct items to reach
these gates without immediate repetition, plus next-day retention material.

This report is a work list. None of these capabilities is marked implemented
or browser-verified by this checkpoint.

## Follow-up implementation (2026-09-25)

Draft upstream PR #40 now implements token/section/disclaimer support,
parent-normalized scoring with unverified-question exclusion, per-exam answer
loading with a strict final-start/submission gate, and separate text answer
fields with conservative extraction grading. These are shared-source changes;
no Rikkyo UI fork or pin promotion has been made.

The downstream integration and full release gates are still open. In particular,
strict answer loading is not a completed holdout audit: Rikkyo must supply
separate manifests, remove final answers from static review/practice modules,
and verify the built bundle and network behavior. Remediation/retention gates
and detailed diagnostic mapping remain to be implemented and tested.

See `docs/shared-engine-checkpoint-20260925.md` for exact CI evidence and limits.
