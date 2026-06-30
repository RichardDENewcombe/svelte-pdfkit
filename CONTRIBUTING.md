# Contributing to svelte-pdf

Thanks for your interest in improving svelte-pdf — a Svelte-native, server-side
PDF rendering library. This guide covers local setup, the project layout, how to
run and write tests, and the conventions to follow.

For the user-facing API, see the [`README.md`](./README.md) and the
per-component READMEs under `src/lib/components/`. The pipeline and invariants
below are the source of truth for how the internals fit together.

---

## Prerequisites

- **Node.js** 18+ (20+ recommended)
- **pnpm** (the repo pins Vite via `pnpm.overrides`)

```bash
pnpm install
```

---

## Common commands

| Command            | What it does                                                       |
| ------------------ | ------------------------------------------------------------------ |
| `pnpm test`        | Run the full Vitest suite once                                     |
| `pnpm test:watch`  | Run Vitest in watch mode                                           |
| `pnpm check`       | Type-check with `svelte-check` against `tsconfig.json`             |
| `pnpm dev`         | Start the Vite dev server (for trying templates locally)          |
| `pnpm build`       | Build via Vite                                                     |
| `pnpm package`     | Produce the publishable package with `@sveltejs/package` + `publint` |

Before opening a PR, make sure **both** pass:

```bash
pnpm test
pnpm check
```

---

## Project layout

All library source lives under `src/lib/` (required by `@sveltejs/package`); the
package entry point is `src/lib/index.ts`.

```
src/lib/
├─ index.ts            # public exports (components, runtime, types)
├─ components/         # Svelte components — one folder each, with a README.md
│  ├─ Document/  Page/  View/  Text/  Image/  Font/  Link/  Canvas/
│  ├─ Svg/             # Svg + primitives, gradients, clip paths, SvgText/Tspan
│  └─ Table/           # Table / Row / Cell
├─ compiler/           # vite-plugin.ts — compiles *.pdf.svelte → render()
├─ runtime/            # document context, node, render, resources, fonts, to-response
├─ layout/             # Yoga integration, text measurement, hyphenation, image-size
├─ pagination/         # paginate.ts — page splitting, fixed elements, flow control
├─ renderer/           # render.ts + draw-text / draw-image / draw-svg
├─ types/              # pdf.ts — PDFNode, StyleProps, NodeType, …
└─ test/               # Vitest specs + .svelte template fixtures + snapshots
```

`src/examples/` holds runnable `.pdf.svelte` templates (Invoice, Report, Resume)
exercised end-to-end by `src/lib/test/examples.test.ts`.

---

## The rendering pipeline

A change usually touches one stage of this pipeline:

```
.pdf.svelte template
   → Vite plugin compiles to server-side JS         (compiler/)
   → Svelte runs server-side; components build a     (components/, runtime/)
     PDF node tree via getContext/setContext
   → fonts & images load asynchronously              (runtime/resources.ts)
   → Yoga computes flexbox layout                    (layout/)
   → paginator splits the tree into pages            (pagination/)
   → PDFKit renders each page to a Readable stream   (renderer/)
```

Key invariants — keep these true:

- **No DOM, no global mutable state.** Each `render()` call creates a fresh
  document context (passed in via Svelte's `context` map), so concurrent server
  requests are safe.
- **Components only build AST nodes.** They read `__pdf__` (parent) /
  `__pdf_root__` (document) from context, push a node, and `setContext` for
  their children. SVG children use the `__svg__` context. They never draw.
- **Resources load before layout.** Text measurement needs fonts, so fonts and
  images must be declared during the synchronous build pass and loaded before
  Yoga runs.
- **The compiled `render()` forces a lazy pass.** `svelteRender()` from
  `svelte/server` is lazy — the component tree only executes when `.html` is
  accessed. The Vite-generated wrapper reads `.html` solely to trigger the
  synchronous AST-building pass. Don't remove that access, or the tree never
  builds and the PDF comes out empty.

---

## Writing a new component

1. Create `src/lib/components/<Name>/<Name>.svelte`.
2. In `<script>`: read the parent via `getContext('__pdf__')`, push a node of an
   appropriate `NodeType` with `{ type, props, children: [] }`, and — if it has
   children — `setContext('__pdf__', node)` before rendering `{@render children?.()}`.
3. If it introduces a new `NodeType`, add it to `src/lib/types/pdf.ts` and handle
   it in `renderer/render.ts` (and `layout/` if it affects layout/measurement).
4. Export it from `src/lib/index.ts`.
5. Add a `README.md` in the component folder (match the existing ones).
6. Add a `.svelte` fixture in `src/lib/test/` and a spec that renders it and
   asserts on the result.

Validate inputs with the shared `warn()` helper (`runtime/warn.js`) rather than
throwing, so a malformed template degrades gracefully with a clear dev message.

---

## Testing

Tests live in `src/lib/test/` and run under Vitest. The suite mixes:

- **Unit tests** — layout, text measurement, pagination, style mapping, etc.
- **Snapshot tests** — `snapshot.test.ts` renders templates and compares output;
  update intentional changes with `pnpm test -- -u` and **review the diff**.
- **Integration tests** — `examples.test.ts` and `vite-plugin.test.ts` exercise
  `.pdf.svelte` compilation and the full `render()` path.

Guidelines:

- **Write tests alongside the feature**, not after. Every behavioural change
  needs a test that would fail without it.
- **Assert something real.** A test with no `expect()` (or with tolerances so
  loose they always pass) is worse than none — the suite has been audited for
  exactly this. Prefer exact coordinate/height assertions where the layout is
  deterministic (`pointScaleFactor` is set to `0`, so Yoga returns exact floats).
- Keep template fixtures minimal and focused on the behaviour under test.

---

## Pull requests

- Branch off `main`; keep PRs focused on one change.
- Ensure `pnpm test` and `pnpm check` pass.
- Update docs alongside code: the relevant component `README.md`, the top-level
  `README.md`, and `LLMS.md` (the LLM usage guide).
- Don't commit generated `*.pdf.svelte.d.ts` files (they're gitignored).
- Match the surrounding code style — the repo uses TypeScript throughout and
  Prettier/ESLint conventions consistent with the existing files.

---

## Reporting issues

Include the template (or a minimal reproduction), the props passed to
`render()`, what you expected, and what was produced. For layout/pagination
bugs, a small standalone `.pdf.svelte` that reproduces the problem is the most
useful thing you can attach.
