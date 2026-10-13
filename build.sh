#!/usr/bin/env bash
# Construiește `dist/` — aplicația Minløn (daghold, un singur tip de tură).
# Cloudflare Workers: build command `bash build.sh`, deploy command `npx wrangler deploy`
# (wrangler.jsonc publică doar `dist/`).
# Fonturile sunt self-hosted în `fonts/`.
# Nicio sumă personală în cod: toate tarifele se introduc în Setări și stau doar în
# localStorage-ul telefonului.

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

OUT="$APP_DIR/dist"

rm -rf "$OUT"
mkdir -p "$OUT/icons" "$OUT/fonts"

cp "$APP_DIR"/index.html "$APP_DIR"/app.js "$APP_DIR"/style.css \
   "$APP_DIR"/manifest.json "$APP_DIR"/sw.js \
   "$APP_DIR"/robots.txt "$APP_DIR"/_headers "$OUT/"
cp "$APP_DIR"/icons/*.png "$APP_DIR"/icons/*.svg "$OUT/icons/"
cp "$APP_DIR"/fonts/*.woff2 "$OUT/fonts/"

# Același mecanism ca în build.sh-ul principal: build id unic → sw.js diferit la
# fiecare publicare → telefoanele preiau versiunea nouă automat.
BUILD_ID="${WORKERS_CI_COMMIT_SHA:-${CF_PAGES_COMMIT_SHA:-$(date +%Y%m%d%H%M%S)}}"
sed -i.bak "s/__BUILD_ID__/$BUILD_ID/g" "$OUT/sw.js" && rm -f "$OUT/sw.js.bak"

EXPECTED="const CACHE_NAME = 'minlon-$BUILD_ID';"
if ! grep -qF "$EXPECTED" "$OUT/sw.js"; then
  echo "EROARE: dist/sw.js nu conține linia așteptată:" >&2
  echo "  așteptat: $EXPECTED" >&2
  exit 1
fi

echo "Build OK → $OUT (CACHE_NAME: minlon-$BUILD_ID)"
