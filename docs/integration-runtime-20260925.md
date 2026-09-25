# Integration runtime checkpoint

Production remains HOLD. No Pages deployment, release tag, or CLEAN loop is claimed.

The Rikkyo branch now includes a runnable, generated export of the shared Waseda engine. `shared-engine/files.json` records the generated engine file hashes; school-owned modules contain data adapters. The approved pin remains unchanged until upstream regression and downstream QA finish. The candidate pin is recorded separately.

All 142 source question IDs and the original 63 verified records are preserved. 141 references are verified, FY26-B-III-Q01 is excluded from grading, and FY24-B I/II remain unavailable sections. Source assets were rendered only from the six hash-matched user-provided PDFs. Per-exam answer/reference manifests are loaded after submission; the problem manifest contains input formats and demands, not answers.

The new app-authored bank has 24 units and 175 items. The historical bank was not recovered. The added seven-item strand addresses language/grammar demands; extraction is now practiced through transfer and next-day questions as actual text input. Item-level tags no longer copy every unit tag. Full pedagogy/routing/STEP/retention QA is still pending.

Actual local Chromium operations at 1280px and 390px have covered the 33-question diagnostic, exam text draft Resume, scoring, weakness and review display, original-question replay, repair-stage Resume, Export, Reset and Import. No final-holdout answer request occurred in that flow. A separate 142-input suite passed all six desktop exams and found a mobile interaction bug: stale saved notifications could cover the scoring button. The shared engine now clears stale notices when starting an exam; the full suite is being rerun. These are partial integration checks, not CLEAN loops.

Upstream regression initially found a missing retention dependency in an isolated test fixture and a persistence contract that predated explicit Reset. The fixture includes the new dependency. Reset now requires explicit confirmation; regression tests continue to forbid destructive operations in normal persistence and additionally verify Reset and backup restoration. The latest full upstream CI must pass before promotion.

Remaining release work: complete and review STEP 1/2/3 and delayed retention interactions, semantic skill coverage and detailed distractor feedback, complete all browser/holdout/regression gates, execute two zero-fix CLEAN loops, then enable production metadata and Pages on a verified main SHA.
