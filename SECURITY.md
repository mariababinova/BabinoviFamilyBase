# Security Policy

This repository contains a private family medical knowledge base.

## Non-negotiable rules

- The repository must remain private.
- Raw medical documents must not be published in a public Pages artifact.
- `06 Сайт/src/generated/*.json` is generated locally/CI and must not be committed.
- `.env` files and API keys must never be committed.
- Public demos must use synthetic or redacted data only.

## Production site policy

The default `npm run build` creates a static dashboard without copying PDF/JPG/PNG originals into `dist`.

Raw document publishing is allowed only for private/local builds with an explicit opt-in command:

```powershell
npm run build:with-documents
```

Before uploading a Pages artifact, CI runs:

```powershell
npm run validate:pages-artifact
```

This fails the build if raw PDF/JPG/PNG files appear in `dist`.
