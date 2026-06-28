---
name: diagnose-module-not-found
description: Diagnose and fix "Cannot find module" / MODULE_NOT_FOUND / ImportError / unable to resolve errors across runtimes. Reaches for the package manifest, not the source code, first.
---

# Module-Not-Found errors

The symptom: a script fails immediately at the import/require line with a
"module not found" or "unable to resolve" error. The mistake is to start
reading the source code. **The bug is almost never in the line that imports
the module — it's in the project manifest.**

## Rule

A module-resolution failure means the import *name* is fine but the package is
not resolvable from this location. There are only a few reasons, in this order:

1. The dependency is used in code but never added to the manifest
   (`package.json`, `pyproject.toml`/`requirements.txt`, `Cargo.toml`,
   `go.mod`, `Gemfile`, etc.). **Most common by far.**
2. The manifest declares it but `install` was never run (or run in the wrong
   directory / wrong virtualenv / wrong workspace).
3. The dependency is installed but the import path is wrong — a typo, a
   subpath that doesn't exist (`lodash/foo` when only `lodash` ships), or a
   package whose runtime export name differs from its install name
   (`react-router-dom` imported as `react-router`).
4. Path/alias misconfiguration — tsconfig `paths`, vite/webpack aliases,
   monorepo hoisting, or a relative import pointing one directory off.

## Diagnostic flow

1. **Read the error literally.** Note the *exact* module string and the
   *file/line* that imported it.
2. **Check the manifest.** Is that package name in `dependencies` /
   `devDependencies` / the lockfile? If no → it was never added. Fix with the
   runtime's add command, not by hand-editing code.
3. **Check install state.** Does `node_modules/<pkg>` / `site-packages/<pkg>`
   actually exist on disk? If the manifest has it but the dir is missing →
   run install (`npm install`, `pip install -e .`, `cargo build`) in the
   correct directory with the correct environment active.
4. **Check the import path.** If installed, is the imported subpath real?
   Compare against the package's `exports`/`__init__.py`/top-level files.
5. **Check resolution config.** Aliases, tsconfig paths, workspace hoisting,
   `NODE_PATH` — only reach for these after 1–4 are confirmed.

## Fix patterns by ecosystem

- **Node.js** — `npm install <pkg> --save` (or `--save-dev` for test/build
  deps). Verify with `node -e "require('<pkg>')"`.
- **Python** — `pip install <pkg>` then ensure it's in `requirements.txt` /
  `pyproject.toml`. Confirm the right interpreter/venv: `which python;
  python -c "import sys; print(sys.executable)"`.
- **Rust** — `cargo add <crate>`. `Cargo.toml` `[dependencies]` is the source
  of truth; `cargo build` regenerates the lock.
- **Go** — `go get <module>@latest`, which updates `go.mod`.
- **Ruby** — `bundle add <gem>` updates the Gemfile and installs.

## Verify the fix

Re-run the exact failing command and confirm exit code 0 AND the expected
output. Don't trust silence — confirm the program produced its real output.

## Smell that triggers this skill

Script crashes on line 1 or line 2 of a small file, stack trace is entirely
inside the runtime's module loader (`internal/modules/cjs/loader`,
`importlib`, etc.), and the user frame is just `require(...)`/`import`.
That signature = reach for the manifest, not the source.
