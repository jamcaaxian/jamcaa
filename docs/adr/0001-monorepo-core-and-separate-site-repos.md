# The core is a monorepo; sites live in their own repositories

The framework is meant to be reusable across any content-driven website. That goal produces two structural decisions.

**The framework itself is a monorepo.** The core (`packages/core`) lives alongside the admin interface and shared browser packages because they must version together — change an extension point in the core and the consumers have to follow. Coordinating that across repositories costs far more than it returns. Browser-dependent capabilities belong in optional packages that depend on the Worker-safe core; the core never depends on those packages.

**Sites live in their own repositories.** A site carries its own content declaration, brand assets, and deployment configuration, some of which is unsuitable for publication or simply irrelevant to the framework. Folding a site into the framework repository would mix unrelated material into its commit history, and that mixing is **irreversible** — scrubbing git history after the fact is both awkward and easy to get wrong. The framework repository keeps exactly one neutral example site, used for demonstration and for validating that the framework can build itself.

## Considered Options

- **Single application driven by configuration**: fastest to build, but "reuse on a new site" degenerates into forking the repository. The two copies then evolve separately and fixes in the core never flow back.
- **Multi-tenant single deployment** (in the manner of WordPress Multisite): lowest operational cost, but the complexity of data isolation, domain routing, and cross-site permissions far exceeds the present return.
- **Framework monorepo plus separate site repositories** (adopted): requires up-front investment in designing the core's API boundaries, in exchange for core upgrades reaching every site at once, with each site's private material kept out of everyone else's way.

## Consequences

No concept belonging to a single site may appear in `core`. Any rule that holds for only one site must be expressed as a declaration in that site's configuration, never as a branch inside the core.

Sites consume the framework through published package versions. Workspace linking may be used by the neutral example Site during development, but independent Sites consume matching published versions of the core and any optional browser packages. This convenience is not a licence to let Site code flow back into framework packages.
