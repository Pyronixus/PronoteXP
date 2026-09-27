# Backend

The backend is a small TypeScript adapter around `pronotets` (the npm package for pronoteTs).

## Files

- `src/exporter.ts` — authenticates with PRONOTE and converts the data into the JSON format expected by the frontend.
- `src/http.ts` — HTTP, CORS, and request-body helpers.
- `../api/export/*.ts` — Vercel serverless entry points.

## Runtime model

The API is stateless and request-based:

1. Receive an export request.
2. Create a `pronotets` client.
3. Authenticate with PRONOTE or an ENT provider.
4. Read the selected data.
5. Return JSON.
6. Finish the function execution.

No session is kept between API invocations.
