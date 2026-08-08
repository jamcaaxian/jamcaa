# Type checking runs outside the build, on TypeScript 7

Type checking runs as a separate task invoking TypeScript 7's `tsc --noEmit`. The framework build itself does not type check (`typescript.ignoreBuildErrors`).

**This decision is recorded because that `ignoreBuildErrors: true` line looks like it is hiding a problem.** It is not. Any reviewer who sees it should read this first.

The constraint comes from a fact invisible in the code: **TypeScript 7 ships no compiler API**, only a command-line program and a native binary. Both the framework's built-in type checking and the TypeScript plugin for the linter depend on that API, so they can only run on TypeScript 6. The three cannot share a single `typescript` dependency.

## The arrangement

Following TypeScript's official side-by-side guidance, package aliases let both versions coexist: `tsc` resolves to 7.x, while tools needing the API resolve to the 6.x compatibility package. Type checking is then lifted out of the build and handed to the 7.x command line.

This also brings a benefit independent of the constraint: type checking becomes a cacheable, parallelisable task of its own instead of being repeated inside every build.

## Consequences

**The build is no longer the gatekeeper for type safety.** That guarantee now rests on the separate task, which must remain a prerequisite of deployment — the task orchestration already declares this. If anyone later removes that dependency, type errors will reach production unimpeded.

If the framework later defaults to invoking the type checker through the command line, it will look for an executable named `tsc`, whereas the 6.x compatibility package provides `tsc6`; that behaviour then has to be switched off explicitly.

Once TypeScript 7.1 ships a new API and the ecosystem follows, this arrangement should be revisited — the dual-version setup may no longer be necessary.
