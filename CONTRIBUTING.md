# Contributing to FileVista

Thanks for helping improve FileVista. Contributions that fix rendering issues, improve browser compatibility, add tests, or make the integration experience clearer are welcome.

## Before you start

- Search [existing issues](https://github.com/CoderLambert/filevista/issues) before opening a new one.
- Use the bug report template for reproducible defects and the feature request template for product ideas.
- For a new preview format or a material API change, open an issue before implementation so the format limits and public interface can be agreed first.
- Report security vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## Local setup

FileVista requires Node.js 22+ and pnpm 11+.

```bash
pnpm install
pnpm run dev
```

The monorepo contains the published library in `packages/file-preview` and the demo application in `apps/playground`.

## Validation

Run the complete validation suite before opening a pull request:

```bash
pnpm run check
```

For focused library work, these commands are also available:

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build:lib
```

Add or update tests for behavior changes. When changing a renderer, test both a representative supported file and its expected fallback or failure state.

## Pull requests

- Keep each pull request focused on one problem.
- Explain the user-visible behavior, important tradeoffs, and how the change was tested.
- Include screenshots or short recordings for visual changes.
- Add a Changeset for changes that affect the published package:

```bash
pnpm changeset
```

- Do not commit generated `dist`, `.next`, or `out` directories.

By contributing, you agree that your contribution is licensed under the repository's [LGPL-3.0-or-later license](LICENSE).
