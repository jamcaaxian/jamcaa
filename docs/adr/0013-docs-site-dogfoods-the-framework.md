# The documentation site is built with the framework and doubles as the example

The official documentation site is built using this framework and serves as the official example site.

For a framework, documentation is part of the product; and building the documentation site with the framework itself is the most direct evidence that it actually works. It also creates genuine pressure from real requirements — categories, search, navigation, syntax highlighting, versioned content — which surface defects in the core before any outside user meets them. A separate documentation toolchain would keep those defects hidden until somebody depended on them.

The example and the documentation site are one and the same to avoid maintaining two demonstrations. In practice a separate example site rots into stale code that nobody updates.

## Consequences

There is an explicit bootstrapping order: the documentation site cannot exist before the framework can render content. Early documentation is therefore maintained as Markdown files inside the repository and migrated into the framework once the content pipeline works. ADR-0019 defines rich text as the stored form and Markdown as an interchange format.

It also ties the documentation site's availability to the framework's stability: a serious defect in the framework takes the documentation with it. That risk is inherent to bootstrapping and is accepted in exchange for the benefits above.
