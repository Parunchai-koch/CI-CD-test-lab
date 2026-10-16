import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import App from "./App.jsx";

const tasks = [{ id: "1", title: "First task", completed: false }];
const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("App", () => {
  beforeEach(() => { globalThis.fetch = vi.fn(); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("loads and renders tasks", async () => {
    fetch.mockResolvedValueOnce(jsonResponse(tasks));
    render(<App />);
    expect(screen.getByText("Loading tasks…")).toBeInTheDocument();
    expect(await screen.findByText("First task")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "First task" })).not.toBeChecked();
  });

  it("shows an empty state", async () => {
    fetch.mockResolvedValueOnce(jsonResponse([]));
    render(<App />);
    expect(await screen.findByText("No tasks yet. Add one above.")).toBeInTheDocument();
  });

  it("retries an initial request failure", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ error: "Offline" }, 503)).mockResolvedValueOnce(jsonResponse(tasks));
    render(<App />);
    expect(await screen.findByText(/Could not load tasks: Offline/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("First task")).toBeInTheDocument();
  });

  it("adds, toggles, and deletes only after successful requests", async () => {
    const newTask = { id: "2", title: "New task", completed: false };
    fetch.mockResolvedValueOnce(jsonResponse(tasks)).mockResolvedValueOnce(jsonResponse(newTask, 201)).mockResolvedValueOnce(jsonResponse({ ...newTask, completed: true })).mockResolvedValueOnce(new Response(null, { status: 204 }));
    render(<App />);
    await screen.findByText("First task");
    fireEvent.change(screen.getByLabelText("New task"), { target: { value: "New task" } });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));
    expect(await screen.findByRole("checkbox", { name: "New task" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "New task" }));
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "New task" })).toBeChecked());
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[1]);
    await waitFor(() => expect(screen.queryByRole("checkbox", { name: "New task" })).not.toBeInTheDocument());
  });

  it("preserves displayed state and form text after failed mutations", async () => {
    fetch.mockResolvedValueOnce(jsonResponse(tasks)).mockResolvedValueOnce(jsonResponse({ error: "Unable to save" }, 500)).mockResolvedValueOnce(jsonResponse({ error: "Unable to update" }, 500));
    render(<App />);
    await screen.findByText("First task");
    fireEvent.change(screen.getByLabelText("New task"), { target: { value: "Stay here" } });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));
    expect(await screen.findByText("Unable to save")).toBeInTheDocument();
    expect(screen.getByLabelText("New task")).toHaveValue("Stay here");
    fireEvent.click(screen.getByRole("checkbox", { name: "First task" }));
    expect(await screen.findByText("Unable to update")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "First task" })).not.toBeChecked();
  });

  it("validates titles and disables controls while requests are pending", async () => {
    let resolveCreate;
    fetch.mockResolvedValueOnce(jsonResponse(tasks)).mockImplementationOnce(() => new Promise((resolve) => { resolveCreate = resolve; }));
    render(<App />);
    await screen.findByText("First task");
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));
    expect(screen.getByText("Enter a task title between 1 and 200 characters.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("New task"), { target: { value: "Pending" } });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));
    expect(screen.getByRole("button", { name: "Adding…" })).toBeDisabled();
    expect(screen.getByLabelText("New task")).toBeDisabled();
    resolveCreate(jsonResponse({ id: "2", title: "Pending", completed: false }, 201));
    expect(await screen.findByText("Pending")).toBeInTheDocument();
  });
});
