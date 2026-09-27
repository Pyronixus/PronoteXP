import type { IncomingHttpHeaders } from "node:http";

export interface ResponseLike {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

export interface RequestLike {
  method?: string;
  body?: unknown;
  headers: IncomingHttpHeaders & Record<string, string | string[] | undefined>;
}

export function cors(response: ResponseLike): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Cache-Control", "no-store");
}

export function handleOptions(request: RequestLike, response: ResponseLike): boolean {
  cors(response);
  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return true;
  }
  return false;
}

export function sendJson(response: ResponseLike, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

export function getBody(request: RequestLike): Record<string, unknown> {
  const body = request.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Corps de requête JSON invalide.");
  }
  return body as Record<string, unknown>;
}
