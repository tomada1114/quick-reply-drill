# Tokens and component recipes

The concrete values behind the lock in `SKILL.md`. Every value here traces to a Refero
reference or to a measured contrast requirement; the source column is what stops a later
edit from inventing a hue.

## Colors

Color has three jobs in this system, and a hue never moves between them.

### Theme — green

The brand. It says "this is Quick Reply Drill" and "this is the thing to press"; it
never says "this score is good".

| Token                  | Value     | Source                    | Role — and only this role                                                            |
| ---------------------- | --------- | ------------------------- | ------------------------------------------------------------------------------------ |
| `--color-paper`        | `#ffffff` | Upstash Paper White       | The card, and the page below 720px.                                                  |
| `--color-ground`       | `#ebf4f2` | Upstash 8% tint, on white | The page behind the card at 720px and up. Never a card fill.                         |
| `--color-inset`        | `#ebf4f2` | Upstash 8% tint, on white | Input and textarea fill, the model-reply block, the disabled button.                 |
| `--color-tint-strong`  | `#dcece7` | Upstash tint at 14%       | Chart grid rings and gridlines; the hover fill of a tinted control.                  |
| `--color-rule`         | `#e2ebe6` | Upstash Sky Mist, greened | Every 1px border and divider. Replaces shadows.                                      |
| `--color-ink`          | `#022c22` | Upstash Forest Pine       | Headings, the question, the total, table figures, and the label on the action.       |
| `--color-body`         | `#1f3d34` | Forest Pine, lightened    | Body prose, comments, the model reply.                                               |
| `--color-slate`        | `#5c6d65` | Upstash Graphite, greened | Captions, secondary meta, `/100`, chart axis text.                                   |
| `--color-fog`          | `#a3b1aa` | slate, lightened          | Placeholder and disabled only. Never a label, never a score.                         |
| `--color-action`       | `#00bc7d` | Upstash Spring Bud        | The one filled button per screen, the chart's area fill, the sparkline's latest dot. |
| `--color-action-hover` | `#00a56e` | Spring Bud, darkened      | The action's hover and pressed fill, and every theme-green chart stroke.             |
| `--color-on-action`    | `#022c22` | measured, see below       | The label on the action. Ink, not white.                                             |
| `--color-link`         | `#007a55` | Upstash Evergreen         | Inline links, mono micro-labels, the focus ring.                                     |

### Score scale — blue, amber, pink

How good a number is, and nothing else. Deliberately not green and not red, so the scale
can never be mistaken for the theme or for the countdown. Each level has a saturated
mark color for graphics, an ink for text, and a tint for the chip or table cell behind
that text.

| Level | Item `/5` | Criterion `/10` | Mark                     | Ink                          | Tint                          |
| ----- | --------- | --------------- | ------------------------ | ---------------------------- | ----------------------------- |
| high  | 4-5       | 8-10            | `--color-high` `#3b82e0` | `--color-high-ink` `#1a5fb4` | `--color-high-tint` `#e0ebf8` |
| mid   | 2-3       | 4-7             | `--color-mid` `#f5a524`  | `--color-mid-ink` `#8a5208`  | `--color-mid-tint` `#fdefd8`  |
| low   | 0-1       | 0-3             | `--color-low` `#d6408f`  | `--color-low-ink` `#ad1f6b`  | `--color-low-tint` `#f6e0ec`  |

Source: OneSoil's dashboard gives each reading a tinted value chip in the hue of its
chart; Upstash's Warm Gold is the amber. A delta reuses the scale's two ends — a rise is
high, a fall is low, no change is slate — because "better" and "worse" are the same
judgement the scale already makes. The total `/100` stays ink: it is the headline, and
its delta chip beside it carries the color.

The scale is never the only signal. A level color always sits on a digit (`4 / 5`), a
glyph (`▲`, `▼`), or a legend chip, so it survives a colorblind reader and a grayscale
screenshot.

### Status — red

| Token            | Value     | Source                          | Role — and only this role                                     |
| ---------------- | --------- | ------------------------------- | ------------------------------------------------------------- |
| `--color-status` | `#c0362c` | imgs.so badge role, red per #64 | The last ten seconds and the forced-submit tag. Nothing else. |

A low score is pink, never red. A validation failure is body text under the field plus
the field's border darkening to ink, never red.

### Measured contrast

WCAG relative luminance. Against `--color-paper`: ink 15.2:1, body 11.8:1, slate 5.5:1,
link 5.4:1, status 5.5:1, high-ink 6.3:1, mid-ink 6.4:1, low-ink 6.6:1, fog 2.2:1 —
which is why fog is placeholder-only. Against `--color-ground`/`--color-inset`: ink
13.5:1, body 10.6:1, slate 4.9:1, link 4.8:1, status 4.9:1. Each level ink on its own
tint: high 5.2:1, mid 5.6:1, low 5.3:1.

The three level tints are 1.2:1 or less against paper (high 1.21, mid 1.13, low 1.25),
so a tinted cell or chip is a _second_ reading of a figure, never the reading itself —
which is the measured reason behind the rule that a level colour always sits on a digit
or a glyph. `--color-tint-strong` is the same order (1.22:1 on paper, 1.09:1 on ground):
it draws a grid a chart is read against, and it can never be what carries a value.

`--color-on-action` is ink because white on `--color-action` is 2.5:1 and fails; ink on
it is 6.1:1. Upstash itself ships the white label — this is the one place the reference
is overruled, by a measurement. For the same reason `--color-action` is never text on
paper (2.5:1); green text is `--color-link`.

Graphics need 3:1. `--color-action-hover` is 3.2:1 on paper, so chart strokes use it
rather than `--color-action`. `--color-mid` is 2.0:1, so a level dot is always ringed in
its level ink. The rule color is 1.2:1 and is never the only thing separating two
interactive regions — it separates, it does not signal.

## Typography

Unchanged from the previous lock: the complaint it answered was color, not type, and the
mono figures are what keep this recognisably the same product. Two families, loaded
through `next/font/google`, with `display: "swap"` and the subset this app actually
needs.

| Token         | Family        | Weights       | Carries                                                                                                                 |
| ------------- | ------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `--font-sans` | Rubik         | 400, 500      | Prose, comments, labels, buttons, the dashboard paragraph.                                                              |
| `--font-mono` | IBM Plex Mono | 400, 600, 700 | The question, the countdown, all figures, table headers, micro-labels. 700 is the urgent/expired countdown weight only. |

Scale — sizes are fixed tokens, not ad-hoc utilities:

| Token             | Size | Line height | Tracking   | Used for                                       |
| ----------------- | ---- | ----------- | ---------- | ---------------------------------------------- |
| `--text-micro`    | 11px | 1.0         | `0.08em`   | Mono caps labels (`MODEL REPLY`, column heads) |
| `--text-caption`  | 12px | 1.78        | `0.016em`  | Captions, scenario line, timestamps, chips     |
| `--text-body`     | 14px | 1.5         | `0.056em`  | Comments, prose, table figures                 |
| `--text-body-lg`  | 16px | 1.5         | —          | The textarea, the dashboard paragraph          |
| `--text-question` | 28px | 1.25        | `-0.021em` | The question, mono 400                         |
| `--text-figure`   | 48px | 1.0         | `-0.021em` | The countdown and the total, mono 600          |

Mono numerals use `font-variant-numeric: tabular-nums` everywhere, so the countdown does
not jitter and the score column stays a straight edge.

## Shape, space, elevation

- Radius: `9999px` on buttons; `6px` on inputs, the textarea, chips, and table cells;
  `16px` on cards and the model-reply block. Source: Upstash's pill buttons, 6px inputs,
  16px cards. The pill is for buttons only — a chip is not a pill.
- Spacing steps: 4, 8, 12, 16, 24, 32, 48, 64. Card padding 24px; 16px on a narrow
  viewport. Element gap inside a zone 12px; between card zones 24px.
- Elevation: none. `--shadow-card` is a 1px ring in rule, kept under its old name so the
  card does not change class; the card separates from the page by being paper on ground.
  Source: Upstash's "no box-shadows; depth from background shifts and borders".
- Column: `max-width: 720px`, centered, 16px gutter below that width.

## The `@theme` block

Declare all of the above once in the global stylesheet so the values reach both Tailwind
utilities and any raw CSS. That second half needs `@theme static`, not plain `@theme`:
Tailwind's default `@theme` only emits the runtime CSS variable for a token some utility
class already uses, so a token nothing has reached for yet compiles away, and
hand-written CSS that references it with `var()` resolves to nothing.

```css
@import "tailwindcss";

@theme static {
  --color-paper: #ffffff;
  --color-ground: #ebf4f2;
  --color-inset: #ebf4f2;
  --color-tint-strong: #dcece7;
  --color-rule: #e2ebe6;
  --color-ink: #022c22;
  --color-body: #1f3d34;
  --color-slate: #5c6d65;
  --color-fog: #a3b1aa;
  --color-action: #00bc7d;
  --color-action-hover: #00a56e;
  --color-on-action: #022c22;
  --color-link: #007a55;
  --color-status: #c0362c;

  --color-high: #3b82e0;
  --color-high-ink: #1a5fb4;
  --color-high-tint: #e0ebf8;
  --color-mid: #f5a524;
  --color-mid-ink: #8a5208;
  --color-mid-tint: #fdefd8;
  --color-low: #d6408f;
  --color-low-ink: #ad1f6b;
  --color-low-tint: #f6e0ec;

  --font-sans: var(--font-rubik), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-plex-mono), ui-monospace, monospace;

  --radius-control: 6px;
  --radius-card: 16px;
  --radius-button: 9999px;

  --shadow-card: 0 0 0 1px #e2ebe6;
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

**Page.** `background: ground` at 720px and up, so the paper card reads as a sheet laid
on a green desk. Below 720px the page is paper and the card dissolves into it.

**Card.**
`background: paper; border-radius: 16px; box-shadow: --shadow-card; padding: 24px`.
Below 720px: no ring, no radius — the card becomes the page. The countdown's urgent
state adds its 3px bar to this same `box-shadow` (`inset 0 3px 0 status`) rather than to
a border, so nothing on the screen moves at the moment the clock turns red. Each state
writes the whole shadow, ring included: two shadow utilities on one element are settled
by the order they were generated in, not by which was written last.

**Zone divider.** `border-top: 1px solid rule` with 24px of space on each side. This is
the only separator inside a card; do not reach for a background change.

**Countdown.** Mono 600 at `--text-figure`, ink, tabular numerals, formatted `0:21`.
Under ten seconds: color becomes status, the figure moves to 700, and the card's top
edge gains a 3px status bar. No pulse, no ring, no draining bar. At zero the figure
reads `0:00` and a micro-label `TIME UP` in status sits beside it.

**Question.** Mono 400 at `--text-question`, ink, `text-wrap: balance`, max 60
characters per line. The scenario line above it is caption-size Rubik in slate, sentence
case.

**Textarea.**
`background: inset; border: 1px solid transparent; radius 6px; padding: 12px 14px`,
Rubik at `--text-body-lg`, body color, placeholder in fog. Focus: border goes link and a
2px link ring at 2px offset. It is autofocused when a rep starts.

**Primary action.**
`background: action; color: on-action; radius 9999px; padding: 10px 28px`, Rubik 500 at
`--text-body`. Hover and pressed: `action-hover`. One per screen. Disabled:
`background: inset; color: fog`, with the reason in caption text beside it rather than a
tooltip. Focus: a 2px link ring at 2px offset.

**Micro-label.** Mono caps at `--text-micro`, in link. This is where the theme green
shows up as text: `MODEL REPLY`, `TOTAL · LAST 9 REPS`. Table column heads stay slate so
a dense header row does not turn green.

**Score chip.** Mono at `--text-caption`, tabular numerals,
`padding: 4px 9px; radius 6px`, `background: <level>-tint; color: <level>-ink`. Carries
`4 / 5`, `7 / 10`, or a delta. It is a label, not a control: no hover, no border, no
pointer.

**Delta.** A score chip: `+4 ▲` at the high level, `-2 ▼` at the low level, `±0` as
plain slate text with no chip. The sign and glyph stay; the color is added to them, not
substituted for them.

**Score table.** Inside a criterion's disclosure. Mono at `--text-body`. Item label left
in body color, score right-aligned as a score chip. The closed disclosure row carries
the criterion name in Rubik 500 and its `/ 10` subtotal as a score chip. Rows are
separated by `--color-rule`, never by a zebra fill.

**Runs table.** The dashboard's history as a heat table: one column per rubric _item_,
all eight, in rubric order — not one per criterion, because a criterion's subtotal
averages its two items and hides exactly the weak one this table exists to surface. Each
sub-score cell is `background: <level>-tint; color: <level>-ink; radius 6px` with 3px
between cells, so a weak item shows as a pink stripe down the table before a digit is
read. The date column is slate, the total column is ink 600 with no fill. Column heads
in `--text-micro` caps, slate. Ten columns do not fit a phone, so the table scrolls
inside its own container — never the page.

**Total.** Mono 600 at `--text-figure` in ink, with `/100` in slate at `--text-body`
sitting on the baseline beside it, and the delta chip at the row's right edge.

**Model reply.** A block with `background: inset; radius 6px; padding: 12px 14px`, the
reply itself in Rubik at `--text-body-lg` and body color, above it the micro-label
`MODEL REPLY`.

**Trend chart.** The dashboard's total over recent reps. Stroke `action-hover` at 2px
with round joins; under it an area fill that fades from `action` at 28% opacity to 0 at
the baseline — the one gradient in the system, and only here. Dotted gridlines (`1.5 3`
dash) in `tint-strong` at 50 and 100, each labeled in slate mono on the right. The
latest point is a 4.5px `action` dot with a 2px paper ring. No other points, no legend,
no tooltip, no animation. The vertical scale is fixed 0-100, never fit to the data.
Source: OneSoil's line-plus-soft-area charts; the dotted grid is Operate's.

This drawing is one SVG that scales to its container's width, which has two consequences
worth stating rather than rediscovering. Its px figures above are the drawing's own
units at the reference width, so every stroke carries
`vector-effect: non-scaling-stroke` and stays the stated weight at any size. And the two
gridline readings are HTML positioned beside the drawing rather than `<text>` inside it,
at `--text-micro`: text inside a scaling drawing is the one thing that must not scale,
because it would land near 8px on a phone and 15px on a wide card, and be the type
scale's size at neither.

**Score radar.** The feedback screen's eight sub-scores, drawn with Recharts through the
`ChartContainer` copy in `src/components/ui/chart.tsx`. Grid rings and spokes in
`tint-strong`, one ring per score level 0-5, inner rings dotted (`1.5 3`) and the outer
ring solid, no radius ticks. The learner's shape is theme green — stroke `action-hover`
at 2px, fill `action` at 16% — because the shape is "you", not a judgement. The
judgement is on the vertices: each axis carries a 4.5px dot filled with its level's mark
color and ringed 1.5px in its level ink. Each axis label is two lines: the criterion's
mono micro-label in slate caps above the item's short name in mono ink. Under the chart,
a three-chip legend (`4–5 strong`, `2–3 developing`, `0–1 focus here`). No tooltip, no
second _reading_, no animation. The wrapper is one `role="img"` whose accessible name
lists every sub-score by its full rubric label, so the drawing itself carries nothing a
reader would otherwise miss.

Recharts draws the grid as one element with one stroke for every ring, so the dotted
inner rings and the solid outer one are three pieces, not one: a `PolarGrid` for the
dotted rings with its spokes off, a second `PolarGrid` with an empty `polarRadius` for
the solid spokes, and the outer ring as a constant `max: 5` series. That last one is
geometry, not a comparison — it is what "no second reading" above rules out, and it sits
before the learner's shape so it draws behind it.

## Anti-slop checklist for a finished screen

Before calling a screen done, confirm none of these is true: a hue doing a job outside
its group (green on a score, a level color on a button, red on a low score); a level
color with no digit, glyph or legend beside it; a gradient anywhere but the trend
chart's area; a ring or donut for a number; a pill that is not a button; a shadow; an
emoji, a mascot, a streak flame or confetti; an entrance animation on the question; a
white label on the green action; a hue used because it "reads friendly" rather than
because a row in the color tables gave it that job.
