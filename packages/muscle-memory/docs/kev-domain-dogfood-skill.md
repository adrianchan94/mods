---
name: validating-shopify-visual-claims-with-receipts
description: Use when checking Shopify or IM8 visual/copy claims before saying done, ready, validated, safe, or PR-ready; trigger on visual_receipt, no-cap gates, claims lint, preview QA, or evidence-backed release checks.
---

## When to use
- Before claiming a Shopify/IM8 page, section, CTA, preview, or visual change is done or validated.
- When a browser receipt, screenshot, claims lint, no-cap check, or repo evidence result is partial, failed, or ambiguous.
- Before PR copy says evidence is packaged, visual rendering is proven, or supplement claims are safe.

## Procedure
1. Lock the exact claim: URL, viewport, selector, file, copy block, package artifact, or PR statement.
2. Collect proof using the strongest available receipt: visual receipt for pixels, DOM/computed boxes for layout, claims lint for copy triage, `no_cap_gate_check` for high-trust statements, and package/pack output for release claims.
3. Classify each proof as full, partial, failed, or proxy-only. A mobile receipt does not prove desktop. A linter pass does not prove legal clearance. A repo file does not prove npm package inclusion.
4. If any required proof is partial or missing, report the narrowed claim and the blocker instead of saying done.
5. Fix evidence-packaging gaps immediately when safe (for example, package.json files missing receipt artifacts), then rerun the same proof command.

## Pitfalls
- **Partial visual receipt overclaim** — mobile screenshot/crops can succeed while desktop annotated screenshot fails. Say "mobile/DOM receipt captured; desktop failed" instead of "mobile+desktop validated."
- **Claims-lint overreliance** — `im8_claims_lint` is triage only. Broad language like "Protects 9 Organ Systems" still needs substantiation/legal review even if the linter reports zero findings.
- **Source proof not packaged proof** — README/FRONTIER evidence in the repo does not prove npm tarball evidence. Run `npm pack --dry-run` and confirm the receipts are included.
- **No-cap mismatch** — do not claim ready/validated/safe unless the exact claim type has matching proof, not a neighboring proxy.

## Verification
- Screenshot/visual artifacts exist for every claimed viewport, or the claim explicitly says which viewport failed.
- Claims lint output is recorded with a human-review caveat for supplement/health language.
- `no_cap_gate_check` passes for the exact final statement.
- `npm pack --dry-run` includes every receipt/doc the PR or README cites.
- `git diff --stat` and `git status --short --branch` show only intentional files.

<!-- muscle-memory provenance: reflective 2026-06-27; action=create; convs=3; graduated=true -->
