# Install and update

## POSIX bootstrap (no Bun required)

```sh
export KELI_UPDATE_MANIFEST_URL="https://example.com/keli/manifest.json"
curl -fsSL https://example.com/keli/install/bootstrap.sh | sh
```

The bootstrap script:

1. Detects OS/arch (`linux|darwin` × `x64|arm64`)
2. Downloads the release manifest
3. Verifies SHA-256 for the matching artifact
4. Installs to `~/.local/lib/keli/versions/<version>/keli`
5. Atomically links `~/.local/bin/keli`

Override paths with `KELI_INSTALL_ROOT` and `KELI_INSTALL_BIN`.

## From source (development)

```sh
bun install
bun run build
./dist/keli init
```

## `keli update`

```sh
keli update --check
keli update --install --manifest /path/to/manifest.json
keli update --rollback
```

Update flow: verify manifest → stage binary → snapshot state → migrate → activate. Previous version is retained under `~/.local/lib/keli/versions/`.

## Support matrix

| Platform | Arch | Status |
|----------|------|--------|
| Linux | x64 | CI tested |
| Linux | arm64 | declared |
| macOS | arm64 | declared (Landlock N/A; sandbox fail-closed) |
| macOS | x64 | declared |

macOS release signing/notarization requires Apple credentials outside CI.
