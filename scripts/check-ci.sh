#!/usr/bin/env bash
# CIと同条件（Linux amd64 / node20）で `npm ci && npm run check` を実行する。
# 「ローカルは通るのにCIで落ちる」(OS差・npm ciの厳密さ) を出荷前に潰すためのもの。
# Apple Container を優先し、無ければ Docker を使う。ホストの node_modules(arm64) は
# tmpfs で分離して壊さない。
set -euo pipefail

IMAGE="docker.io/library/node:20"
WORK=/app
CMD="npm ci && npm run check"

if command -v container >/dev/null 2>&1; then
  echo "▶ Apple Container (linux/amd64) で実行"
  # apiserver が未起動なら起動（初回はカーネル取得で時間がかかることがある）
  container system status 2>/dev/null | grep -q "running" || container system start
  exec container run --rm --arch amd64 -m 4g \
    -v "$PWD:$WORK" -w "$WORK" --tmpfs "$WORK/node_modules" \
    "$IMAGE" bash -lc "$CMD"
elif command -v docker >/dev/null 2>&1; then
  echo "▶ Docker (linux/amd64) で実行"
  exec docker run --rm --platform linux/amd64 \
    -v "$PWD:$WORK" -w "$WORK" --tmpfs "$WORK/node_modules" \
    "$IMAGE" bash -lc "$CMD"
else
  echo "✖ container も docker も見つかりません。どちらかを導入してください。" >&2
  exit 1
fi
