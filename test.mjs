import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

test("поведение при сбое модели", async (t) => {
  const port = 3099;
  const proc = spawn("node", ["server.mjs"], {
    env: { ...process.env, PORT: String(port) },
    stdio: "ignore",
  });
  t.after(() => proc.kill());

  const url = `http://127.0.0.1:${port}/api/triage`;

  for (let i = 0; i < 20; i++) {
    try {
      await fetch(`http://127.0.0.1:${port}/`);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  // Сбой по таймауту (>300 мс)
  const resTimeout = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "заявка [timeout]" }),
  });
  assert.equal(resTimeout.status, 200);
  assert.deepEqual(await resTimeout.json(), {
    status: "manual_review",
    topic: null,
    draft: null,
  });

  // Сбой из-за ошибки имитатора
  const resError = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "заявка [error]" }),
  });
  assert.equal(resError.status, 200);
  assert.deepEqual(await resError.json(), {
    status: "manual_review",
    topic: null,
    draft: null,
  });
});
