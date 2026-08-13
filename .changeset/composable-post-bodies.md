---
"@jamcaaxian/core": minor
---

Add the `blocks` Field kind so Entry bodies can be composed of Blocks, with Rich Text as one Block among others. Bodies written before composability are wrapped into a single rich-text Block on read, and `blocksToRichText` also accepts those legacy documents.
