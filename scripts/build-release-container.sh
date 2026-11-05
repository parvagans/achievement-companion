#!/usr/bin/env bash
# Run in the digest-pinned Rust Bookworm container declared in verify.yml.
set -euo pipefail
test "$(uname -m)" = x86_64
test "$(pwd)" != /
node_archive=node-v24.12.0-linux-x64.tar.xz
curl --fail --silent --show-error --location "https://nodejs.org/dist/v24.12.0/$node_archive" -o "/tmp/$node_archive"
echo "bdebee276e58d0ef5448f3d5ac12c67daa963dd5e0a9bb621a53d1cefbc852fd  /tmp/$node_archive" | sha256sum --check
tar -xJf "/tmp/$node_archive" -C /usr/local --strip-components=1
npm install --global pnpm@9.4.0
pnpm install --frozen-lockfile
node scripts/version/check-version.mjs
pnpm typecheck
pnpm test
pnpm release:prepare

