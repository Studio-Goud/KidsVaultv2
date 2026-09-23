# Suri — standing rules

Read this first. It is the part that does not change between sessions. The brief for the work
itself is `docs/prompt.md`; the reasoning behind every big choice is `docs/decisions.md`.

## What this is

A Dutch-first hub of small things for children of two to ten, sold to parents at €3,99 a month.
Eighteen entries: sixteen games and two discovery journeys. One guide, a meerkat called Suri, who
is also the app. English and Dutch throughout, Dutch written first.

## The rules that are not negotiable

1. **No advertising, no third-party tracking, no account.** Nothing about a child leaves the
   device. The only outbound requests are photographs from Wikimedia Commons.
2. **No manipulative mechanism.** No streak, no daily reward, no timer inside a thing, no
   currency that can be topped up, nothing that gets easier if you pay. Every session ends.
3. **"Oefent" mag, "leert" niet.** Say what a thing practises, never what a child will learn.
   Practising is a claim about what happens on the screen; learning is a claim that needs
   measuring, and nobody has measured this.
4. **Never write "pedagogisch goedgekeurd"** anywhere, in any language. No pedagogue has seen it.
   `docs/claims.md` is the list of everything that would need checking.
5. **Every number says where it comes from.** Where a figure is research, name the source; where
   it is a product decision, say so in the same breath. `src/platform/session.ts` is the model.
6. **Audio-first.** Anything that matters is said out loud, because a four-year-old cannot read.
   The guide in the corner repeats it on tap, as often as a child asks.
7. **A setting a parent changes must change something.** A control that writes a value nothing
   reads is a lie on the screen, and this project has shipped two of those already.

## How it is built

TypeScript + Vite, **canvas 2D only**, no engine and no UI framework. One bundle per page, wired
in `vite.config.ts`. Capacitor 7 wraps it for iOS and Android. One runtime dependency
(`@fontsource/nunito`). Everything is drawn in code and every sound is synthesised: no sprite
sheets, no audio files.

- Shared house style: `src/render/look.ts`. Use `chunkyButton`, `glassPanel`, `heading`,
  `Particles`, `bleedEdges` rather than rolling your own.
- Safe area: `safeArea()` and `uiScale()` in `src/util/ui.ts`. Every canvas game translates by
  its own `st`/`sl` and calls `bleedEdges` at the end of the frame.
- One save object in `localStorage` under `cloudhopper.save.v1`, merged slice by slice in
  `loadSave()`. Never widen a slice without a cleaner that survives a corrupt file.
- Every game hangs a debug handle on `window` (`__dig`, `__reis`, …) exposing `debugState()`
  with a `buttons` array. The audit depends on it; keep it working.

## How work is checked

Three gates, all of which must be green before a commit claims to be finished:

```
npx tsc --noEmit        # types
npm test                # 1339 checks, no browser, tests/run.mjs
npm run audit           # 20 pages x 5 screen shapes in a real browser, 0 faults
```

`npm run audit` is the one that catches what unit tests cannot: two things drawn in the same
place, a button under the notch, a control off the edge. It takes about ten minutes. Run it
before claiming a screen works. `npm run contact` lays its screenshots out for a human to look at.

Beyond the gates: **open the thing in a browser and drive it** before saying it works. Most of
the faults in this project's history were visible in one screenshot and invisible to every test.

Test naming: `test_[system]_[scenario]_[expected_result]`, per `.claude/rules/test-standards.md`.

## Writing

Comments explain **why**, not what. A file's opening comment says what the thing is for and which
decision it embodies. Code reads like the code around it.

User-facing Dutch is warm, short and concrete. No exclamation marks, no baby talk, no jargon.

## Git

Commit messages are Dutch, plain, and say what changed and why — including what was checked and
what is still not right. No bullet-point lists of files. End every commit with:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

Do not open a pull request unless asked.
