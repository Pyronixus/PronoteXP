import type { IncomingMessage, ServerResponse } from "node:http";
import { exportWithCredentials } from "../../backend/src/exporter.js";
import { cors, getBody, handleOptions, sendJson } from "../../backend/src/http.js";

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  if (handleOptions(req, res)) return;
  cors(res);
  if (req.method !== "POST") return sendJson(res, 405, { detail: "Method not allowed." });

  try {
    const body = getBody(req as any);
    if (typeof body.url !== "string" || typeof body.username !== "string" || typeof body.password !== "string") {
      return sendJson(res, 400, { detail: "url, username, and password are required." });
    }
    if (body.ent_name !== undefined && body.ent_name !== null && typeof body.ent_name !== "string") {
      return sendJson(res, 400, { detail: "ent_name must be a string." });
    }
    const data = await exportWithCredentials({
      url: body.url,
      username: body.username,
      password: body.password,
      ent_name: body.ent_name as string | null | undefined,
    });
    return sendJson(res, 200, data);
  } catch (error) {
    return sendJson(res, 400, { detail: error instanceof Error ? error.message : String(error) });
  }
}
