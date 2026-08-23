/**
 * `[ADDED 2026-08-22]` Type shims for `@splidejs/react-splide`.
 *
 * The package DOES ship declarations (`dist/types/index.d.ts`, referenced by its
 * top-level `"types"` field), but its `"exports"` map has no `types` condition:
 *
 *     "exports": { ".": { "require": …cjs.js, "import": …esm.js, "default": …esm.js } }
 *
 * Under `moduleResolution: "bundler"` the exports map wins and the `"types"` field is
 * never consulted, so `tsc` reports the module as implicitly `any` (TS7016) and the
 * CSS side-effect import as unresolvable (TS2882). Vite resolves both fine at build
 * time — this is purely a type-resolution gap in the package's own metadata.
 *
 * The component/Options types are recovered with a `paths` entry in tsconfig.app.json
 * pointing straight at the package's real declaration file, which keeps full type
 * safety rather than shimming the module as `any`. Only the stylesheets, which have no
 * declarations at all, are declared here.
 */

/** The library's stylesheets carry no declarations of their own. */
declare module '@splidejs/react-splide/css/core'
declare module '@splidejs/react-splide/css'
