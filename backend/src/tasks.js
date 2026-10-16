import { randomUUID } from "node:crypto";

const seedTasks = [
  { id: "seed-1", title: "Connect React to the API", completed: false },
  { id: "seed-2", title: "Try completing a task", completed: true },
];

const copyTask = (task) => ({ ...task });

export function createTaskStore(initialTasks = seedTasks) {
  const tasks = initialTasks.map(copyTask);

  return {
    list() {
      return tasks.map(copyTask);
    },
    create(title) {
      const task = { id: randomUUID(), title, completed: false };
      tasks.push(task);
      return copyTask(task);
    },
    updateCompletion(id, completed) {
      const task = tasks.find((item) => item.id === id);
      if (!task) return null;
      task.completed = completed;
      return copyTask(task);
    },
    remove(id) {
      const index = tasks.findIndex((item) => item.id === id);
      if (index === -1) return false;
      tasks.splice(index, 1);
      return true;
    },
  };
}
