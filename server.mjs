import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { classify } from "./mock-ai.mjs";

const html = await readFile(new URL("./index.html", import.meta.url));
const ALLOWED_TOPICS = new Set(["delivery", "pricing", "other"]);

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function handleTriage(request, response) {
  let body;
  try {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return json(response, 400, { status: "invalid_input" });
  }

  if (typeof body?.text !== "string" || !body.text.trim()) {
    return json(response, 400, { status: "invalid_input" });
  }

  try {
    const raw = await classify(body.text, { signal: AbortSignal.timeout(300) });
    const result = JSON.parse(raw);
    if (
      !ALLOWED_TOPICS.has(result.topic) ||
      typeof result.draft !== "string" ||
      !result.draft.trim()
    ) {
      throw new Error("Invalid model response");
    }
    return json(response, 200, { status: "ready", topic: result.topic, draft: result.draft });
  } catch {
    return json(response, 200, { status: "manual_review", topic: null, draft: null });
  }
}

createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(html);
    return;
  }
  if (request.method !== "POST" || request.url !== "/api/triage") {
    return json(response, 404, { status: "not_found" });
  }
  try {
    await handleTriage(request, response);
  } catch {
    json(response, 500, { status: "server_error" });
  }
}).listen(Number(process.env.PORT || 3000), "127.0.0.1");
