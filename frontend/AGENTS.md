# Frontend conventions

## Responsive layout

The app is styled predominantly with inline `style={{}}` objects (~5,100 of
them). An inline style object cannot hold a media query, so responsive
behaviour lives in a small set of **global classes in `src/app/globals.css`**,
prefixed `fx-`. Use them instead of writing a new `<style jsx>` override.

| Class | Replaces |
|---|---|
| `.fx-section` (+ `--xs/--sm/--lg`, `--tight-bottom`, `--flush-top/-bottom`) | `padding: "Npx 48px"` on a section |
| `.fx-gutter` | horizontal page padding only |
| `.fx-container` (+ `--xs … --wide`, `--full`) | `maxWidth: N` + `margin: '0 auto'` |
| `.fx-grid` (+ `--2 … --6`, `--fill`, `--gap-sm/-lg`) | `gridTemplateColumns: 'repeat(N, 1fr)'` |
| `.fx-stack`, `.fx-row` (+ `--between/--center/--gap`) | ad-hoc flex column / wrapping flex row |
| `.fx-scroll-x` | content that genuinely cannot reflow (wide tables, seating chart) |
| `.fx-break`, `.fx-truncate`, `.fx-min0` | long unbreakable tokens; flex/grid children that won't shrink |
| `.fx-safe-bottom/-top/-inset`, `.fx-safe-float-{t,r,b,l}`, `.fx-safe-scroll-b` | `position: fixed` elements under the notch / home indicator |

### The one rule that matters

**A class can never beat an inline style.** Adding `className="fx-section"`
while leaving `style={{ padding: "100px 48px" }}` in place does not error, does
not warn, and does not change anything at any viewport — the class is simply
inert. Migrating means **deleting** the inline `padding` / `maxWidth` /
`margin` / `gridTemplateColumns` / `gap` keys, and keeping every other key
(`background`, `border`, colours) exactly as it was.

Do **not** add `!important` to the `.fx-*` classes to work around this. Winning
over inline styles would mean that applying `.fx-section` to an element with
deliberate asymmetric padding silently destroys it — trading a loud, greppable
failure for a quiet visual one.

### Breakpoints

Four, and only four — Tailwind v4's active defaults:

| | width | use `up`/`down` |
|---|---|---|
| `sm` | 640px | `639.98px` for max-width |
| `md` | 768px | `767.98px` — the mobile↔desktop line |
| `lg` | 1024px | `1023.98px` |
| `xl` | 1280px | `1279.98px` |

`.98` rather than a whole pixel: at fractional CSS-pixel widths (browser zoom,
Windows display scaling, iOS pinch) a 1px gap between a `min-width: 768px` rule
and a `max-width: 767px` one leaves a band where neither matches.

- **JS:** import from `src/app/lib/breakpoints.js` (`BREAKPOINTS`, `up`, `down`,
  `between`) or use the hooks in `src/app/hooks/useMediaQuery.js`
  (`useIsMobile`, `useIsTablet`, `useIsDesktop`, `useIsTouch`,
  `useBreakpointUp/Down/Between`, `usePrefersReducedMotion`).
- **`globals.css`:** `@media (width >= theme(--breakpoint-md))`.
- **`<style jsx>`:** write the pixel literal. styled-jsx is compiled by SWC, not
  PostCSS, so `theme()` does not exist there — and a custom property is illegal
  in a media condition anywhere. The grep below is what keeps those literals
  honest.

Never introduce a fifth value. If something needs to change at 480px, fold it
into the `< sm` rule and check the result is also acceptable at 639px.

### styled-jsx has three silent failure modes

All three are why the primitives above are global classes. All three have
already caused production bugs in this repo:

1. A `<style jsx>` block inside a **nested, non-default-export component** does
   not reliably compile in this build (`FooterLink` in `FooterSection.js`,
   `PrintPreviewModal` in `seating-map/page.js` — both had to move to
   `globals.css`).
2. styled-jsx stamps its `jsx-<hash>` class only onto **lowercase intrinsic
   elements**. A scoped rule aimed at a class sitting on a `<motion.div>` (219
   of them across 35 files) compiles to `.foo.jsx-hash` and matches nothing.
3. A rule never reaches an element rendered by a **different function**.
   `pricing/page.js`'s `section { … }` override never applied to the
   `<section>` inside `CTASection.js`.

Also: a `<style jsx>` block is a **template literal**, so a backtick anywhere
inside it — including inside a CSS `/* comment */` — terminates the literal and
produces a parse error. Quote CSS identifiers in those comments with `"` or
nothing at all, never with a backtick. (JSX `{/* … */}` comments and ordinary
`//` comments are unaffected.)

### Horizontal overflow

`html { overflow-x: clip }` in `globals.css` is a **guard, not a fix** — it
hides overflow rather than removing it, and hidden overflow is *unreachable*,
not scrollable. Do not re-add `body { overflow-x: hidden }`; declaring it on
body makes `<body>` a scroll container on phones, which breaks
`position: sticky` and every `100dvh`.

To find what the guard is hiding, add `class="fx-debug-overflow"` to `<html>` in
devtools: the guard lifts and every element gets a hairline outline.

### Proving a layout fits (min-content width)

Verification here is arithmetic, not a browser. Inside an `.fx-section` the
available inline space is `V − 2 × padX(V)`:

```
320px viewport → 280.0px available   ← the binding constraint
360px          → 317.7px
390px          → 345.9px
```

Compute min-content width (MCW) bottom-up and show `MCW ≤ 280`:

| Construct | MCW |
|---|---|
| block box | `border-x + padding-x + max(MCW children)` |
| explicit `width`/`minWidth: W` | `W` — a hard floor that overrides everything below it |
| `repeat(N, 1fr)` | `N × max(MCW item) + (N−1) × gap` |
| `.fx-grid` | `max(MCW item)` — the track sizing contributes **zero** |
| flex `nowrap` | `Σ MCW(children) + (N−1) × gap` |
| flex `wrap` / `.fx-row` | `max(MCW children)` |
| text | longest unbreakable run ≈ `0.55 × fontSize × chars` |
| text with `.fx-break` | ≈ 1 character |
| `<table>` | `Σ per-column MCW` — unbounded; always needs `.fx-scroll-x` |
| anything inside `.fx-scroll-x` | 0 |

Two consequences worth internalising: a fixed 3-column grid of cards with 24px
padding needs each card's content to have an MCW of ≤29px to fit 320px, and a
2-column one needs ≤56px. Neither is achievable. **Fixed-column grids do not fit
phones — use `.fx-grid`.**

Note `overflow-wrap: break-word` (the global default on prose elements)
prevents *visual* overflow but does **not** reduce an element's min-content
contribution. Only `.fx-break` (`anywhere`) does. If your arithmetic assumes
text collapses, the element must carry `.fx-break`.

## Static checks

No dev server and no `node_modules` required.

### Inert classes and fixed-column grids

```bash
cd frontend
node scripts/responsiveCheck.js     # exits non-zero on any finding
```

Enforced by `test/responsiveCheck.test.js`, which also asserts the checker
still detects a known-bad fixture — a checker that reports "clean" because it
is broken is the failure mode this replaced.

**This used to be three `grep -A3` pipelines and a `repeat(N, 1fr)` grep. Do
not go back to them.** Audited 2026-08-16: on an unchanged tree they reported
9 inert classes and 21 fixed grids, and **all 30 were false positives** —

- `grep -A3` reports a `padding` three lines down that belongs to a **child**,
  and misses a long tag whose `style` starts on line 5. The class and the
  inline key have to be on the *same JSX tag*, which needs brace-aware parsing.
- Five "fixed grids" were the text `repeat(3, 1fr)` inside a **comment saying
  the grid had been removed**. Comments must be stripped first.
- A `repeat(N, 1fr)` whose class a narrow-width `@media` re-declares is
  correct, and so is a bounded decorative mosaic (`width: 72px`). Neither the
  grep nor a reader skimming 21 lines can tell those from a real one.
- Worst: **`src --include=*.js` silently skips every `[slug]` route.** Both
  bash and PowerShell read `[slug]` as a character class, so the guest page,
  the RSVP wizard and the ticket routes had never once been scanned.

A check with a 100% false-positive rate and a blind spot over the guest page is
worse than no check: it teaches you the output is noise, and that is where a
real finding goes to die.

### The rest

```bash
cd frontend

# Breakpoint allowlist — every media condition must be on the scale.
grep -rnoE '\((max|min)-width: *[0-9.]+px\)' src --include=*.js --include=*.css \
  | grep -vE ': *(639\.98|640|767\.98|768|1023\.98|1024|1279\.98|1280|44)px'

# The overflow guard must not come back on body. (Component-level
# overflow-x: hidden is fine — this looks only for the body/html rule.)
grep -rnE '^\s*(html|body)[^{]*\{' -A6 src/app/globals.css | grep "overflow-x"

```

**A backtick inside a CSS comment in a `<style jsx>` block** ends the template
literal — a parse error, not a style bug. It has bitten repeatedly; use `"`
instead. There used to be a grep for it here, and it was removed on
2026-08-16: it cannot tell a CSS comment from an ordinary JS one, so it fired
on five perfectly good `/* … `fn` … */` JSDoc comments and nothing else.
`npx next build` catches the real thing outright, because it *is* a syntax
error. Run the build; don't grep for this.

These three carry the same `[slug]` blind spot. On Windows, `Get-ChildItem
-Include` has it too — use `-LiteralPath`, or `Get-ChildItem -Recurse -File |
Where-Object { $_.Extension -eq '.js' }`, which never builds a glob.
