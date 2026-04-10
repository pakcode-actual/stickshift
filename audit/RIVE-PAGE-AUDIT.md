# Rive Page — Lighthouse & Accessibility Audit

**Date:** 2026-04-09
**Page:** `rive-test.html`
**Tools:** Lighthouse 12.x, axe-core 4.11 (via Playwright)

---

## Lighthouse Scores

| Category | Score |
|---|---|
| **Performance** | **100** |
| **Accessibility** | **81** → **fixed** (see below) |
| **Best Practices** | **96** |
| **SEO** | **82** |

### Performance Metrics (all green)

| Metric | Value | Score |
|---|---|---|
| First Contentful Paint | 1.5 s | 96 |
| Largest Contentful Paint | 1.5 s | 100 |
| Total Blocking Time | 40 ms | 100 |
| Cumulative Layout Shift | 0.011 | 100 |
| Speed Index | 1.5 s | 100 |
| Time to Interactive | 1.6 s | 100 |

**Performance verdict:** Excellent. All Core Web Vitals pass with strong margins. Rive WASM runtime loads efficiently and does not block the main thread.

### Bundle Sizes

| Asset | Raw | Gzipped | Status |
|---|---|---|---|
| rive-test JS | 147 KB | 44 KB | OK |
| ScrollTrigger JS | 112 KB | 44 KB | OK |
| **Total page JS** | **260 KB** | **88 KB** | **Well under 500 KB** |
| 5-state-character.riv | 804 KB | — | **Exceeds 500 KB target** |

The `.riv` file is 804 KB, above the 500 KB target. This is due to the 5-state character having multiple animation states. Consider optimizing the Rive asset for production.

### Performance Opportunities

| Issue | Savings |
|---|---|
| Render-blocking Google Fonts `@import` | ~150 ms FCP |
| Reduce unused JavaScript | ~26 KiB |

---

## Accessibility Issues Found & Fixed

### Fixed in this PR

| Issue | Severity | Fix Applied |
|---|---|---|
| Color contrast (9 elements) | Serious | Replaced `opacity: 0.3` with explicit `#7a7a7a` colors meeting 4.5:1 ratio |
| Canvas missing accessible name | Serious | Added `role="img"` + `aria-label="Animated stick figure character..."` |
| No `<main>` landmark | Moderate | Wrapped scroll container in `<main>` |
| No `<h1>` heading | Moderate | Promoted first section heading to `<h1>` |
| Content outside landmarks | Moderate | Wrapped HUD in `<header>`, canvas in `<aside>` with labels |
| No `prefers-reduced-motion` support | Best practice | Added `@media (prefers-reduced-motion: reduce)` to disable transitions |
| No skip link | Best practice | Added skip-to-content link |
| Progress bar missing ARIA | Best practice | Added `role="progressbar"` with `aria-valuenow` updates |
| HUD missing live region | Best practice | Added `role="status"` + `aria-live="polite"` |

### Post-fix axe-core Results

- **0 violations** (WCAG 2.1 AA + best-practice tags)
- **35 passing rules**
- **0 needs-review items**

---

## Remaining Items (not fixed in this PR)

| Issue | Category | Recommendation |
|---|---|---|
| .riv file > 500 KB | Performance | Optimize Rive asset — remove unused animation states |
| Google Fonts `@import` | Performance | Switch to `<link rel="preload">` |
| No `<meta name="description">` | SEO | Add meta description |
| Console errors logged | Best Practices | Investigate Rive/WASM warnings |

---

## Test Coverage Added

### `tests/e2e/rive-accessibility.spec.ts` (6 tests)
- Full axe audit on initial load — asserts zero critical/serious violations
- Axe audit after scrolling through sections
- Canvas accessible alternative
- Scroll sections semantic structure
- Keyboard navigation
- `prefers-reduced-motion` respected

### `tests/perf/rive-performance.spec.ts` (4 tests)
- Bundle size under 500 KB gzipped
- `.riv` file size documented (warns if > 500 KB)
- DOMContentLoaded < 2s, Rive loaded < 4s
- No layout shifts (CLS < 0.1) after load
