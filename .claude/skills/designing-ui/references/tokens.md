# Tokens and component recipes

The concrete values behind the lock in `SKILL.md`. Every value here traces to a Refero
style reference; the source column is what stops a later edit from inventing a hue.

## Colors

| Token            | Value     | Source                          | Role — and only this role                                            |
| ---------------- | --------- | ------------------------------- | -------------------------------------------------------------------- |
| `--color-paper`  | `#ffffff` | SST                             | The page and the card. No tinted section backgrounds anywhere.       |
| `--color-inset`  | `#f5f5f5` | imgs.so                         | Input and textarea fill. Not a card, not a section, not a table row. |
| `--color-rule`   | `#e8e8f2` | SST                             | Every 1px border and divider. Replaces shadows.                      |
| `--color-ink`    | `#111111` | SST                             | Headings, the question, the total score, table figures.              |
| `--color-body`   | `#403f53` | SST                             | Body prose, comments, the model reply.                               |
| `--color-slate`  | `#767682` | SST                             | Labels, captions, secondary meta, `/100`.                            |
| `--color-fog`    | `#a8a8b0` | SST                             | Placeholder and disabled only. Never a label, never a score.         |
| `--color-action` | `#1c2024` | imgs.so                         | The one filled button per screen, and its white label.               |
| `--color-status` | `#c0362c` | imgs.so badge role, red per #64 | The last ten seconds and the forced-submit tag. Nothing else.        |
| `--color-link`   | `#303055` | SST                             | Inline text links only, never a button fill.                         |

Measured against `--color-paper`: ink 18.9:1, body 10.2:1, slate 4.5:1, action 16.4:1,
status 5.52:1, link 12.5:1, fog 2.3:1. Fog is why it is placeholder-only. White on
action is 16.4:1. The rule color is 1.1:1 and is therefore never allowed to be the only
thing separating two interactive regions — it separates, it does not signal.

`--color-status` was measured with the WCAG relative-luminance formula against
`--color-paper` when it moved from the muted amber `#9a5421` to the clear red `#c0362c`
in #64: `#c0362c` on `#ffffff` is 5.52:1, clearing the 4.5:1 floor with headroom.

No success green and no error red exist in this system. A score that fell is a minus
sign and a `▼` glyph in ink, not a red chip; a validation failure is body text under the
field plus the field's border darkening to ink.

## Typography

Two families, loaded through `next/font/google`, with `display: "swap"` and the subset
this app actually needs.

| Token         | Family        | Weights  | Carries                                                                |
| ------------- | ------------- | -------- | ---------------------------------------------------------------------- |
| `--font-sans` | Rubik         | 400, 500 | Prose, comments, labels, buttons, the dashboard paragraph.             |
| `--font-mono` | IBM Plex Mono | 400, 600 | The question, the countdown, all figures, table headers, micro-labels. |

Scale — sizes are fixed tokens, not ad-hoc utilities:

| Token             | Size | Line height | Tracking   | Used for                                       |
| ----------------- | ---- | ----------- | ---------- | ---------------------------------------------- |
| `--text-micro`    | 11px | 1.0         | `0.08em`   | Mono caps labels (`MODEL REPLY`, column heads) |
| `--text-caption`  | 12px | 1.78        | `0.016em`  | Captions, scenario line, timestamps            |
| `--text-body`     | 14px | 1.5         | `0.056em`  | Comments, prose, table figures                 |
| `--text-body-lg`  | 16px | 1.5         | —          | The textarea, the dashboard paragraph          |
| `--text-question` | 28px | 1.25        | `-0.021em` | The question, mono 400                         |
| `--text-figure`   | 48px | 1.0         | `-0.021em` | The countdown and the total, mono 600          |

Mono numerals use `font-variant-numeric: tabular-nums` everywhere, so the countdown does
not jitter and the score column stays a straight edge.

## Shape, space, elevation

- Radius: `4px` on buttons, inputs, and the textarea; `8px` on cards and the model-reply
  block. Nothing is a pill, nothing is a circle.
- Spacing steps: 4, 8, 12, 16, 24, 32, 48, 64. Card padding 24px; 16px on a narrow
  viewport. Element gap inside a zone 12px; between card zones 24px.
- Elevation: one shadow exists,
  `0 1px 3px rgb(0 0 0 / 0.1), 0 1px 2px rgb(0 0 0 / 0.06)`, on the drill and feedback
  card. Everything else is separated by `--color-rule`.
- Column: `max-width: 720px`, centered, 16px gutter below that width.

## The `@theme` block

Declare all of the above once in the global stylesheet so the values reach both Tailwind
utilities and any raw CSS. That second half needs `@theme static`, not plain `@theme`:
Tailwind's default `@theme` only emits the runtime CSS variable for a token some utility
class already uses, so a token nothing has reached for yet —
`--text-caption--line-height` before the drill screen exists to use it — compiles away,
and hand-written CSS that references it with `var()` resolves to nothing.

```css
@import "tailwindcss";

@theme static {
  --color-paper: #ffffff;
  --color-inset: #f5f5f5;
  --color-rule: #e8e8f2;
  --color-ink: #111111;
  --color-body: #403f53;
  --color-slate: #767682;
  --color-fog: #a8a8b0;
  --color-action: #1c2024;
  --color-status: #c0362c;
  --color-link: #303055;

  --font-sans: var(--font-rubik), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-plex-mono), ui-monospace, monospace;

  --radius-control: 4px;
  --radius-card: 8px;

  --shadow-card: 0 1px 3px rgb(0 0 0 / 0.1), 0 1px 2px rgb(0 0 0 / 0.06);
}
```

There is no dark theme. Adding one is a design decision, not a styling convenience: it
would need its own reference research, because inverting these tokens produces the
averaged dark UI the lock rejects.

`body` names both a color and a text size, and Tailwind resolves a bare `text-body`
class as the color every time — a size utility never wins that tie. Reach for the color
through `text-(color:--color-body)` and for the size through
`text-[length:var(--text-body)]` (pairing it with
`leading-[var(--text-body--line-height)]` and
`tracking-[var(--text-body--letter-spacing)]` for the line height and tracking a plain
`text-{other-size}` utility would otherwise carry for you). No other token pair in this
list collides.

## Component recipes

**Card.**
`background: paper; border: 1px solid rule; border-radius: 8px; box-shadow: --shadow-card; padding: 24px`.
Below 720px: no border, no shadow, no radius — the card becomes the page.

**Zone divider.** `border-top: 1px solid rule` with 24px of space on each side. This is
the only separator; do not reach for a background change.

**Countdown.** Mono 600 at `--text-figure`, ink, tabular numerals, formatted `0:21`.
Under ten seconds: color becomes status, and the card's top rule goes to 2px in status.
No pulse, no ring, no bar. At zero the figure reads `0:00` and a micro-label `TIME UP`
in status sits beside it.

**Question.** Mono 400 at `--text-question`, ink, `text-wrap: balance`, max 60
characters per line. The scenario line above it is caption-size Rubik in slate, sentence
case.

**Textarea.**
`background: inset; border: 1px solid rule; radius 4px; padding: 12px 14px`, Rubik at
`--text-body-lg`, body color, placeholder in fog. Focus: border goes ink and a 2px ink
ring at 2px offset. It is autofocused when a rep starts.

**Primary action.** `background: action; color: paper; radius 4px; padding: 10px 24px`,
Rubik 500 at `--text-body`. One per screen. Disabled: `background: inset; color: fog`,
with the reason in caption text beside it rather than a tooltip.

**Score table.** Mono at `--text-body`. Column heads in `--text-micro` caps, slate.
Criterion rows: label left in body color, score right-aligned in ink as `4 / 5`. A group
header row carries the criterion name in Rubik 500 and its own subtotal. Rows are
separated by `--color-rule`, never by a zebra fill. Delta against the previous rep, when
shown, is mono ink: `+3 ▲` or `-2 ▼`, no color.

**Total.** Mono 600 at `--text-figure` in ink, with `/100` in slate at `--text-body`
sitting on the baseline beside it.

**Model reply.** A block with `border: 1px solid rule; radius 8px; padding: 16px`, the
reply itself in Rubik at `--text-body-lg` and body color, above it the micro-label
`MODEL REPLY` in mono caps, slate.

**Sparkline.** Stroke in ink at 1.5px on a paper ground, no fill, no gridlines, no axis
labels, no points except the latest one as a 3px ink dot. It is decoration with a job;
if it needs a legend it has become a chart, and a chart is not in this system.

## Anti-slop checklist for a finished screen

Before calling a screen done, confirm none of these is true: a rounded-full element; a
gradient anywhere; a second hue on the page; a colored score chip; a ring or donut for a
number; an emoji or mascot; an entrance animation on the question; a shadow on anything
but the card; a hue used because it "reads friendly" rather than because a row in the
color table gave it that job.
