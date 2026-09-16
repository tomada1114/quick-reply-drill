---
name: designing-ui
description: >
  Covers this app's visual language: the locked "Blueprint on Paper" direction — white
  canvas, IBM Plex Mono figures, hairline rules, one charcoal action — its Tailwind v4
  @theme tokens, and the layout of the drill, feedback, and dashboard screens. Use when
  building or restyling a component under src/, choosing a color, type size, radius,
  spacing, or motion, adding a shadcn/ui component, styling the countdown, the score
  table, or the model answer, deciding whether a UI change fits the system, or
  researching a screen that has no precedent here yet.
---

# Designing UI

**Owns:** the visual direction and its reference lock, the design tokens, the layout and
component rules for every screen, and what a new surface must be researched against.
**Does not own:** the TypeScript of a component (`writing-typescript`); which file a
component may import from (`building-app-routes`). No skill owns the text inside a
component today — it is hard-coded English, written where it renders.

Nothing here is enforced by a config or a test. A drifted screen passes every gate, so
the reference lock below is the check, applied by reading it before styling and by
comparing the rendered screen against it afterwards.

## The lock

The direction was settled from Refero research, not from taste: three full style
references (SST, imgs.so sign-in, Cron Calendar) and two screen searches. It is locked,
which means a later screen adapts to it rather than renegotiating it.

```text
Primary reference:  SST (sst.dev) — "config file on paper": pristine white, monospaced
                    display type, hairline ash rules, comfortable density, flat surfaces.
Preserve:           white canvas with no tinted sections; IBM Plex Mono carrying every
                    figure and the question itself; 1px #e8e8f2 rules instead of shadows;
                    4px controls / 8px cards; one contained centered column.
Borrow only:        imgs.so — the charcoal #1c2024 filled primary button, the #f5f5f5
                    inset input fill, and mono micro-labels at 10-12px in caps.
Role rules:         the charcoal is the primary action and nothing else; amber #9a5421 is
                    a status indicator only (the last ten seconds, the forced submit);
                    SST's syntax colors stay out of the UI entirely.
Media strategy:     no photography, no illustration, no mascot. The typeset page is the
                    image. The one graphic allowed is a monochrome sparkline.
Reject:             score rings and donuts, progress bars as decoration, gradients,
                    indigo/violet brand accents, colored "good/bad" score chips,
                    streak flames, confetti, glassmorphism, tinted dark cards on white.
Memorable move:     the sheet of paper is static and the countdown is the only live ink —
                    it is the largest figure on the screen and the only element that
                    changes color during a rep.
```

Ledger for the choices that a reader would otherwise have to take on trust:

| Decision                                    | Source                           | Why                                                                                                  |
| ------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------- |
| White canvas, hairline rules, flat surfaces | SST style (primary)              | The product is a graded answer sheet; paper is the honest metaphor and the calmest ground            |
| Mono for question, timer, and every score   | SST type roles                   | Figures must be scannable in the two seconds between reps, and mono digits do not reflow             |
| Charcoal filled primary action              | imgs.so component role           | One filled control per screen makes "send" unmissable without spending a hue on it                   |
| Amber reserved for the last ten seconds     | imgs.so status-badge role        | Urgency is a status, not a brand color; borrowing the badge role keeps the page monochrome           |
| Score deltas are monochrome, sign + glyph   | anti-slop rule, no source color  | Green/red score chips are the genre's default and would be the loudest thing on the page             |
| Card: timer top-left, action bottom-right   | Duolingo English Test timed quiz | The one timed-answer pattern with real usage evidence; reps read left-to-right, top-down             |
| No score ring for the total                 | rejected (Promova results card)  | A ring reads as a badge; eight sub-scores need a table, and the total belongs in the same typography |

## Foundation

Tailwind v4 and shadcn/ui. Tokens are declared once in the `@theme` block of the global
stylesheet and consumed as utilities; a component never carries a raw hex, a one-off
`px` type size, or an arbitrary-value color.

- Where a copied component lands, and how it imports: `components.json` points every
  shadcn alias inside one zone — `@/components` (components), `@/components/ui` (ui),
  `@/components/lib` (lib), `@/components/lib/utils` (utils), `@/components/hooks`
  (hooks) — so `pnpm dlx shadcn@latest add <name>` writes into `src/components/` and
  nowhere else. `@/*` maps to `./src/*`. The registry's current output imports `cn` from
  its own `cn` package and `Slot` from the `radix-ui` umbrella; this repository uses its
  own `src/components/lib/utils.ts` and `@radix-ui/react-slot` instead, so a newly added
  component needs those two imports rewritten on the way in (`managing-dependencies`
  holds why). `src/components/` may name `src/core/`, the framework and the UI
  libraries, and nothing else under `src/` — AGENTS.md's Architecture section owns that
  edge, and `eslint.config.mjs` plus `tests/boundaries.test.ts` enforce it.
- `pnpm dlx shadcn@latest …` cannot run from this repository's root: the CLI's own
  dependency graph reaches `semver@6`, which `pnpm-workspace.yaml`'s
  `trustPolicy: no-downgrade` refuses. Run it from a scratch directory outside the
  repository and point it back with `-c <path to this checkout>`, so the component still
  lands in `src/components/` while nothing installed into the repository bypasses the
  policy — then rewrite the `cn` and `Slot` imports as the bullet above describes.
- shadcn/ui components are copied into this repository, so they are ordinary source
  files to edit, not a dependency to configure around. Restyle the copy to the tokens on
  the way in — an untouched default carries its own neutral palette and radius, which is
  exactly the drift this skill exists to prevent.
- Prefer an existing shadcn/ui component over a hand-rolled one; that is what "use the
  libraries" buys. The exception is anything on the lock's reject list, which is not
  made acceptable by shipping inside a library component.
- Every token value, the `@theme` block, and the component recipes are in
  [references/tokens.md](references/tokens.md). Read that file before writing CSS.

## The four screens

**Idle.** The same centered column and card, reduced to one clear entry point. A
one-line Rubik explanation (`One question, a timed reply, then feedback.`) sits above a
large centered charcoal `Start` action. During question loading, keep that action
disabled and place the shared slate status beside it; on failure, keep `Retry` and the
inline error text. No secondary action belongs inside the card.

**Drill.** One centered column, max width 720px, vertically centered on the viewport. A
single card with three zones separated by hairline rules: a header row with the
countdown at the left and the scenario line (who is asking, in slate) at the right; the
body with the question in mono at display size and the textarea below it; a footer with
the character-light hint at the left and the charcoal Send at the right. Nothing else is
on the screen — no navigation, no score history, no streak.

**Feedback.** Same column and card. The total sits alone at the top as the largest mono
figure with `/100` in slate at body size, followed by the eight sub-scores as a
two-column mono table grouped under their four criteria — score right-aligned so the
digits form a line the eye can run down. Under the table: each criterion's comment as
prose, then the model reply in a rule-bounded block with the mono label `MODEL REPLY`.
The next-question action is the charcoal button in the footer, in the same position Send
occupied, so the rep loop never moves the pointer.

**Dashboard.** The recent runs as one mono table, newest first, one row per rep, with
the criterion columns abbreviated to their mono micro-labels. One monochrome sparkline
for the total, at most. The AI's paragraph renders as prose in Rubik below the table, in
a measure of 65-75 characters, with the button that requests it directly above.

## Craft rules

- Type: Rubik for prose, labels, and buttons; IBM Plex Mono for the question, the
  countdown, every score, table headers, and micro-labels. No third family, no italics,
  no decorative word swap in a heading.
- Color carries meaning exactly once: the countdown turning amber under ten seconds.
  Because that is a single signal on a monochrome page, it must also change form — the
  figure gains weight and the card's top rule thickens — so the state survives a
  colorblind reader and a grayscale screenshot.
- Motion is functional and short: 120-160ms on state changes, no entrance animation on
  the question (it must be readable the instant the clock starts), no number roll-up on
  the score. The countdown does not pulse. Honor `prefers-reduced-motion` by dropping
  every transition, which this design can afford because none of them carries meaning.
- Loading uses one shared inline status treatment: the slate caption plus a mono
  ellipsis. The ellipsis may pulse while a request is in flight;
  `prefers-reduced-motion` leaves it static. Use this treatment for every request wait,
  not a spinner, progress bar, or new hue.
- Focus is visible on every control: a 2px charcoal ring offset 2px, never removed to
  tidy the textarea. The textarea is the first focused element when a rep starts, with
  no click required.
- Contrast: slate `#767682` is the floor for text that must be read; fog `#a8a8b0` is
  placeholder and disabled state only, never a label or a score. Measure a new pairing
  rather than estimating it.
- Mobile is not a later pass. The column is fluid below 720px with a 16px gutter, the
  card loses its border and becomes the page, and the footer action goes full width. The
  countdown never falls below the fold.

## A screen with no precedent here

When the work is a surface these three do not cover, do not extrapolate from taste.
Research it the way this direction was researched: `refero_search_styles` for the visual
question and `refero_search_screens` for how real products lay that surface out, then
adapt the findings to the lock above rather than letting them relax it. If a finding and
the lock genuinely conflict, say so and let a human decide which gives way — quietly
softening the lock toward a safer middle is the failure mode this whole file guards.
**BACKGROUND:** the `refero-design` skill, which owns that research method.
