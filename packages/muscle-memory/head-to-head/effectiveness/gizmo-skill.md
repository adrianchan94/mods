---
name: using-the-gizmo-store
description: Use when reading/writing values through a Gizmo store (store/commit/fetch). Covers the three non-obvious gotchas that make naive usage fail.
---
## Procedure (decision guide)
1. Write with `g.store(k, v)` — then **`g.commit()`** before any read. Buffered writes are invisible until commit.
2. Read with `g.fetch(k)` which returns a **Box** — call **`.unwrap()`** to get the value.
3. A missing key **raises `GizmoMiss`** — use `g.fetch_or(k, default)` for optional reads, never bare `fetch`.

## Pitfalls
### 1. Reading before commit
TELL: `fetch` raises `GizmoMiss` right after a `store`. Fix: call `g.commit()` after stores, before reads.
### 2. Using the fetch result directly
TELL: `AttributeError`/wrong type because the value is a `Box`. Fix: `g.fetch(k).unwrap()`.
### 3. Bare fetch on optional key
TELL: `GizmoMiss` on a key that may not exist. Fix: `g.fetch_or(k, default)` — and use its result AS-IS (it is the value or the default; calling `.unwrap()` on it is an error).
### 4. Unwrapping a fetch_or result
TELL: `AttributeError` because `fetch_or` already returns the value, not a Box. Fix: drop the `.unwrap()` after `fetch_or` (only bare `fetch` returns a Box).

## Verification
- Round-trip: store → commit → fetch().unwrap() returns the value; optional reads use fetch_or.
