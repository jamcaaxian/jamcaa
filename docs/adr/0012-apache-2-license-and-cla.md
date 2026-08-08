# Apache-2.0, with a contributor licence agreement

The project is released under Apache-2.0, and outside contributions require a signed Contributor Licence Agreement.

**Apache-2.0 over MIT**: both are permissive, but Apache-2.0 carries an express patent grant and trademark terms. For adopters who must clear a legal review, that clause measurably lowers the barrier, whereas MIT's silence on patents routinely prompts further questions.

**Not AGPL**: AGPL would prevent others from offering a closed-source competing hosted service, but a considerable number of organisations ban AGPL dependencies by internal policy. For a framework whose primary goal is wide adoption, that cost outweighs the protection it buys.

**A CLA rather than a DCO alone**: a DCO is only a contributor's statement about the origin of their code and grants the project no right to relicense. Once outside contributions are accepted without a CLA, the project **permanently loses the ability to change its licence** unless every past contributor can be located and agrees. This is among the most typical irreversible decisions in open source, and so it is settled before the first public release.

## Consequences

A CLA will deter some contributors. That cost is known and accepted. To mitigate it, signing must be automated — handled by a bot when a pull request is opened — and must not become a manual approval step.

Third-party material must not be mixed into this repository. External tooling and assets used during development that do not come with clear redistribution terms are kept out of version control entirely.
