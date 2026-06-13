# QA Docs — Bot-Verifiable Feature Checklists

When developing a product feature, create `docs/qa/<feature-slug>.md` **after the feature's
documentation/design is written and before implementation begins**. This is a required step,
not an afterthought: the transformers bot network (`~/Development/transformers`, `npm run qa`)
scans every product repo for these docs and verifies each checklist item with a bot squad —
checking items off, filing bug reports into `docs/todo/`, and advancing the feature's todo stage.

Workflow placement:
- Todo Stage lifecycle: completing the `documentation` stage requires the QA doc to exist.
- `/new-feature` skill: the QA Doc phase sits between Architecture and Implementation.
- Any other flow that pre-creates feature docs (PRDs, design docs): write the QA doc
  immediately after, while acceptance criteria are fresh.

## Contract (consumed by the transformers QA sweep)

```markdown
# QA: <Feature Name>

**Date:** YYYY-MM-DD
**Scope:** `src/path/to/feature`
**Product:** <glyffiti|nib|guidegenius>          <- optional; inferred from repo if omitted
**Entry:** /path/where/testing/starts            <- optional; appended to the product base URL
**Todo:** docs/todo/<feature-slug>.md            <- optional; enables automatic stage advancement

## <Behavior Group>
- [ ] <Observable user-facing behavior — what a tester would SEE, not implementation detail>
- [ ] Long-press opens the radial menu <!-- qa:human mobile-gesture -->

## Regression Risks
- **Medium:** <what could break and where to look>
```

Authoring rules:
1. **Write observable behaviors.** "Clicking Save shows a confirmation toast" — not "savePool()
   returns 200". A bot (or human) must be able to attempt the item through the UI and see the result.
2. **Every item starts from the Entry URL.** If an item needs setup (an existing highlight, a
   published story), say so in the item text so the bot can create the precondition.
3. **Mark human-only items** with `<!-- qa:human <reason> -->` (mobile gestures, audio/speech,
   visual polish). Force bot-testable with `<!-- qa:bot -->`. Unmarked items default to bot-testable.
4. **Known bot limits:** bots cannot select text yet (no SELECT action) — mark selection-dependent
   items `qa:human` until that lands.
5. **Never edit bot annotations** (`<!-- qa: pass 2/2 ... -->`) by hand except to remove stale ones;
   the sweep treats the doc as source of truth.

New products must be registered in `transformers/src/qa/projects.ts` before sweeps pick them up.
Until then the docs are inert but ready — write them anyway.
