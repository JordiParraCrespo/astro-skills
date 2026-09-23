---
name: astro-audit
description: "Full-project audit for Astro sites (v5+). Runs the deterministic scanner, fans out to five specialist agents in parallel (architecture, performance, SEO, accessibility, security), merges and de-duplicates findings, computes an overall and per-category 0-100 score, and writes a prioritized ASTRO-AUDIT.md with a verification step per finding. Triggers on: Astro audit, audit my Astro site, Astro health check, Astro code review, Astro score, review Astro project, Astro best practices check."
user-invocable: true
argument-hint: "[path]"
license: MIT
metadata:
  version: "0.1.0"
  category: core
  command: "/astro audit [path]"
  tagline: "Scans, fans out five specialist agents in parallel, and scores your project 0-100 with a prioritized fix plan."
  order: 1
---

# Astro Audit

A repeatable, evidence-based audit of an Astro project. The scanner supplies the
facts, five specialist agents supply judgement, and a fixed scoring model turns
both into a number the team can track release over release. The deliverable is an
`ASTRO-AUDIT.md` at the project root.

## When to use

- Inheriting or onboarding onto an Astro codebase.
- Before a launch, a major upgrade, or a Lighthouse/SEO push.
- Periodically (per release) to track the score trend.
- Not for a single narrow question ("why is this image blurry?"): route that to the
  matching sub-skill via the `astro` orchestrator instead.

## Workflow

1. **Scan once.** Run the bundled scanner and keep the JSON; every agent reuses it.
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/astro/scripts/astro-scan.mjs" <path> --json > /tmp/astro-scan.json
   ```
   If `isAstroProject` is `false`, stop and say so. Record `astroVersion`, `output`,
   adapter, integrations and UI frameworks in the report header.
2. **Establish ground truth.** Run `npx astro check` and `npx astro build` (the
   project's package manager is fine). A failing build is automatically a
   `critical` architecture finding; note build time and the size of `dist/`.
3. **Fan out in parallel.** In a single message, launch the five agents, passing
   each the scanner JSON, the build result, and the path. Never run them serially.

   | Agent | Category | Owns scanner rules |
   |-------|----------|--------------------|
   | `astro-architect` | architecture | `config.*`, `content.legacy-config`, `api.*`, `links.hardcoded-internal`, `styles.raw-color`, `ts.not-strict`, `deps.multiple-frameworks` |
   | `astro-performance` | performance | `islands.client-load`, `images.raw-img` |
   | `astro-seo` | seo | `config.no-sitemap`, `seo.no-robots`, `seo.no-canonical` |
   | `astro-accessibility` | accessibility | `images.img-missing-alt`, `a11y.positive-tabindex`, `a11y.click-on-div` |
   | `astro-security` | security | `security.set-html`, `env.process-env` |

   Ask each agent to return findings in the shape below and to confirm or reject
   each scanner finding it owns (false positives get dropped, with a reason). If the
   scanner JSON tags a finding with a different category, the scanner's wins.
4. **Merge.** Concatenate scanner and agent findings, then de-duplicate by
   `(file, line, rule)`. When two agents report the same root cause, keep one finding
   under the category that owns the fix and list the other as `related`.
5. **Score.** Apply the scoring model below, overall and per category.
6. **Prioritize.** Place each finding in the priority matrix (Critical / High /
   Medium / Quick win) using severity, effort and impact.
7. **Write `ASTRO-AUDIT.md`** using the report template below.
   Every finding must carry a "How we would know this failed" verification.
8. **Verify the report.** Re-read it: every finding has a file (and line where one
   exists), a rule id, a fix, and a verification command or metric; the scores match
   a recomputation from the findings table; the top-3 next steps are in the matrix.

## Finding shape

```json
{
  "rule": "images.raw-img",
  "category": "performance",
  "severity": "medium",
  "file": "src/components/Hero.astro",
  "line": 12,
  "evidence": "<img src=\"/hero.jpg\"> — 1.4 MB JPEG above the fold",
  "fix": "Import from src/assets and render with <Image> + fetchpriority=\"high\"",
  "effort": "S",
  "impact": "high",
  "verify": "Lighthouse mobile LCP < 2.5s; dist HTML has srcset + width/height"
}
```

Agent-only findings use the same `category.slug` convention for `rule`
(e.g. `security.action-no-auth`, `seo.missing-hreflang`) so they can be scored and
tracked across audits.

## Scoring model

- Weights by severity: **critical 15, high 8, medium 3, low 1**.
- Penalty per rule = weight × occurrences, **capped at 2× the weight** (so a rule
  can cost at most 30 / 16 / 6 / 2 points no matter how many files repeat it).
- **Score = max(0, 100 − Σ rule penalties).**
- **Per-category score:** the same formula over only that category's findings.
- **Overall score:** the same formula over all merged findings (not an average of
  categories — one critical anywhere should hurt the headline number).
- Report the band: 90-100 excellent, 75-89 good, 50-74 needs work, <50 at risk.

Worked example: 1× `security.set-html` (critical 15) + 4× `images.raw-img` (medium,
4×3=12, capped at 6) + 1× `ts.not-strict` (low 1) → 100 − 22 = **78 (good)**.

## Priority matrix

| Bucket | Rule of thumb | Examples |
|--------|---------------|----------|
| **Critical** | severity `critical`, or broken build / exposed secret / data loss. Fix before anything else ships. | Unsanitized `set:html` of user input, secret in `PUBLIC_` env, build fails |
| **High** | severity `high` with user-visible impact (SEO, a11y, CWV). This sprint. | Missing `site` (broken canonicals/sitemap), clickable `<div>`, LCP image lazy |
| **Medium** | measurable cost, larger effort. Schedule it. | Migrate legacy collections, drop a second UI framework |
| **Quick win** | effort `S` (< 30 min) and impact ≥ medium, any severity. Batch into one PR. | Add `robots.txt`, `extends: astro/tsconfigs/strict`, alt text |

Effort: `S` < 30 min, `M` < half a day, `L` > half a day. Impact: `high` changes a
user-visible metric or a ranking/compliance outcome; `medium` measurable but local;
`low` hygiene. A finding can be both High and a Quick win; list it under Quick win
and mark it `(high)` so it is not lost.

## Patterns

Launching the fan-out (one message, five calls, same inputs):

```text
Agent(astro-architect,     "Audit <path>. Scanner JSON: <…>. Build: <pass|fail + log tail>. Return findings JSON.")
Agent(astro-performance,   "…same inputs…")
Agent(astro-seo,           "…same inputs…")
Agent(astro-accessibility, "…same inputs…")
Agent(astro-security,      "…same inputs…")
```

"How we would know this failed" should be observable by someone who did not write
the fix:

| Finding | Verification |
|---------|--------------|
| `config.missing-site` | `grep -c 'rel="canonical" href="https://' dist/index.html` returns 1 |
| `islands.client-load` | Page JS in `dist/_astro/*.js` for that route drops; TBT in Lighthouse mobile ≤ 200 ms |
| `a11y.click-on-div` | Element reachable with Tab and activatable with Enter/Space; axe reports 0 violations |
| `env.process-env` | `astro check` passes and the var appears in the `astro:env` schema; secret absent from `dist/_astro/*.js` |

## Report template

Keep section order stable so audits diff cleanly between releases. One finding per
root cause (twenty raw `<img>` tags are one finding with twenty locations).

````markdown
# Astro Audit — <project>
<YYYY-MM-DD> · Astro <version> · output <static|server> · adapter <name|none> ·
integrations <list> · `astro check` <pass|n errors> · `astro build` <pass|fail>, dist <MB>

## Score
**Overall: <n>/100 (<band>)** · previous: <n|n/a>

| Category | Score | Crit | High | Med | Low |
|----------|-------|------|------|-----|-----|
| Architecture / Performance / SEO / Accessibility / Security (one row each) | | | | | |

## Priority matrix
| Bucket | ID | Finding | Effort | Impact | Fix with |
|--------|----|---------|--------|--------|----------|
| Critical · High · Medium · Quick win | F1 | <one line> | S/M/L | high/med/low | `/astro <skill>` |

## Top 3 next steps
1. <action> — resolves F<n>, expected +<n> points

## Findings
### F1 · <rule> · <severity> · <category>
- **Where:** `<file>:<line>` (+<n> more)
- **Evidence:** <observed code, byte count, metric or axe id>
- **Fix:** <minimal diff in the project's style>
- **Effort / impact:** <S/M/L> / <high/medium/low>
- **How we would know this failed:** <command + expected output, artefact, or metric threshold>

## Rejected scanner findings
| Rule | File | Why it is a false positive |

## Method
Scanner JSON, five parallel agents, verified against the installed major and docs.astro.build/llms.txt.
````

## Checklist

- [ ] Scanner ran once; its JSON was shared with all five agents.
- [ ] `astro check` and `astro build` results recorded.
- [ ] All five agents ran in parallel and every owned scanner finding was confirmed or rejected.
- [ ] Findings de-duplicated by `(file, line, rule)`.
- [ ] Overall and per-category scores recomputed from the findings table.
- [ ] Every finding has severity, effort, impact, fix and a falsifiable verification.
- [ ] Priority matrix populated; quick wins batched.
- [ ] `ASTRO-AUDIT.md` written at the project root; no source files modified.

## Common mistakes

- **Averaging category scores.** It hides a single critical security finding behind
  four clean categories. Score the overall from all findings.
- **Uncapped penalties.** Forty raw `<img>` tags are one problem with one fix; the
  2× cap keeps the score about breadth of problems, not file count.
- **Unverifiable fixes.** "Improve performance" is not a finding. Name the metric
  and the threshold.
- **Re-scanning in every agent.** Wastes time and produces diverging facts; pass the
  JSON.
- **Recommending removed APIs.** Check `astroVersion` and
  `https://docs.astro.build/llms.txt` before suggesting a fix; never suggest
  `Astro.glob`, `output: 'hybrid'` or `<ViewTransitions />`.
- **Fixing during the audit.** The audit is read-only; fixes go through the relevant
  sub-skill afterwards so they can be reviewed separately.

## Output

Write `ASTRO-AUDIT.md` from the report template
and reply with: the overall score and band, the per-category scores, the count of
findings per bucket, and the top three next steps ordered by impact, each naming the
sub-skill that fixes it (e.g. `/astro images src/`).
