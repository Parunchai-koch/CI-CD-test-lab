import path from "node:path";
import { fileURLToPath } from "node:url";

import { createApp } from "./app.js";

const port = Number.parseInt(process.env.PORT ?? "8080", 10);
const directory = path.dirname(fileURLToPath(import.meta.url));
const staticDir = process.env.NODE_ENV === "production" ? path.resolve(directory, "../public") : undefined;
const app = createApp({ staticDir });
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Task app listening on http://0.0.0.0:${port}`);
});

server.on("error", (error) => {
  console.error("Server failed to start", error);
  process.exitCode = 1;
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; closing server.`);
  const forceExit = setTimeout(() => {
    console.error("Graceful shutdown timed out.");
    process.exit(1);
  }, 10_000);
  forceExit.unref();
  server.close(() => {
    clearTimeout(forceExit);
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
