# Existing Rikkyo Kokugo asset recovery

Date: 2026-09-18

## Result

A prior project conversation recorded actual MVP artifacts through **v0.4**, including a 24-unit original assessment bank (kanji 10 / literature 7 / explanatory 7), QA report and MVP specification.

The current GitHub repository was empty before initialization. A GitHub-wide search across the FYam8 account did not locate the recorded Kokugo MVP names/content, and the File Library search did not return the artifact. Therefore the prior MVP is classified as:

**KNOWN TO HAVE EXISTED / ARTIFACT NOT CURRENTLY RECOVERED**

It must not be silently regenerated and described as the recovered original.

## Reuse rule

If the prior MVP/ZIP/QA_REPORT/MVP_SPEC is recovered later:

1. preserve its stable IDs and authored question content;
2. map it into the current school-data schema;
3. do not replace it merely because the Waseda master engine uses a different data shape;
4. add only fields that are required by the shared engine;
5. compare any newly created fallback item against the recovered item before promotion.

## What is authoritative now

The six supplied problem booklets are available and have been hashed/inventoried in `metadata/source_inventory.json`.

No official answer booklet is currently present in this source set. Consequently answer keys, partial-credit rules and official explanations remain unresolved unless independently established from a documented authority.

## Next data pass

Create a structural registry from the visible problem booklets without inventing answers:

`Exam -> Section -> Question -> Asset/Page -> Response type -> Skill demand -> Authority status`

FY24-B sections I and II remain unavailable from the supplied booklet because those sections are omitted for copyright reasons. They must stay explicitly unavailable rather than being reconstructed from guesswork.
