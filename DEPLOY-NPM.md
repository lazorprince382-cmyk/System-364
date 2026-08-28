# npm install on deploy (System-364)

If `npm install` fails with **TLS / network / utils-merge** errors, this repo is already set up to avoid them.

## What we ship in GitHub

| Fix | Purpose |
|-----|---------|
| `vendor/utils-merge/` | Bundled Express dependency — **no npm registry download** |
| `overrides` + direct `file:` dep | Every Express app uses the local copy |
| `.npmrc` | Retries, longer timeouts, `prefer-offline` |
| `.nvmrc` / `NODE_VERSION=20` | Consistent Node on Render/VPS |
| `scripts/ensure-vendor.js` | Copies vendor into `server/`, `kitchen/`, `finance/server/` before install |
| `scripts/copy-npmrc.js` | Copies retry settings into each workspace |

## Deploy commands (recommended)

From repo root:

```bash
npm run install:all
npm run build
```

**Render:** `render.yaml` runs `ensure-vendor`, `copy-npmrc`, then `install:all`.

**VPS / manual:**

```bash
git clone https://github.com/lazorprince382-cmyk/System-364.git
cd System-364
nvm use          # Node 20 — see .nvmrc
npm run install:all
```

## If other packages still fail (unstable network)

Root `.npmrc` already sets retries. You can also run:

```bash
npm config set fetch-retries 5
npm config set fetch-retry-mintimeout 20000
npm config set fetch-retry-maxtimeout 120000
npm install
```

Retry once or twice — often a transient registry drop.

## Node version

- **Minimum:** Node 18  
- **Recommended:** Node 20 LTS (`.nvmrc` and Render `NODE_VERSION`)

## Maintainer: refresh a vendored package

```bash
npm pack utils-merge@1.0.1
tar -xzf utils-merge-1.0.1.tgz
# move package/ to vendor/utils-merge/ (strip devDependencies from package.json)
node scripts/ensure-vendor.js
npm install && cd server && npm install && cd ../kitchen && npm install
```
