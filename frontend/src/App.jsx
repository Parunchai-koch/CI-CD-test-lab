import { useCallback, useEffect, useState } from "react";

const titleValidationMessage =
  "Enter a task title between 1 and 200 characters.";

async function request(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    let message = "The request failed. Please try again.";
    try {
      const body = await response.json();
      if (body.error) message = body.error;
    } catch {
      // A non-JSON error should still be presented safely.
    }
    throw new Error(message);
  }
  return response.status === 204 ? undefined : response.json();
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [title, setTitle] = useState("");
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);
  const [pendingTaskIds, setPendingTaskIds] = useState(new Set());
  const [actionError, setActionError] = useState("");

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setTasks(await request("/api/tasks"));
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const setTaskPending = (id, pending) => {
    setPendingTaskIds((current) => {
      const next = new Set(current);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  async function addTask(event) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0 || trimmedTitle.length > 200) {
      setFormError(titleValidationMessage);
      return;
    }
    setCreating(true);
    setFormError("");
    try {
      const task = await request("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmedTitle }),
      });
      setTasks((current) => [...current, task]);
      setTitle("");
    } catch (error) {
      setFormError(error.message);
    } finally {
      setCreating(false);
    }
  }

  async function toggleTask(task) {
    setTaskPending(task.id, true);
    setActionError("");
    try {
      const updatedTask = await request(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !task.completed }),
      });
      setTasks((current) =>
        current.map((item) => (item.id === task.id ? updatedTask : item)),
      );
    } catch (error) {
      setActionError(error.message);
    } finally {
      setTaskPending(task.id, false);
    }
  }

  async function deleteTask(task) {
    setTaskPending(task.id, true);
    setActionError("");
    try {
      await request(`/api/tasks/${task.id}`, { method: "DELETE" });
      setTasks((current) => current.filter((item) => item.id !== task.id));
    } catch (error) {
      setActionError(error.message);
    } finally {
      setTaskPending(task.id, false);
    }
  }

  return (
    <main className="page-shell">
      <section className="task-card" aria-labelledby="page-title">
        <header>
          <p className="eyebrow">Demo workspace</p>
          <h1 id="page-title">Shared Em's task list</h1>
          <p className="notice">
            Tasks are shared by everyone and reset whenever the server restarts.
          </p>
        </header>

        <form className="task-form" onSubmit={addTask} noValidate>
          <label htmlFor="task-title">New task</label>
          <div className="form-row">
            <input
              id="task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength="201"
              disabled={creating}
              aria-describedby={formError ? "form-error" : undefined}
              placeholder="What needs doing?"
            />
            <button type="submit" disabled={creating}>
              {creating ? "Adding…" : "Add task"}
            </button>
          </div>
          {formError && (
            <p id="form-error" className="message error" role="alert">
              {formError}
            </p>
          )}
        </form>

        <div className="status-region" aria-live="polite" aria-atomic="true">
          {loading && <p>Loading tasks…</p>}
          {loadError && (
            <div className="message error" role="alert">
              <p>Could not load tasks: {loadError}</p>
              <button type="button" onClick={loadTasks}>
                Retry
              </button>
            </div>
          )}
          {actionError && (
            <p className="message error" role="alert">
              {actionError}
            </p>
          )}
        </div>

        {!loading &&
          !loadError &&
          (tasks.length === 0 ? (
            <p className="empty">No tasks yet. Add one above.</p>
          ) : (
            <ul className="task-list" aria-label="Tasks">
              {tasks.map((task) => {
                const pending = pendingTaskIds.has(task.id);
                return (
                  <li
                    key={task.id}
                    className={task.completed ? "task complete" : "task"}
                  >
                    <label>
                      <input
                        type="checkbox"
                        checked={task.completed}
                        disabled={pending}
                        onChange={() => toggleTask(task)}
                      />
                      <span>{task.title}</span>
                    </label>
                    <button
                      type="button"
                      className="delete"
                      disabled={pending}
                      onClick={() => deleteTask(task)}
                    >
                      {pending ? "Working…" : "Delete"}
                    </button>
                  </li>
                );
              })}
            </ul>
          ))}
      </section>
    </main>
  );
}
