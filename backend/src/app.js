import express from "express";

import { createTaskStore } from "./tasks.js";

const titleError = "Title must be a string between 1 and 200 characters.";
const completionError = "Completed must be a boolean.";

function errorResponse(res, status, error) {
  return res.status(status).json({ error });
}

export function createApp({ store = createTaskStore(), staticDir } = {}) {
  const app = express();
  const api = express.Router();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));

  api.get("/health", (_req, res) => res.json({ status: "ok" }));
  api.get("/tasks", (_req, res) => res.json(store.list()));

  api.post("/tasks", (req, res) => {
    if (!req.body || typeof req.body.title !== "string") {
      return errorResponse(res, 400, titleError);
    }
    const title = req.body.title.trim();
    if (title.length === 0 || title.length > 200) {
      return errorResponse(res, 400, titleError);
    }
    return res.status(201).json(store.create(title));
  });

  api.patch("/tasks/:id", (req, res) => {
    if (!req.body || typeof req.body.completed !== "boolean") {
      return errorResponse(res, 400, completionError);
    }
    const task = store.updateCompletion(req.params.id, req.body.completed);
    if (!task) return errorResponse(res, 404, "Task not found.");
    return res.json(task);
  });

  api.delete("/tasks/:id", (req, res) => {
    if (!store.remove(req.params.id)) return errorResponse(res, 404, "Task not found.");
    return res.status(204).end();
  });

  api.use((_req, res) => errorResponse(res, 404, "API route not found."));
  app.use("/api", api);

  if (staticDir) {
    app.use(express.static(staticDir));
    app.get("/", (_req, res) => res.sendFile("index.html", { root: staticDir }));
  }

  app.use((err, _req, res, next) => {
    void next;
    if (err?.type === "entity.too.large") return errorResponse(res, 413, "Request body is too large.");
    if (err instanceof SyntaxError && "body" in err) return errorResponse(res, 400, "Malformed JSON request body.");
    console.error("Unexpected request error", err);
    return errorResponse(res, 500, "Internal server error.");
  });

  return app;
}
