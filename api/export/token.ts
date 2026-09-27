import type { IncomingMessage, ServerResponse } from "node:http";
import { exportWithToken } from "../../backend/src/exporter.js";
import { cors, getBody, handleOptions, sendJson } from "../../backend/src/http.js";

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  if (handleOptions(req, res)) return;
  cors(res);
  if (req.method !== "POST") return sendJson(res, 405, { detail: "Method not allowed." });

  try {
    const body = getBody(req as any);
    if (typeof body.url !== "string" || typeof body.username !== "string" || typeof body.token !== "string") {
      return sendJson(res, 400, { detail: "url, username, and token are required." });
    }
    const data = await exportWithToken({ url: body.url, username: body.username, token: body.token });
    return sendJson(res, 200, data);
  } catch (error) {
    return sendJson(res, 400, { detail: error instanceof Error ? error.message : String(error) });
  }
}
