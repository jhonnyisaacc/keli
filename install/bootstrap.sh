#!/usr/bin/env sh
# Keli POSIX bootstrap installer (0.1-E)
# Usage: curl -fsSL <url>/install/bootstrap.sh | sh
set -eu

KELI_INSTALL_ROOT="${KELI_INSTALL_ROOT:-$HOME/.local/lib/keli}"
KELI_INSTALL_BIN="${KELI_INSTALL_BIN:-$HOME/.local/bin/keli}"
MANIFEST_URL="${KELI_UPDATE_MANIFEST_URL:-}"

detect_platform() {
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch="$(uname -m)"
  case "$os" in
    linux) platform=linux ;;
    darwin) platform=darwin ;;
    *) echo "Unsupported OS: $os" >&2; exit 1 ;;
  esac
  case "$arch" in
    x86_64|amd64) keli_arch=x64 ;;
    aarch64|arm64) keli_arch=arm64 ;;
    *) echo "Unsupported arch: $arch" >&2; exit 1 ;;
  esac
}

if [ -z "$MANIFEST_URL" ]; then
  echo "Set KELI_UPDATE_MANIFEST_URL to a release manifest JSON URL." >&2
  exit 1
fi

detect_platform
tmp="$(mktemp)"
curl -fsSL "$MANIFEST_URL" -o "$tmp"

version="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$tmp" | head -1)"
artifact_name="keli-${platform}-${keli_arch}"
sha256="$(python3 - <<PY
import json,sys
m=json.load(open("$tmp"))
for a in m.get("artifacts",[]):
    if a.get("platform")=="$platform" and a.get("arch")=="$keli_arch":
        print(a["sha256"]); break
PY
)"

url="$(python3 - <<PY
import json
m=json.load(open("$tmp"))
for a in m.get("artifacts",[]):
    if a.get("platform")=="$platform" and a.get("arch")=="$keli_arch":
        print(a.get("url","")); break
PY
)"

if [ -z "$version" ] || [ -z "$sha256" ] || [ -z "$url" ]; then
  echo "Manifest missing artifact for ${platform}-${keli_arch}" >&2
  exit 1
fi

dest_dir="$KELI_INSTALL_ROOT/versions/$version"
mkdir -p "$dest_dir"
bin_tmp="$(mktemp)"
curl -fsSL "$url" -o "$bin_tmp"
actual="$(sha256sum "$bin_tmp" | awk '{print $1}')"
if [ "$actual" != "$sha256" ]; then
  echo "Checksum mismatch" >&2
  rm -f "$bin_tmp"
  exit 1
fi
mv "$bin_tmp" "$dest_dir/keli"
chmod +x "$dest_dir/keli"
mkdir -p "$(dirname "$KELI_INSTALL_BIN")"
ln -sf "$dest_dir/keli" "$KELI_INSTALL_BIN"
echo "$version" > "$KELI_INSTALL_ROOT/current-version"
echo "Installed keli $version to $KELI_INSTALL_BIN"
rm -f "$tmp"
