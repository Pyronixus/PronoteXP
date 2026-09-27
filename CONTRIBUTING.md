# Contributing

Thanks for contributing to PronoteXP.

## Structure

- **`api/`** — Vercel serverless entry points.
- **`backend/src/`** — PRONOTE integration and export formatting.
- **`frontend/`** — static web interface and local file generation.

The PRONOTE client itself is provided by the published `pronotets` npm package; it is not copied into the repository.

## Setup

Requirements: Node.js 18.14+ and npm.

```bash
npm install
npm run typecheck
```

For local serverless development:

```bash
npx vercel dev
```

## Workflow

1. Create a dedicated branch.
2. Make the requested changes.
3. Run `npm run typecheck`.
4. Test the affected login and export flows.
5. Check that JSON, XLSX, and ODS exports still work.

## Rules

- Never log credentials, tokens, QR payloads, or school data.
- Keep the API stateless.
- Preserve the JSON fields expected by the frontend unless a change is intentional.
- Keep dependencies minimal and document meaningful new dependencies.

## License

Contributions are distributed under the MIT license.
