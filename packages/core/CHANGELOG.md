# @jamcaaxian/core

## 0.4.0

### Minor Changes

- a0831d0: Add the `blocks` Field kind so Entry bodies can be composed of Blocks, with Rich Text as one Block among others. Bodies written before composability are wrapped into a single rich-text Block on read, and `blocksToRichText` also accepts those legacy documents.

## 0.3.0

### Minor Changes

- 1644fc9: Add the Block layer: core validates block documents against declared
  prop schemas, and the editor ships a built-in block library with
  server rendering. Core also gains the internal `theme.accent` setting
  that feeds the Site-level theme resolution.

## 0.2.0

### Minor Changes

- 3c6d3a4: Rename `hasAnyUser` to `hasAdministrator`; installation now counts only
  administrators, so accounts seeded by content migrations do not close the
  first-run setup page.

## 0.1.0

### Minor Changes

- 8472a2a: The first published release of the pre-alpha Platform packages. Packages remain source-exported: consumers compile the TypeScript sources their toolchain already handles, and Sites on Next.js add them to `transpilePackages`.
