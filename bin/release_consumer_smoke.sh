#!/usr/bin/env bash
# Install the packed candidate in a separate Lucid consumer before checking its declarations and runtime behavior.
set -euo pipefail

fixture=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../examples/release-consumer" && pwd)
consumer=$(mktemp -d)
trap 'rm -rf -- "$consumer"' EXIT
cp -- "$fixture/"{model.ts,package.json,pnpm-workspace.yaml,tsconfig.json} "$consumer/"
cp -- "${1:?Pass the path to the packed release candidate}" "$consumer/candidate.tgz"
cd -- "$consumer"
pnpm install --no-frozen-lockfile
pnpm smoke
