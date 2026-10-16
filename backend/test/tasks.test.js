import assert from "node:assert/strict";
import test from "node:test";

import request from "supertest";

import { createApp } from "../src/app.js";

const app = () => createApp();

test("health and seeded task list are available", async () => {
  await request(app()).get("/api/health").expect(200, { status: "ok" });
  const response = await request(app()).get("/api/tasks").expect(200);
  assert.equal(response.body.length, 2);
  assert.equal(response.body[0].id, "seed-1");
});

test("creates a trimmed task with a generated id", async () => {
  const response = await request(app()).post("/api/tasks").send({ title: "  Write tests  " }).expect(201);
  assert.match(response.body.id, /^[0-9a-f-]{36}$/i);
  assert.deepEqual({ title: response.body.title, completed: response.body.completed }, { title: "Write tests", completed: false });
});

test("updates completion and deletes a task", async () => {
  const instance = app();
  const created = await request(instance).post("/api/tasks").send({ title: "Remove me" }).expect(201);
  await request(instance).patch(`/api/tasks/${created.body.id}`).send({ completed: true }).expect(200, { ...created.body, completed: true });
  await request(instance).delete(`/api/tasks/${created.body.id}`).expect(204);
  await request(instance).get("/api/tasks").expect(200).expect((response) => assert.equal(response.body.some((task) => task.id === created.body.id), false));
});

test("rejects invalid titles", async () => {
  for (const title of [undefined, null, 3, "   ", "x".repeat(201)]) {
    await request(app()).post("/api/tasks").send(title === undefined ? {} : { title }).expect(400, { error: "Title must be a string between 1 and 200 characters." });
  }
});

test("rejects invalid completion values and missing tasks", async () => {
  await request(app()).patch("/api/tasks/seed-1").send({ completed: "true" }).expect(400, { error: "Completed must be a boolean." });
  await request(app()).patch("/api/tasks/missing").send({ completed: true }).expect(404, { error: "Task not found." });
  await request(app()).delete("/api/tasks/missing").expect(404, { error: "Task not found." });
});

test("returns structured errors for malformed, oversized, and unknown API requests", async () => {
  await request(app()).post("/api/tasks").set("Content-Type", "application/json").send("{bad").expect(400, { error: "Malformed JSON request body." });
  await request(app()).post("/api/tasks").send({ title: "x".repeat(17_000) }).expect(413, { error: "Request body is too large." });
  await request(app()).get("/api/nope").expect(404, { error: "API route not found." });
});

test("each app has a fresh seeded store", async () => {
  const first = app();
  await request(first).post("/api/tasks").send({ title: "Only first app" }).expect(201);
  const second = await request(app()).get("/api/tasks").expect(200);
  assert.equal(second.body.length, 2);
});
