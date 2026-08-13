# @jamcaa/core

## 0.2.0

### Minor Changes

- 3c6d3a4: Rename `hasAnyUser` to `hasAdministrator`; installation now counts only
  administrators, so accounts seeded by content migrations do not close the
  first-run setup page.

## 0.1.0

### Minor Changes

- 8472a2a: The first published release of the pre-alpha Platform packages. Packages remain source-exported: consumers compile the TypeScript sources their toolchain already handles, and Sites on Next.js add them to `transpilePackages`.
