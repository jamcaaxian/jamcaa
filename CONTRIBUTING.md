# Contributing to jamcaa

Thanks for considering a contribution.

The project is in **pre-alpha**. Interfaces move quickly, and large unsolicited pull requests carry a real risk of being invalidated by work already in progress. Opening an issue before writing code is strongly encouraged.

## Contributor License Agreement

Before your first pull request can be merged, you must sign the [Contributor License Agreement](./docs/CLA.md).

This is asked for a specific reason: without it, the project permanently loses the ability to adjust its license, because doing so would require locating and obtaining consent from every past contributor. Signing is a one-time step and is automated in the pull request workflow.

## Reporting bugs

Open an issue with:

- what you expected to happen, and what happened instead
- a minimal reproduction — the smallest content model and code path that triggers it
- your runtime, package versions, and whether it occurs locally, in preview, or only when deployed

Reproductions matter more than descriptions here. Much of the framework's behaviour depends on the runtime it executes in, and bugs that appear only after deployment are common.

## Proposing features

Open an issue describing the problem before proposing a solution. Include the use case that motivated it. Feature requests that describe a concrete situation are far easier to evaluate than ones that describe a desired API.

If the change affects the public API, the extension points, or the data model, it will likely need an [architecture decision record](./docs/adr) before implementation.

## Development

```bash
pnpm install
pnpm dev        # Next.js dev server — fast iteration
pnpm preview    # runs in the actual Workers runtime — use before opening a PR
```

`pnpm dev` runs in Node.js and will happily accept code that fails in production. **Verify with `pnpm preview` before submitting.** The Workers runtime differs in ways that the dev server does not surface.

### On Windows: enable Developer Mode first

Building for Workers recreates the package manager's symlink layout, and Windows restricts symlink creation to administrators by default. Without this, the build fails with `EPERM: operation not permitted, symlink`.

Enable it under **Settings → System → For developers → Developer Mode**. This is a one-time change and does not require running anything as administrator afterwards.

If your machine is managed and Developer Mode is locked by policy, set `node-linker=hoisted` in a local `.npmrc` instead. Note that this disables protection against phantom dependencies, so verify your change in CI before relying on it.

## Pull requests

- Keep each pull request to one logical change. Unrelated fixes in the same branch slow review down.
- Add tests. Core logic is testable without a cloud environment by substituting in-memory port implementations.
- Update documentation in the same pull request as the change it describes.
- Write commit messages that explain why, not what. The diff already shows what.

## Third-party material

Do not add third-party code, assets, or documentation to this repository unless its license explicitly permits redistribution under Apache-2.0, and its attribution requirements are satisfied. When in doubt, open an issue rather than committing it.

## Code of conduct

Participation is governed by the [Code of Conduct](./CODE_OF_CONDUCT.md).
