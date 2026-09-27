import type { IncomingMessage, ServerResponse } from "node:http";
import { exportWithQrCode } from "../../backend/src/exporter.js";
import { cors, getBody, handleOptions, sendJson } from "../../backend/src/http.js";

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  if (handleOptions(req, res)) return;
  cors(res);
  if (req.method !== "POST") return sendJson(res, 405, { detail: "Method not allowed." });

  try {
    const body = getBody(req as any);
    const qr_data = body.qr_data;
    const pin = body.pin;
    if ((typeof qr_data !== "string" && (!qr_data || typeof qr_data !== "object" || Array.isArray(qr_data))) || typeof pin !== "string") {
      return sendJson(res, 400, { detail: "qr_data and pin are required." });
    }
    const data = await exportWithQrCode({ qr_data: qr_data as any, pin });
    return sendJson(res, 200, data);
  } catch (error) {
    return sendJson(res, 400, { detail: error instanceof Error ? error.message : String(error) });
  }
}
