# App-derived answer authority workflow

The supplied source set does not contain official answer keys. Therefore this repository does not create an `officialAnswer` field by inference.

For each visible past-paper question, answer work follows this state machine:

`UNRESOLVED -> APP_DERIVED_DRAFT -> INDEPENDENT_CHECK_1 -> INDEPENDENT_CHECK_2 -> APP_DERIVED_VERIFIED`

Any disagreement or ambiguity moves the item to `REVIEW_REQUIRED`.

For selection/short-answer items, a verified record must include a source locator/evidence note sufficient for a reviewer to reproduce the reasoning without treating OCR as authority.

For written items, a verified record must include required elements, length/format constraints, acceptable variants, partial-credit boundaries and zero-credit conditions. This follows the project master specification that written problems need required elements, length, evidence location, model answer, acceptable expressions, partial credit and deduction conditions, and that scoring/rubrics must be independently reviewed. fileciteturn370file0

No unresolved/draft answer is allowed into production scoring.
