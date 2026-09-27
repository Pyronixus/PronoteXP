# Quickstart

## 1. Install

Requirements: Node.js 18.14+ and npm.

```bash
npm install
```

## 2. Check the project

```bash
npm run typecheck
```

## 3. Run locally

To run the frontend and serverless API locally:

```bash
npx vercel dev
```

## 4. Deploy to Vercel

Import the repository into Vercel and deploy it from the repository root.

The deployed application provides:

- `/` — frontend
- `/api/export/qrcode` — QR login
- `/api/export/token` — token login
- `/api/export/credentials` — username/password login

## 5. Optional GitHub Pages frontend

For a separate GitHub Pages frontend, set the repository variable `PRONOTEXP_API_BASE` to the URL of your Vercel deployment.

Example:

```text
https://your-project.vercel.app
```

## Notes

The project uses the published `pronotets` npm package. You do not need to clone or copy `pronoteTs` into this repository.

There is no permanent backend process to maintain. Vercel starts the API function when an export is requested and stops using that execution after the request completes.
