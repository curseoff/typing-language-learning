#!/usr/bin/env bash
# CIと同条件（Linux / node20）で `npm ci && npm run check` を実行する。
# 「ローカルは通るのにCIで落ちる」(OS差・npm ciの厳密さ) を出荷前に潰すためのもの。
#
# 既定は「ホストネイティブのアーキ」(Apple Silicon なら arm64) で実行する。
# GitHub Actions も arm64 ランナー(ubuntu-*-arm)に揃えてあるため、これで完全一致し、
# Rosetta(将来廃止予定)にも依存しない。x64 を厳密に確認したいときだけ:
#   CHECK_CI_ARCH=amd64 npm run check:ci   （Rosetta/QEMU が必要）
# Apple Container を優先し、無ければ Docker を使う。ホストの node_modules は
# tmpfs で分離して壊さない。
set -euo pipefail

IMAGE="docker.io/library/node:20"
WORK=/app
CMD="npm ci && npm run check"
ARCH="${CHECK_CI_ARCH:-}" # 空=ホストネイティブ（既定）

if command -v container >/dev/null 2>&1; then
  echo "▶ Apple Container (${ARCH:-native}) で実行"
  # apiserver が未起動なら起動（初回はカーネル取得で時間がかかることがある）
  container system status 2>/dev/null | grep -q "running" || container system start
  exec container run --rm -m 4g ${ARCH:+--arch "$ARCH"} \
    -v "$PWD:$WORK" -w "$WORK" --tmpfs "$WORK/node_modules" \
    "$IMAGE" bash -lc "$CMD"
elif command -v docker >/dev/null 2>&1; then
  echo "▶ Docker (${ARCH:-native}) で実行"
  exec docker run --rm ${ARCH:+--platform "linux/$ARCH"} \
    -v "$PWD:$WORK" -w "$WORK" --tmpfs "$WORK/node_modules" \
    "$IMAGE" bash -lc "$CMD"
else
  echo "✖ container も docker も見つかりません。どちらかを導入してください。" >&2
  exit 1
fi
