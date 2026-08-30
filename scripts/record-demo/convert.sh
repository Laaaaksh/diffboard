#!/usr/bin/env bash
# Converts the raw Playwright recording (out/demo.raw.webm) into the two
# assets the README embeds: docs/assets/demo.mp4 (full quality, linked) and
# docs/assets/demo.gif (embedded inline - must stay under 10 MB).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
RAW="$HERE/out/demo.raw.webm"
MP4="$REPO_ROOT/docs/assets/demo.mp4"
GIF="$REPO_ROOT/docs/assets/demo.gif"
PALETTE="$HERE/out/palette.png"

if [ ! -f "$RAW" ]; then
  echo "No raw recording at $RAW - run 'npm run record' first." >&2
  exit 1
fi

mkdir -p "$REPO_ROOT/docs/assets"

echo "Encoding $MP4 ..."
ffmpeg -y -i "$RAW" -vf "scale=1280:-2" -c:v libx264 -pix_fmt yuv420p -movflags +faststart "$MP4"

echo "Building palette for the GIF ..."
ffmpeg -y -i "$RAW" -vf "fps=12,scale=960:-2:flags=lanczos,palettegen" "$PALETTE"

echo "Encoding $GIF ..."
ffmpeg -y -i "$RAW" -i "$PALETTE" \
  -lavfi "fps=12,scale=960:-2:flags=lanczos[x];[x][1:v]paletteuse" \
  "$GIF"

rm -f "$PALETTE"

MP4_SIZE=$(du -h "$MP4" | cut -f1)
GIF_SIZE=$(du -h "$GIF" | cut -f1)
echo "Done: $MP4 ($MP4_SIZE), $GIF ($GIF_SIZE)"

GIF_BYTES=$(wc -c < "$GIF")
if [ "$GIF_BYTES" -gt 10485760 ]; then
  echo "WARNING: $GIF is over 10 MB ($GIF_BYTES bytes) - drop fps or shorten the walkthrough." >&2
  exit 1
fi
