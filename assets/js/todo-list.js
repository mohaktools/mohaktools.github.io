(() => {
  "use strict";

  const STORAGE_KEY = "mt-todos";
  const PRIORITY_ORDER = { high: 0, medium: 1, med: 1, low: 2 };
  const PRIORITY_LABELS = { high: "High", medium: "Medium", low: "Low" };
  const list = document.getElementById("todo-list");
  const form = document.getElementById("todo-form");
  const status = document.getElementById("todo-status");
  const searchInput = document.getElementById("todo-search");
  const sortInput = document.getElementById("todo-sort");
  const emptyState = document.getElementById("todo-empty");
  let filter = "all";
  let tasks = loadTasks();

  function todayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  function makeId() {
    return window.crypto?.randomUUID?.() || `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeTask(item) {
    if (!item || typeof (item.title || item.text) !== "string" || !(item.title || item.text).trim()) return null;
    const priority = item.priority || (item.pri === "med" ? "medium" : item.pri) || "medium";
    return {
      id: String(item.id || makeId()),
      title: String(item.title || item.text).trim().slice(0, 160),
      notes: typeof item.notes === "string" ? item.notes.slice(0, 1000) : "",
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate || "") ? item.dueDate : "",
      priority: Object.hasOwn(PRIORITY_ORDER, priority) ? (priority === "med" ? "medium" : priority) : "medium",
      category: typeof item.category === "string" ? item.category.slice(0, 40) : "Personal",
      completed: Boolean(item.completed ?? item.done),
      createdAt: item.createdAt || new Date().toISOString()
    };
  }

  function loadTasks() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(saved) ? saved.map(normalizeTask).filter(Boolean) : [];
    } catch (_) {
      return [];
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      return true;
    } catch (_) {
      status.textContent = "Could not save changes. Your browser storage may be full or unavailable.";
      return false;
    }
  }

  function dateFromKey(key) {
    if (!key) return null;
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function formatDueDate(key) {
    const date = dateFromKey(key);
    return date ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric" }).format(date) : "";
  }

  function isOverdue(task) {
    return !task.completed && task.dueDate && task.dueDate < todayKey();
  }

  function updateOverview() {
    const active = tasks.filter(task => !task.completed);
    document.getElementById("todo-stat-open").textContent = String(active.length);
    document.getElementById("todo-stat-today").textContent = String(active.filter(task => task.dueDate === todayKey()).length);
    document.getElementById("todo-stat-overdue").textContent = String(active.filter(isOverdue).length);
    document.getElementById("todo-stat-completed").textContent = String(tasks.filter(task => task.completed).length);
    document.getElementById("todo-list-summary").textContent = `${active.length} open · ${tasks.length - active.length} completed`;
    document.getElementById("todo-clear-completed").disabled = !tasks.some(task => task.completed);
  }

  function matchesFilter(task) {
    if (filter === "today") return !task.completed && task.dueDate === todayKey();
    if (filter === "upcoming") return !task.completed && task.dueDate > todayKey();
    if (filter === "overdue") return isOverdue(task);
    if (filter === "completed") return task.completed;
    return true;
  }

  function sortTasks(items) {
    const sort = sortInput.value;
    const completedOrder = (a, b) => Number(a.completed) - Number(b.completed);
    return items.sort((a, b) => {
      if (sort === "newest") return completedOrder(a, b) || new Date(b.createdAt) - new Date(a.createdAt);
      if (sort === "oldest") return completedOrder(a, b) || new Date(a.createdAt) - new Date(b.createdAt);
      if (sort === "priority") return completedOrder(a, b) || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || compareDueDates(a, b);
      if (sort === "due") return completedOrder(a, b) || compareDueDates(a, b);
      return completedOrder(a, b)
        || Number(isOverdue(b)) - Number(isOverdue(a))
        || compareDueDates(a, b)
        || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
        || new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  function compareDueDates(a, b) {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  }

  function makeTag(text, extraClass = "") {
    const tag = document.createElement("span");
    tag.className = `todo-tag${extraClass ? ` ${extraClass}` : ""}`;
    tag.textContent = text;
    return tag;
  }

  function actionButton(label, action, taskId) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "interactive-button interactive-button-quiet";
    button.dataset.action = action;
    button.dataset.taskId = taskId;
    button.textContent = label;
    return button;
  }

  function makeTaskElement(task) {
    const article = document.createElement("article");
    article.className = `todo-item${task.completed ? " is-complete" : ""}`;

    const complete = document.createElement("input");
    complete.className = "todo-complete";
    complete.type = "checkbox";
    complete.checked = task.completed;
    complete.dataset.action = "toggle";
    complete.dataset.taskId = task.id;
    complete.setAttribute("aria-label", `${task.completed ? "Mark as not done" : "Complete"}: ${task.title}`);

    const content = document.createElement("div");
    const title = document.createElement("div");
    title.className = "todo-title";
    title.textContent = task.title;
    content.appendChild(title);

    if (task.notes) {
      const notes = document.createElement("div");
      notes.className = "todo-notes";
      notes.textContent = task.notes;
      content.appendChild(notes);
    }

    const tags = document.createElement("div");
    tags.className = "todo-meta";
    tags.appendChild(makeTag(`${task.priority === "high" ? "●" : task.priority === "low" ? "○" : "◉"} ${PRIORITY_LABELS[task.priority] || "Medium"}`));
    tags.appendChild(makeTag(task.category || "Personal"));
    if (task.dueDate) tags.appendChild(makeTag(`${isOverdue(task) ? "Overdue · " : "Due · "}${formatDueDate(task.dueDate)}`, isOverdue(task) ? "is-overdue" : ""));
    content.appendChild(tags);

    const actions = document.createElement("div");
    actions.className = "todo-item-actions";
    actions.append(actionButton("Edit", "edit", task.id), actionButton("Delete", "delete", task.id));
    article.append(complete, content, actions);
    return article;
  }

  function updateFilterCounts() {
    const counts = {
      all: tasks.length,
      today: tasks.filter(task => !task.completed && task.dueDate === todayKey()).length,
      upcoming: tasks.filter(task => !task.completed && task.dueDate > todayKey()).length,
      overdue: tasks.filter(isOverdue).length,
      completed: tasks.filter(task => task.completed).length
    };
    document.querySelectorAll("#todo-filters [data-filter]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.filter === filter));
      button.querySelector("span").textContent = String(counts[button.dataset.filter]);
    });
  }

  function render() {
    updateOverview();
    updateFilterCounts();
    const query = searchInput.value.trim().toLocaleLowerCase();
    const visible = sortTasks(tasks.filter(task => {
      if (!matchesFilter(task)) return false;
      return !query || `${task.title} ${task.notes} ${task.category}`.toLocaleLowerCase().includes(query);
    }));

    list.replaceChildren(...visible.map(makeTaskElement));
    emptyState.hidden = visible.length > 0;
    const emptyTitle = document.getElementById("todo-empty-title");
    const emptyCopy = document.getElementById("todo-empty-copy");
    if (query) {
      emptyTitle.textContent = "No matching tasks";
      emptyCopy.textContent = "Try a different search or clear the search field.";
    } else if (filter === "today") {
      emptyTitle.textContent = "Nothing due today";
      emptyCopy.textContent = "Enjoy the breathing room or add a task with today’s date.";
    } else if (filter === "upcoming") {
      emptyTitle.textContent = "No upcoming tasks";
      emptyCopy.textContent = "Tasks with a future due date will show here.";
    } else if (filter === "overdue") {
      emptyTitle.textContent = "You’re all caught up";
      emptyCopy.textContent = "There are no overdue tasks right now.";
    } else if (filter === "completed") {
      emptyTitle.textContent = "No completed tasks yet";
      emptyCopy.textContent = "Completed tasks will collect here.";
    } else {
      emptyTitle.textContent = "Nothing on your list yet";
      emptyCopy.textContent = "Add a task to get started.";
    }
    document.getElementById("todo-count").textContent = `Showing ${visible.length} of ${tasks.length} task${tasks.length === 1 ? "" : "s"}`;
  }

  function resetForm() {
    form.reset();
    document.getElementById("todo-edit-id").value = "";
    document.getElementById("todo-form-heading").textContent = "Add a task";
    document.getElementById("todo-save").textContent = "Add task";
    document.getElementById("todo-cancel-edit").hidden = true;
  }

  function editTask(task) {
    document.getElementById("todo-edit-id").value = task.id;
    document.getElementById("todo-title").value = task.title;
    document.getElementById("todo-notes").value = task.notes;
    document.getElementById("todo-due").value = task.dueDate;
    document.getElementById("todo-priority").value = task.priority;
    document.getElementById("todo-category").value = task.category;
    document.getElementById("todo-form-heading").textContent = "Edit task";
    document.getElementById("todo-save").textContent = "Save changes";
    document.getElementById("todo-cancel-edit").hidden = false;
    form.hidden = false;
    document.getElementById("todo-form-toggle").textContent = "Hide";
    document.getElementById("todo-form-toggle").setAttribute("aria-expanded", "true");
    document.getElementById("todo-title").focus();
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), tasks }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mohaktools-tasks-${todayKey()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = "Backup downloaded.";
  }

  async function importBackup(file) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const imported = Array.isArray(parsed) ? parsed : parsed.tasks;
      if (!Array.isArray(imported)) throw new Error("This file does not contain a task list.");
      const normalized = imported.map(normalizeTask).filter(Boolean);
      if (!window.confirm(`Replace your current ${tasks.length} task${tasks.length === 1 ? "" : "s"} with ${normalized.length} from this backup?`)) return;
      tasks = normalized;
      saveTasks();
      resetForm();
      render();
      status.textContent = `Restored ${tasks.length} task${tasks.length === 1 ? "" : "s"}.`;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Could not read that backup file.";
    }
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    const title = document.getElementById("todo-title").value.trim();
    if (!title) return;
    const editId = document.getElementById("todo-edit-id").value;
    const values = {
      title: title.slice(0, 160),
      notes: document.getElementById("todo-notes").value.trim().slice(0, 1000),
      dueDate: document.getElementById("todo-due").value,
      priority: document.getElementById("todo-priority").value,
      category: document.getElementById("todo-category").value
    };

    if (editId) {
      const task = tasks.find(item => item.id === editId);
      if (!task) return;
      Object.assign(task, values);
      status.textContent = "Task updated.";
    } else {
      tasks.push({ id: makeId(), ...values, completed: false, createdAt: new Date().toISOString() });
      status.textContent = "Task added.";
    }
    saveTasks();
    resetForm();
    render();
    document.getElementById("todo-title").focus();
  });

  list.addEventListener("change", event => {
    const checkbox = event.target.closest('input[data-action="toggle"]');
    if (!checkbox) return;
    const task = tasks.find(item => item.id === checkbox.dataset.taskId);
    if (!task) return;
    task.completed = checkbox.checked;
    saveTasks();
    render();
    status.textContent = task.completed ? "Task completed." : "Task reopened.";
  });

  list.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const task = tasks.find(item => item.id === button.dataset.taskId);
    if (!task) return;
    if (button.dataset.action === "edit") {
      editTask(task);
    } else if (button.dataset.action === "delete" && window.confirm(`Delete “${task.title}”?`)) {
      tasks = tasks.filter(item => item.id !== task.id);
      saveTasks();
      render();
      status.textContent = "Task deleted.";
    }
  });

  document.getElementById("todo-filters").addEventListener("click", event => {
    const button = event.target.closest("button[data-filter]");
    if (!button) return;
    filter = button.dataset.filter;
    render();
  });
  searchInput.addEventListener("input", render);
  sortInput.addEventListener("change", render);
  document.getElementById("todo-cancel-edit").addEventListener("click", resetForm);
  document.getElementById("todo-clear-completed").addEventListener("click", () => {
    const completedCount = tasks.filter(task => task.completed).length;
    if (!completedCount || !window.confirm(`Permanently clear ${completedCount} completed task${completedCount === 1 ? "" : "s"}?`)) return;
    tasks = tasks.filter(task => !task.completed);
    saveTasks();
    render();
    status.textContent = "Completed tasks cleared.";
  });
  document.getElementById("todo-export").addEventListener("click", exportBackup);
  document.getElementById("todo-import-file").addEventListener("change", event => {
    importBackup(event.target.files[0]);
    event.target.value = "";
  });
  document.getElementById("todo-form-toggle").addEventListener("click", event => {
    form.hidden = !form.hidden;
    event.currentTarget.textContent = form.hidden ? "Show" : "Hide";
    event.currentTarget.setAttribute("aria-expanded", String(!form.hidden));
    if (!form.hidden) document.getElementById("todo-title").focus();
  });

  render();
})();
