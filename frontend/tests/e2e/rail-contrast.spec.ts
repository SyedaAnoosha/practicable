import { test, expect } from '@playwright/test'

/**
 * `.stage-aurora--rail` — the rendered-pixel contrast check.
 *
 * The rail's aurora backdrop cannot be verified with token-level arithmetic: it is seven
 * stacked gradient layers multiplied by `--aurora-opacity` over `--stage`, and the only
 * honest backdrop is the one the compositor actually produced (DESIGN.md §7.5.3). Sample
 * the nav labels (which render at 80%) and the account row (70%) at 1440x900 in both
 * themes.
 *
 * So this reads real pixels. It screenshots the rail, decodes the PNG in the browser via
 * a canvas, and samples the backdrop at the exact y where each text run lands — then
 * computes WCAG 2.1 contrast against the text's own effective colour (the foreground
 * token composited at its Tailwind alpha over that same backdrop, which is what an
 * `/80` label physically is).
 *
 * Why the rail is built here rather than navigated to: the rail lives in `MemberChrome`,
 * behind a Supabase session this suite has no credentials for (see `adminAuth.ts` on why
 * accounts are never seeded automatically). But the aurora composite is a pure function
 * of CSS — it reads no session data, and `SidebarNav`/`SidebarAccount` differ across
 * users only in the account name string. So the markup below is transcribed from
 * `MemberLayout.tsx` class-for-class, mounted against the real stylesheet in the real
 * browser at the real size. The pixels are genuine; only the route is substituted.
 * The DOM is asserted against the source classes first, so this fails loudly if
 * `MemberLayout.tsx` moves and this copy goes stale.
 */

const VIEWPORT = { width: 1440, height: 900 }

/** WCAG 2.1 relative luminance. */
function luminance(r: number, g: number, b: number): number {
  const f = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const la = luminance(...a)
  const lb = luminance(...b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** `color-mix`-free alpha composite: `fg` at `alpha` over `bg`, which is exactly what
 *  Tailwind's `text-stage-foreground/80` resolves to once painted. */
function over(fg: [number, number, number], bg: [number, number, number], alpha: number): [number, number, number] {
  return [
    Math.round(fg[0] * alpha + bg[0] * (1 - alpha)),
    Math.round(fg[1] * alpha + bg[1] * (1 - alpha)),
    Math.round(fg[2] * alpha + bg[2] * (1 - alpha)),
  ]
}

/** The rail, transcribed from MemberLayout.tsx. Every class that touches colour,
 *  opacity or geometry is copied verbatim; the icons are boxes of the same size, since
 *  an SVG's glyph does not change the BACKDROP under the label, which is what is
 *  being sampled. */
const RAIL_HTML = `
<div class="flex min-h-screen bg-background">
  <aside id="rail" class="relative isolate w-64 shrink-0 flex-col overflow-hidden border-r border-stage-foreground/15 bg-stage sticky top-0 flex h-screen">
    <div aria-hidden="true" class="stage-aurora stage-aurora--rail -z-10"></div>
    <a class="flex items-center gap-2 px-6 py-6 font-sans text-base font-semibold tracking-tight text-stage-foreground">
      <span class="size-2.5 rounded-[3px] bg-gold ring-1 ring-inset ring-stage-foreground/20"></span>
      Practicable
    </a>
    <nav class="flex flex-1 flex-col px-3" aria-label="Member">
      <div class="flex flex-col gap-1">
        <h2 class="px-3 pb-1.5 pt-5 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-stage-foreground/55 first:pt-1">Your work</h2>
        <a data-nav class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-stage-foreground/80"><span class="size-[18px] shrink-0"></span>Dashboard</a>
        <a data-nav class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-stage-foreground/80"><span class="size-[18px] shrink-0"></span>My Library</a>
        <a data-nav class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-stage-foreground/80"><span class="size-[18px] shrink-0"></span>Purchases</a>
        <a data-nav class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-stage-foreground/80"><span class="size-[18px] shrink-0"></span>Account</a>
      </div>
      <div class="flex flex-col gap-1">
        <h2 class="px-3 pb-1.5 pt-5 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-stage-foreground/55 first:pt-1">Products</h2>
        <a data-nav class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-stage-foreground/80"><span class="size-[18px] shrink-0"></span>Questions</a>
        <a data-nav class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-stage-foreground/80"><span class="size-[18px] shrink-0"></span>Courses</a>
        <a data-nav class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-stage-foreground/80"><span class="size-[18px] shrink-0"></span>Templates</a>
        <a data-nav class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-stage-foreground/80"><span class="size-[18px] shrink-0"></span>Reference packs</a>
        <a data-nav class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-stage-foreground/80"><span class="size-[18px] shrink-0"></span>All products</a>
      </div>
    </nav>
    <div id="account-row" class="border-t border-stage-foreground/15 px-3 py-4">
      <div class="flex items-center gap-2 rounded-lg px-3 py-2">
        <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-stage-foreground/12 text-xs font-semibold text-stage-foreground">A</span>
        <p id="account-name" class="min-w-0 flex-1 truncate text-sm font-medium text-stage-foreground/85">anoosha@example.com</p>
        <span data-a70 class="flex size-9 shrink-0 items-center justify-center rounded-md text-stage-foreground/70">C</span>
        <span data-a70 class="flex size-9 shrink-0 items-center justify-center rounded-md border border-stage-foreground/45 text-stage-foreground/70">T</span>
        <span id="account-signout" class="flex size-9 shrink-0 items-center justify-center rounded-md text-stage-foreground/65">O</span>
      </div>
    </div>
  </aside>
  <div class="flex-1"></div>
</div>`

/** The alphas MemberLayout.tsx actually uses, and what each one is. The plan names the
 *  first two; the rest are sampled because they sit on the SAME backdrop and a pass that
 *  checked only the two named ones would miss the dimmest run in the column. */
const TEXT_RUNS = [
  { label: 'nav label (text-stage-foreground/80)', selector: '[data-nav]', alpha: 0.8, large: false },
  { label: 'account name (text-stage-foreground/85)', selector: '#account-name', alpha: 0.85, large: false },
  { label: 'account row cart + theme (text-stage-foreground/70)', selector: '[data-a70]', alpha: 0.7, large: false },
  // The rightmost control in the bottom row, and the dimmest alpha in the account row.
  // It is sampled separately because it is the rail's genuine worst case: the aurora's
  // core sits at `50% 128%` and glow-2/glow-3 at `98% 102%` / `84% 108%`, so the bloom
  // peaks at the bottom-RIGHT — measured at x≈98%, y=100% by the luminance profile —
  // which is exactly where this button lands. Folding it into the /70 group would have
  // averaged the worst pixel away.
  { label: 'account sign-out, bottom-right (text-stage-foreground/65)', selector: '#account-signout', alpha: 0.65, large: false },
  { label: 'section heading (text-stage-foreground/55)', selector: 'h2', alpha: 0.55, large: false },
] as const

// The rail's text is 11px-14px — small text in every run, so 4.5:1 is the bar
// throughout (WCAG 2.1 §1.4.3). No run here qualifies for the 3:1 large-text allowance.
const AA_SMALL = 4.5
// WCAG 2.1 §1.4.11: non-text UI boundaries (the rail edge, the account rule, the toggle
// outline) are graded at 3:1, not 4.5:1 — they must be visible, not readable.
const AA_NONTEXT = 3

for (const theme of ['light', 'dark'] as const) {
  test(`.stage-aurora--rail: composited contrast at 1440x900, ${theme} theme`, async ({ page }) => {
    await page.setViewportSize(VIEWPORT)

    // Set the theme BEFORE first paint, the same way index.html's inline script does,
    // so nothing is sampled mid-transition.
    await page.addInitScript((t) => {
      window.localStorage.setItem('practicable:theme', t as string)
    }, theme)

    await page.goto('/')
    await expect(page.locator('h1')).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains('dark')))
      .toBe(theme === 'dark')

    // Guard against this transcription silently rotting: the classes sampled below must
    // still be the ones MemberLayout.tsx paints. If the rail is restyled, this fails
    // here rather than quietly measuring a stale copy.
    const sourceClasses = await page.evaluate(async () => {
      const res = await fetch('/src/routes/_layouts/MemberLayout.tsx')
      return res.ok ? await res.text() : ''
    })
    // Skipped only when the source genuinely is not servable (a built preview rather than
    // the dev server), and SAID so rather than passing quietly — a staleness guard that
    // can silently no-op is not a guard.
    if (!sourceClasses) {
      // eslint-disable-next-line no-console
      console.log(
        '  [note] MemberLayout.tsx not fetchable from this server — transcription-staleness ' +
          'guard skipped for this run. The pixel measurements below are unaffected.',
      )
    } else {
      for (const cls of [
        'stage-aurora stage-aurora--rail',
        'text-stage-foreground/80',
        'text-stage-foreground/85',
        'text-stage-foreground/70',
        'text-stage-foreground/65',
        'text-stage-foreground/55',
        // Pinned so that reverting the border alpha in the component fails HERE, loudly,
        // instead of the spec quietly grading a `/45` transcription while the app ships
        // something dimmer (a §1.4.11 non-text contrast regression).
        'border-stage-foreground/45',
        'w-64',
      ]) {
        expect(sourceClasses, `MemberLayout.tsx no longer contains "${cls}" — this transcription is stale`).toContain(cls)
      }
    }

    // Replace the page body with the rail, keeping <html class> and the stylesheet.
    await page.evaluate((html) => {
      document.body.innerHTML = html
    }, RAIL_HTML)

    const rail = page.locator('#rail')
    await expect(rail).toBeVisible()
    expect(await rail.evaluate((el) => el.getBoundingClientRect().width)).toBe(256)
    expect(await rail.evaluate((el) => el.getBoundingClientRect().height)).toBe(VIEWPORT.height)

    // Let the gradients finish painting.
    await page.waitForTimeout(250)

    // Resolve --stage-foreground BEFORE the transparency override below, which would
    // otherwise make the probe report `transparent`.
    const stageForeground = await page.evaluate(() => {
      const probe = document.createElement('span')
      probe.className = 'text-stage-foreground'
      document.body.appendChild(probe)
      const c = getComputedStyle(probe).color
      probe.remove()
      return c
    })
    const fgMatch = stageForeground.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/)
    expect(fgMatch, 'could not resolve --stage-foreground').not.toBeNull()
    const fg: [number, number, number] = [Number(fgMatch![1]), Number(fgMatch![2]), Number(fgMatch![3])]

    // Where each text run actually lands, in rail-local coordinates. Measured before the
    // override too, though `color` does not affect layout — kept adjacent to the probe
    // so the "everything measured from the real render" ordering is one block.
    const runBoxes: { label: string; alpha: number; boxes: { x: number; y: number; w: number; h: number }[] }[] = []
    for (const run of TEXT_RUNS) {
      const boxes = await page.evaluate(
        ({ selector }) => {
          const railEl = document.querySelector('#rail')!
          const rr = railEl.getBoundingClientRect()
          return Array.from(document.querySelectorAll(selector)).map((el) => {
            const r = el.getBoundingClientRect()
            return { x: r.x - rr.x, y: r.y - rr.y, w: r.width, h: r.height }
          })
        },
        { selector: run.selector },
      )
      expect(boxes.length, `no elements matched ${run.selector}`).toBeGreaterThan(0)
      runBoxes.push({ label: run.label, alpha: run.alpha, boxes })
    }

    // The backdrop is sampled from a render with every glyph hidden. Sampling the raw
    // screenshot would pick up the text stroke itself as the "backdrop" (the lightest
    // pixel inside a run of light text is the ink), measuring the text against itself.
    // `color: transparent` leaves every box, border, fill and gradient in place — the
    // compositor produces the identical backdrop, minus the ink.
    // Borders and outlines are hidden too: a control's own 1px edge is not the surface
    // its label sits on, and a rectangular inset cannot exclude it without also clipping
    // the corner arcs of `rounded-md` and letting a bright edge bleed into the sample.
    // Background fills are KEPT — the avatar's `bg-stage-foreground/12` genuinely is the
    // backdrop under its initial.
    await page.addStyleTag({
      content:
        '#rail, #rail * { color: transparent !important; text-shadow: none !important; ' +
        'border-color: transparent !important; outline-color: transparent !important; ' +
        '-webkit-text-stroke: 0 !important; }',
    })
    await page.waitForTimeout(120)

    // The composited pixels. Screenshot the rail, then decode it in-page through a
    // canvas so the sample comes from the SAME bytes a viewer's screen received —
    // not from re-evaluating the CSS.
    const shot = (await rail.screenshot()).toString('base64')

    // Decode once, sample every run's backdrop, return the WORST (lightest, since the
    // text is light) pixel under each run — the aurora's bloom climbs from the bottom,
    // so the worst case is a specific row, not an average.
    const samples = await page.evaluate(
      async ({ png, runs }) => {
        const img = new Image()
        img.src = 'data:image/png;base64,' + png
        await img.decode()
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        const dpr = img.naturalWidth / 256

        const lum = (r: number, g: number, b: number) => {
          const f = (c: number) => {
            const s = c / 255
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
          }
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
        }

        return runs.map((run) => {
          let worst: { rgb: [number, number, number]; lum: number; x: number; y: number } | null = null
          for (const b of run.boxes) {
            // Sample the full band the text occupies, at device pixels, with a 1px
            // anti-aliasing guard. The borders are already gone (see the style override
            // above), so this only drops the half-covered edge pixels a fractional layout
            // position leaves behind — without it, a control's own bright edge can leak
            // into the sample and read as the backdrop.
            const inset = 1 * dpr
            const x0 = Math.max(0, Math.round(b.x * dpr + inset))
            const x1 = Math.min(canvas.width, Math.round((b.x + b.w) * dpr - inset))
            const y0 = Math.max(0, Math.round(b.y * dpr + inset))
            const y1 = Math.min(canvas.height, Math.round((b.y + b.h) * dpr - inset))
            if (x1 <= x0 || y1 <= y0) continue
            const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i]
              const g = data[i + 1]
              const bl = data[i + 2]
              const l = lum(r, g, bl)
              // Light text on a dark plane: the LIGHTEST backdrop pixel is the worst case.
              if (!worst || l > worst.lum) {
                const p = i / 4
                worst = {
                  rgb: [r, g, bl],
                  lum: l,
                  x: Math.round(x0 + (p % (x1 - x0))),
                  y: Math.round(y0 + Math.floor(p / (x1 - x0))),
                }
              }
            }
          }
          return { label: run.label, alpha: run.alpha, worst }
        })
      },
      { png: shot, runs: runBoxes },
    )

    const failures: string[] = []
    const report: string[] = []
    for (const s of samples) {
      expect(s.worst, `no pixels sampled for ${s.label}`).not.toBeNull()
      const bg = s.worst!.rgb as [number, number, number]
      // What the text physically is: the stage foreground painted at its alpha over the
      // aurora backdrop at that pixel.
      const effective = over(fg, bg, s.alpha)
      const ratio = contrast(effective, bg)
      const line =
        `${s.label}: worst backdrop rgb(${bg.join(', ')}) at rail px (${s.worst!.x}, ${s.worst!.y}) ` +
        `-> effective text rgb(${effective.join(', ')}) = ${ratio.toFixed(2)}:1 (needs ${AA_SMALL}:1)`
      report.push(line)
      if (ratio < AA_SMALL) failures.push(line)
    }

    // ── The rail's non-text boundaries, at §1.4.11's 3:1 ────────────────────────────
    //
    // Excluded from the text sampling above (they are not the surface a glyph sits on),
    // but they are still things a reader has to SEE — the rail's outer edge, the rule
    // above the account row, and the theme toggle's own outline. WCAG 2.1 §1.4.11 puts
    // a non-text UI boundary at 3:1 against what is adjacent to it.
    // The alphas MemberLayout.tsx uses for the rail's own boundaries — and, crucially,
    // whether §1.4.11 actually applies to each. It does not apply to every line on a
    // page: the success criterion covers boundaries *required to identify* a control or
    // to understand state. Grading a decorative separator at 3:1 would manufacture a
    // failure, which is the same dishonesty as missing a real one.
    //
    //   * rail `border-r` and the account row's `border-t` are region separators. Remove
    //     them and the nav is still a nav and every control is still identifiable — the
    //     `--stage` plane itself already separates the rail from the page. §1.4.11's own
    //     note exempts purely decorative boundaries. NOT graded.
    //
    //   * the theme toggle's border is the opposite case. That button has NO fill and its
    //     Sun/Moon glyph is `aria-hidden` decoration (`ThemeToggle.tsx`) — the border is
    //     the only visual evidence that a control is there at all. §1.4.11 applies, at 3:1.
    const borders = [
      {
        // `/45` is the first alpha that clears §1.4.11's 3:1 in BOTH themes; a dimmer
        // border (e.g. `/20`, ~1.7:1) is a real non-text contrast failure and fails here.
        label: 'theme toggle outline (border-stage-foreground/45) — the only thing marking it a control',
        alpha: 0.45,
        graded: true,
      },
      {
        label: 'rail border-r / account rule (border-stage-foreground/15) — decorative separator, §1.4.11 exempt',
        alpha: 0.15,
        graded: false,
      },
    ]
    // Composited against the backdrop where the toggle itself sits — the `[data-a70]`
    // run, which is that row. Grading it against the brightest pixel anywhere in the
    // rail would be a worst case the border never actually meets, and a contrast figure
    // measured somewhere the thing is not is exactly the class of claim §7.5.3 exists
    // to forbid.
    const a70 = samples.find((s) => s.label.startsWith('account row cart'))
    const brightest = (a70?.worst?.rgb ?? [0, 0, 0]) as [number, number, number]
    for (const b of borders) {
      const edge = over(fg, brightest, b.alpha)
      const r = contrast(edge, brightest)
      const line =
        `${b.label}: rgb(${edge.join(', ')}) on worst backdrop rgb(${brightest.join(', ')}) = ${r.toFixed(2)}:1 ` +
        (b.graded ? `(needs ${AA_NONTEXT}:1)` : '(not graded — reported so the number is on record)')
      report.push(line)
      if (b.graded && r < AA_NONTEXT) failures.push(line)
    }

    // Always print, pass or fail — this check exists to put the measured contrast
    // numbers on record, so they must be visible on a passing run too.
    console.log(`\n.stage-aurora--rail @ 1440x900, ${theme} theme:\n  ` + report.join('\n  ') + '\n')

    expect(failures, `\n${failures.join('\n')}\n`).toEqual([])
  })
}
