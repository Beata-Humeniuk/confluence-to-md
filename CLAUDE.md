# Notes for Claude

## Every change that users see is a release

`.github/workflows/publish.yml` publishes the extension when a push to `main`
carries a version in `package.json` that has no `v<version>` tag yet. A
change merged without a new version is never published.

So every pull request with a user-visible change (code in `src/` or `media/`,
anything listed in `CHANGELOG.md`) also raises the version:

- `npm version <x.y.z> --no-git-tag-version`, so `package.json` and
  `package-lock.json` agree;
- in `CHANGELOG.md`, move the entries under `## [Unreleased]` to a new
  `## [x.y.z] - YYYY-MM-DD` section and leave `## [Unreleased]` empty above it.

Follow Semantic Versioning: a patch for fixes, a minor version for new
features. When a pull request already raised the version and is still open,
further commits to it keep that version. Do not create the tag yourself; the
workflow does it after publishing.

## Tests

`npm test` runs every `test/*-test.js` file.
