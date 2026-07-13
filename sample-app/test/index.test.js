/**
 * Minimal smoke tests using Node's built-in test runner (no extra
 * dependencies needed). Jenkins will run these with `npm test` in
 * Module 03 — this is what "the pipeline catches a bug" looks like
 * in practice.
 */
const test = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const app = require("../index.js");

let server;

test.before(() => {
  server = app.listen(0); // 0 = pick a free port
});

test.after(() => {
  server.close();
});

function get(path) {
  return new Promise((resolve, reject) => {
    const { port } = server.address();
    http.get(`http://127.0.0.1:${port}${path}`, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    }).on("error", reject);
  });
}

test("GET / returns a message and a version", async () => {
  const { status, body } = await get("/");
  assert.strictEqual(status, 200);
  assert.ok(body.message);
  assert.ok(body.version);
});

test("GET /health returns ok", async () => {
  const { status, body } = await get("/health");
  assert.strictEqual(status, 200);
  assert.strictEqual(body.status, "ok");
});
