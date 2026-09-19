---
name: designing-ui
description: >
  Covers this app's visual language: the locked "Spring on Paper" direction — white
  paper on a green-tinted ground, IBM Plex Mono figures, one spring-green pill action,
  and a blue/amber/pink score scale kept apart from the green theme — its Tailwind v4
  @theme tokens, and the layout of the drill, feedback, and dashboard screens. Use when
  building or restyling a component under src/, choosing a color, type size, radius,
  spacing, or motion, adding a shadcn/ui component, styling the countdown, a score chip,
  the radar, or the trend chart, or researching a screen with no precedent here.
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

This lock replaced the monochrome "Blueprint on Paper" one. `globals.css` carries the
new token values; a component that still shows the old look — an ink-only chart, a
square charcoal-era button, an uncolored score — is unmigrated, not precedent. This file
is the target.

## The lock

The direction was settled from Refero research, not from taste: three full style
references (Upstash, Operate, Deno) compared on the same drill card, two chart screens
(OneSoil, Memotron), and a human choice between the three. It is locked, which means a
later screen adapts to it rather than renegotiating it.

```text
Primary reference:  Upstash (upstash.com) — "crisp alpine air": white paper, Forest Pine
                    ink instead of black, one vivid Spring Bud green for action, 8% green
                    tint surfaces instead of shadows, pill buttons and 16px cards.
Preserve:           green-black ink, never neutral black; the single saturated green on
                    the action; depth from paper-on-tint and hairline rules, no shadow;
                    pill buttons with 16px cards; IBM Plex Mono carrying every figure and
                    the question itself; one contained centered column.
Borrow only:        OneSoil — a line with a soft area fill under it, and a reading shown
                    as a tinted chip in its own hue. Operate — the dotted plot grid,
                    inside charts only.
Role rules:         color has three jobs and a hue never changes job. Green is the theme
                    (action, focus, links, micro-labels, tint, the learner's own shape in
                    a chart) and never means "good". The score scale — blue high, amber
                    mid, pink low — says how good a number is and appears nowhere else.
                    Red #c0362c is status only (the last ten seconds, the forced submit).
                    Upstash's gradient headline and Warm Gold word-highlights stay out.
Media strategy:     no photography, no illustration, no mascot. The typeset page is the
                    image. Two graphics, both code-native and both colored: the
                    dashboard's trend chart and the feedback screen's radar.
Reject:             score rings and donuts, progress bars as decoration, gradients
                    outside the trend chart's area fill, indigo/violet brand accents,
                    green-for-good and red-for-bad score colors, a level color with no
                    digit or glyph beside it, streak flames, confetti, glassmorphism,
                    shadows, a white label on the green action.
Memorable move:     a green desk, a white sheet, and marks in three inks — the theme
                    draws your shape, the scale grades its corners, and the countdown is
                    still the only thing that turns red.
```

Ledger for the choices that a reader would otherwise have to take on trust:

| Decision                                      | Source                               | Why                                                                                                     |
| --------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| White sheet, green-black ink, tint not shadow | Upstash style (primary)              | Keeps the graded-answer-sheet metaphor while removing the neutral greys that made it read as inorganic  |
| Spring-green pill as the one action           | Upstash CTA role                     | The brand hue lives where the hand goes; a pill is the friendliest shape the source offers              |
| Ink label on the action, not white            | measured contrast, overrules Upstash | White on `#00bc7d` is 2.5:1; ink is 6.1:1                                                               |
| Mono for question, timer, and every score     | kept from the previous lock (SST)    | Figures must be scannable in the two seconds between reps, and mono digits do not reflow                |
| Score scale is blue/amber/pink, not green/red | human decision; OneSoil chip role    | Green is the theme and red is the clock, so "how good" needs hues neither of them owns                  |
| Level color always beside a digit or glyph    | craft rule (colorblind, grayscale)   | The scale adds to `4 / 5` and `▲`; it never replaces them                                               |
| Radar shape in theme green, vertices in scale | Memotron wheel + the role rules      | The outline is "you", not a verdict; the verdict sits on each corner, so the weak axis is a pink dot    |
| Trend line with a fading area, dotted grid    | OneSoil charts, Operate grid         | A bare ink stroke was the least appealing thing on the page; the fill gives the trend a body            |
| Dashboard history as a heat table             | OneSoil tinted chips                 | A weak sub-score becomes a pink column visible before any digit is read                                 |
| Red reserved for the last ten seconds         | imgs.so status-badge role (kept)     | Urgency is a status, not a score                                                                        |
| Card: timer top-left, action bottom-right     | Duolingo English Test timed quiz     | The one timed-answer pattern with real usage evidence; reps read left-to-right, top-down                |
| No score ring for the total                   | rejected (Promova results card)      | A ring reads as a badge; eight sub-scores need a radar and rows, and the total belongs in the same type |
| Sub-scores as a radar, details collapsed      | Memotron wheel, Attio collapse       | A dent in one outline finds the weak item faster than eight rows; the rows stay one click away          |

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

Every screen is the same centered column on the ground color, holding one paper card.

**Idle.** The card reduced to one clear entry point. A one-line Rubik explanation
(`One question, a timed reply, then feedback.`) sits above a large centered green
`Start` action. During question loading, keep that action disabled and place the shared
slate status beside it; on failure, keep `Retry` and the inline error text. No secondary
action belongs inside the card.

**Drill.** One centered column, max width 720px, vertically centered on the viewport. A
single card with three zones separated by hairline rules: a header row with the
countdown at the left and the scenario line (who is asking, in slate) at the right; the
body with the question in mono at display size and the tinted textarea below it; a
footer with the character-light hint at the left and the green Send at the right.
Nothing else is on the screen — no navigation, no score history, no streak — and no
score-scale color: nothing has been graded yet. While scoring, lock the submitted
textarea with slate text, place the shared `Scoring your reply` status in the body, and
dim the countdown with a mono `STOPPED` marker; the answering state has none of those
scoring markers.

**Feedback.** Same column and card, built to be looked at before it is read. The total
sits alone at the top as the largest mono figure in ink with `/100` in slate at body
size, the delta chip and the `FORCED` tag beside it. Under a hairline rule, the eight
sub-scores are one radar (the score radar recipe in `references/tokens.md`): one axis
per rubric item in rubric order, so each criterion's two items sit side by side and
share its mono micro-label, the shape in theme green and each vertex dot in its level
color, with the three-chip legend beneath. The radar carries a text equivalent naming
every sub-score. Below it, one native disclosure per criterion, collapsed by default:
the closed row shows the criterion and its `/ 10` subtotal as a score chip, and opening
it shows its two sub-scores as the score table followed by the criterion's comment as
prose. Then the model reply in a tinted block under the micro-label `MODEL REPLY`. The
next-question action is the green button in the footer, in the same position Send
occupied, so the rep loop never moves the pointer.

**Dashboard.** The trend chart for the total first, under its micro-label, with the
delta across the whole drawn window as a chip at the row's right. Then the recent runs
as one mono heat table, newest first, one row per rep, one column per rubric item — all
eight, abbreviated to mono micro-labels — and every sub-score cell tinted by level. The
AI's paragraph renders as prose in Rubik below the table, in a measure of 65-75
characters, with the button that requests it directly above.

## Craft rules

- Type: Rubik for prose, labels, and buttons; IBM Plex Mono for the question, the
  countdown, every score, table headers, and micro-labels. No third family, no italics,
  no decorative word swap in a heading.
- Before coloring anything, name which of the three jobs the color is doing — theme,
  score scale, or status. If the answer is "none, it just looks nicer", it stays ink,
  slate, or paper. Friendliness here comes from the ground, the shapes and the chips,
  not from adding a fourth job.
- A level color never travels alone: it sits on a digit, a `▲`/`▼`, or a legend chip.
  The countdown's red likewise changes form as well as hue — the figure gains weight and
  the card's top edge gains a bar — so both survive a colorblind reader and a grayscale
  screenshot.
- Motion is functional and short: 120-160ms on state changes, no entrance animation on
  the question (it must be readable the instant the clock starts), no number roll-up on
  the score, no chart draw-in. The countdown does not pulse. Honor
  `prefers-reduced-motion` by dropping every transition, which this design can afford
  because none of them carries meaning.
- Loading uses one shared inline status treatment: the slate caption plus a mono
  ellipsis. The ellipsis may pulse while a request is in flight;
  `prefers-reduced-motion` leaves it static. Use this treatment for every request wait,
  not a spinner, progress bar, or new hue.
- A hand-written caption `<p>` silently inherits `globals.css`'s base `<p>` bottom
  margin, which only shows up as a bug beside a button in a flex row (issue #57); render
  a caption through `src/components/shared/caption.tsx`'s `Caption` instead, which
  zeroes that margin by default.
- Focus is visible on every control: a 2px `--color-link` ring offset 2px, never removed
  to tidy the textarea. The textarea is the first focused element when a rep starts,
  with no click required.
- Enabled buttons use a pointer cursor to expose their click affordance; disabled
  buttons use the not-allowed cursor and the fog treatment already defined by the
  primary-action recipe. A score chip is not a control and gets neither.
- Contrast: slate is the floor for text that must be read; fog is placeholder and
  disabled state only, never a label or a score. `--color-action` is a fill, never text
  on paper — green text is `--color-link`. Text on a level tint uses that level's ink.
  `references/tokens.md` holds the measured ratios; measure a new pairing rather than
  estimating it.
- Mobile is not a later pass. The column is fluid below 720px with a 16px gutter, the
  page turns from ground to paper, the card loses its ring and radius and becomes the
  page, and the footer action goes full width. The countdown never falls below the fold,
  and the runs table scrolls inside its own container rather than the page.

## A screen with no precedent here

When the work is a surface these three do not cover, do not extrapolate from taste.
Research it the way this direction was researched: `refero_search_styles` for the visual
question and `refero_search_screens` for how real products lay that surface out, then
adapt the findings to the lock above rather than letting them relax it. If a finding and
the lock genuinely conflict, say so and let a human decide which gives way — quietly
softening the lock toward a safer middle is the failure mode this whole file guards.
**BACKGROUND:** the `refero-design` skill, which owns that research method.
