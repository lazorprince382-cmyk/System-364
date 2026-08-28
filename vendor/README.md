# Vendored npm packages

Bundled so deploy servers with unstable npm TLS/network never download these from the registry.

| Package | Version | Used by |
|---------|---------|---------|
| `utils-merge` | 1.0.1 | Express (Uniform, Kitchen, Finance APIs) |

**Location:** `vendor/utils-merge/` (full package directory)

**Auto-copied** to `server/vendor/`, `kitchen/vendor/`, `finance/server/vendor/` before install via `scripts/ensure-vendor.js`.

Each Express `package.json` includes:

```json
"dependencies": { "utils-merge": "file:vendor/utils-merge" },
"overrides": { "utils-merge": "$utils-merge" }
```

Do not delete `vendor/` — deploy will fail without it.
