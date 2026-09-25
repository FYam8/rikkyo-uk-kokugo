# Shared engine verification checkpoint

Status: **HOLD for Rikkyo production**.

Upstream changes are in [Draft PR 40](https://github.com/FYam8/waseshibu-source/pull/40),
commit `d8b3925e4c2a6ae4bd8266f50e4a3177d90ea706`.
[CI run 36183548766](https://github.com/FYam8/waseshibu-source/actions/runs/36183548766)
completed successfully. Neither repository main was merged or deployed.

Implemented in shared source (no Rikkyo UI fork):

- Configurable numeric, Latin, extended kana and true/false tokens.
- Blank-preserving multipart choice and separate text input fields.
- Exact source-spelling extraction grading with explicit accepted variants;
  written answers are excluded from this exact-match grader.
- Navigation/initial page from visible sections, including III/IV-only booklets.
- School-configured review disclaimer.
- Equal parent normalization, explicit scored denominator and non-official-score
  metadata; REVIEW_REQUIRED/unknown authority excluded from scores and weakness
  results when the normalized policy is enabled.
- Per-exam answer manifests with cross-exam-payload rejection; strict final exam
  start follows the recommended route and final answers load only on submission
  or after a saved completion. Legacy Waseda manifest behavior is preserved.

Validation at the commit above:

- Existing Waseda content/grading/page checks and complete regression suite PASS.
- Production-equivalent build and public artifact check PASS.
- Existing 390px/1280px learning-unit, course and local browser smoke checks PASS.
- Actual shared editor browser fixtures at 390px/1280px PASS: initial blank state,
  numeric ordering/undo, blank slots, ○×, Latin, extended/legacy kana, independent
  text fields and clearing one field without shifting the others.
- Unit tests cover fractional parent credit, invalid scores, authority exclusion,
  isolated answer requests, blocked final access, strict extraction and variants.

These are not full Rikkyo application QA and not CLEAN loop 1 or 2. Rikkyo still
needs its content builder, source assets, full school data modules, content and
misconception review, remediation/retention integration, and end-to-end tests.
The final answer-loading guard alone is not sufficient: the built Rikkyo bundle
must also exclude final answers from static review/practice modules. Static
hosting cannot prevent deliberate retrieval of a known asset URL.

The downstream candidate config selects the new policies; active runtime and
`upstream.lock.json` are unchanged. Approved pin remains
`006983492786be86ad3f80c94e0cf3d34a0f33ac`.

The practice readiness audit reports 24 new units / 168 items, but 40 detailed
source-demand tags have no direct bank tag. Some can be covered by reviewed
skill aliases or current items; others may require stronger/new questions.
Declared unit tags are not proof of question-level coverage or transfer ability.
No coverage or release gate was relaxed to obtain a passing result.
