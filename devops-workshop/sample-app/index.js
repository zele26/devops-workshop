/**
 * DevOps Workshop Sample App
 * ---------------------------------------------------------
 * A deliberately tiny Express server. It exists purely so
 * every module in this workshop (Docker, Jenkins, Kubernetes,
 * Helm, ArgoCD, Vault) has something real to build, test,
 * package, and deploy.
 *
 * Routes:
 *   GET /            -> basic JSON greeting + version + who served it
 *   GET /health      -> liveness/readiness probe target for Kubernetes
 *   GET /secret      -> demonstrates reading a value that, in the Vault
 *                        module, will come from Vault instead of an
 *                        environment variable
 */
const express = require("express");
const os = require("os");

const app = express();
const PORT = process.env.PORT || 3000;
const APP_VERSION = process.env.APP_VERSION || "1.0.0";

app.get("/", (req, res) => {
  res.json({
    message: "Hello from the DevOps Workshop app!",
    version: APP_VERSION,
    servedBy: os.hostname(), // useful later to SEE load-balancing across pods
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/secret", (req, res) => {
  // In Module 07 (Vault) this value will be injected securely at runtime
  // instead of being set as a plain environment variable.
  const dbPassword = process.env.DB_PASSWORD || "(not set)";
  res.json({
    note: "In a real app, never expose this. This route exists only to prove where the value came from.",
    dbPasswordSource: dbPassword === "(not set)" ? "not set" : "environment/secret store",
  });
});

function start() {
  return app.listen(PORT, () => {
    console.log(`devops-workshop-app v${APP_VERSION} listening on port ${PORT}`);
  });
}

if (require.main === module) {
  start();
}

module.exports = app;
