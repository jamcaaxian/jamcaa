# Security Policy

## Reporting a vulnerability

Please do **not** open a public issue for security problems.

Report vulnerabilities through [GitHub's private advisory form](https://github.com/jamcaaxian/jamcaa/security/advisories/new). If that is unavailable to you, contact the maintainers directly instead.

Please include what an attacker could achieve, the steps to reproduce it, and the affected versions if known.

## Scope

This project handles authentication, file uploads, and credentials for external storage providers. Reports touching any of the following are especially valuable:

- Authentication or session handling flaws
- Permission checks that can be bypassed
- Exposure of storage credentials or presigned upload URLs
- Content injection through the Markdown rendering pipeline
- Server-side request forgery via configurable storage endpoints

## Supported versions

The project is pre-alpha. Only the latest release receives fixes until a 1.0 release is published.
