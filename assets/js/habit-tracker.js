(() => {
  "use strict";

  const STORAGE_KEY = "mt-habits";
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const LONG_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const habitList = document.getElementById("habit-list");
  const emptyState = document.getElementById("habit-empty");
  const form = document.getElementById("habit-form");
  const nameInput = document.getElementById("habit-name");
  const scheduleInput = document.getElementById("habit-schedule");
  const customDays = document.getElementById("habit-custom-days");
  const status = document.getElementById("habit-status");
  let weekOffset = 0;
  let habits = loadHabits();

  function localDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseDateKey(key) {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function addDays(date, count) {
    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    result.setDate(result.getDate() + count);
    return result;
  }

  function todayKey() {
    return localDateKey(new Date());
  }

  function weekStart(date) {
    const mondayOffset = (date.getDay() + 6) % 7;
    return addDays(date, -mondayOffset);
  }

  function makeId() {
    return window.crypto?.randomUUID?.() || `habit-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeHabit(item) {
    if (!item || typeof item.name !== "string" || !item.name.trim()) return null;
    const schedule = typeof item.schedule === "object" && item.schedule ? item.schedule : { type: "daily" };
    const type = ["daily", "weekdays", "custom"].includes(schedule.type) ? schedule.type : "daily";
    const days = Array.isArray(schedule.days)
      ? [...new Set(schedule.days.map(Number).filter(day => Number.isInteger(day) && day >= 0 && day <= 6))]
      : [1, 2, 3, 4, 5];
    return {
      id: String(item.id || makeId()),
      name: item.name.trim().slice(0, 60),
      schedule: { type, days },
      createdAt: /^\d{4}-\d{2}-\d{2}$/.test(item.createdAt || "") ? item.createdAt : todayKey(),
      completions: item.completions && typeof item.completions === "object"
        ? item.completions
        : item.done && typeof item.done === "object" ? item.done : {}
    };
  }

  function loadHabits() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(saved) ? saved.map(normalizeHabit).filter(Boolean) : [];
    } catch (_) {
      return [];
    }
  }

  function saveHabits() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
      return true;
    } catch (_) {
      status.textContent = "Could not save changes. Your browser storage may be full or unavailable.";
      return false;
    }
  }

  function isScheduled(habit, date) {
    const weekday = date.getDay();
    if (habit.schedule.type === "daily") return true;
    if (habit.schedule.type === "weekdays") return weekday >= 1 && weekday <= 5;
    return habit.schedule.days.includes(weekday);
  }

  function scheduleLabel(habit) {
    if (habit.schedule.type === "daily") return "Every day";
    if (habit.schedule.type === "weekdays") return "Weekdays";
    return habit.schedule.days.length
      ? habit.schedule.days.map(day => DAY_NAMES[day]).join(" · ")
      : "No days selected";
  }

  function currentStreak(habit) {
    let cursor = parseDateKey(todayKey());
    if (isScheduled(habit, cursor) && !habit.completions[localDateKey(cursor)]) cursor = addDays(cursor, -1);
    let streak = 0;
    for (let checked = 0; checked < 3660 && localDateKey(cursor) >= habit.createdAt; checked += 1) {
      const key = localDateKey(cursor);
      if (isScheduled(habit, cursor)) {
        if (!habit.completions[key]) break;
        streak += 1;
      }
      cursor = addDays(cursor, -1);
    }
    return streak;
  }

  function bestStreak(habit) {
    let cursor = parseDateKey(habit.createdAt);
    const today = parseDateKey(todayKey());
    let run = 0;
    let best = 0;
    for (let checked = 0; checked < 3660 && cursor <= today; checked += 1) {
      const key = localDateKey(cursor);
      if (isScheduled(habit, cursor)) {
        run = habit.completions[key] ? run + 1 : 0;
        best = Math.max(best, run);
      }
      cursor = addDays(cursor, 1);
    }
    return best;
  }

  function weekDates() {
    const thisMonday = weekStart(parseDateKey(todayKey()));
    return Array.from({ length: 7 }, (_, index) => addDays(thisMonday, weekOffset * 7 + index));
  }

  function formatShortDate(date) {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
  }

  function updateWeekLabel(dates) {
    const first = dates[0];
    const last = dates[6];
    const sameYear = first.getFullYear() === last.getFullYear();
    const firstText = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) }).format(first);
    const lastText = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(last);
    document.getElementById("habit-week-label").textContent = `${firstText} – ${lastText}`;
  }

  function renderStats(dates) {
    const today = parseDateKey(todayKey());
    const dueToday = habits.filter(habit => isScheduled(habit, today));
    const doneToday = dueToday.filter(habit => habit.completions[todayKey()]).length;
    let scheduledCount = 0;
    let completedCount = 0;

    dates.forEach(date => {
      if (date > today) return;
      habits.forEach(habit => {
        if (date < parseDateKey(habit.createdAt) || !isScheduled(habit, date)) return;
        scheduledCount += 1;
        if (habit.completions[localDateKey(date)]) completedCount += 1;
      });
    });

    const best = habits.reduce((value, habit) => Math.max(value, bestStreak(habit)), 0);
    document.getElementById("habit-stat-total").textContent = String(habits.length);
    document.getElementById("habit-stat-done").textContent = `${doneToday} / ${dueToday.length}`;
    document.getElementById("habit-stat-week").textContent = `${scheduledCount ? Math.round(completedCount / scheduledCount * 100) : 0}%`;
    document.getElementById("habit-stat-streak").textContent = `${best} ${best === 1 ? "day" : "days"}`;
  }

  function makeDayButton(habit, date) {
    const key = localDateKey(date);
    const done = Boolean(habit.completions[key]);
    const scheduled = isScheduled(habit, date);
    const future = date > parseDateKey(todayKey());
    const beforeStart = key < habit.createdAt;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `interactive-day${done ? " is-done" : ""}${key === todayKey() ? " is-today" : ""}`;
    button.dataset.action = "toggle-day";
    button.dataset.habitId = habit.id;
    button.dataset.date = key;
    button.textContent = done ? "✓" : "·";
    button.disabled = !scheduled || future || beforeStart;
    button.setAttribute("aria-pressed", String(done));
    button.setAttribute("aria-label", `${LONG_DAY_NAMES[date.getDay()]}, ${formatShortDate(date)}: ${done ? "completed" : scheduled ? "not completed" : "rest day"}`);
    button.title = !scheduled ? "Rest day" : future ? "Future day" : done ? "Mark as not done" : "Mark as done";
    return button;
  }

  function render() {
    const dates = weekDates();
    updateWeekLabel(dates);
    renderStats(dates);
    habitList.replaceChildren();
    emptyState.hidden = habits.length > 0;

    habits.forEach(habit => {
      const row = document.createElement("article");
      row.className = "habit-row";

      const main = document.createElement("div");
      main.className = "habit-row-main";
      const todayButton = document.createElement("button");
      todayButton.type = "button";
      todayButton.className = `habit-check-today${habit.completions[todayKey()] ? " is-done" : ""}`;
      todayButton.dataset.action = "today";
      todayButton.dataset.habitId = habit.id;
      todayButton.textContent = habit.completions[todayKey()] ? "✓" : "＋";
      todayButton.setAttribute("aria-label", `${habit.completions[todayKey()] ? "Undo" : "Complete"} ${habit.name} for today`);
      main.appendChild(todayButton);

      const copy = document.createElement("div");
      copy.style.minWidth = "0";
      const name = document.createElement("div");
      name.className = "habit-name";
      name.textContent = habit.name;
      const meta = document.createElement("div");
      meta.className = "habit-meta";
      meta.textContent = scheduleLabel(habit);
      copy.append(name, meta);
      main.appendChild(copy);

      const side = document.createElement("div");
      side.className = "habit-row-side";
      const streak = document.createElement("div");
      streak.className = "habit-streak";
      streak.textContent = `🔥 ${currentStreak(habit)} day streak`;
      side.appendChild(streak);
      const week = document.createElement("div");
      week.className = "habit-week";
      dates.forEach(date => {
        const day = document.createElement("div");
        day.className = "habit-day";
        const label = document.createElement("span");
        label.textContent = DAY_NAMES[date.getDay()];
        day.append(label, makeDayButton(habit, date));
        week.appendChild(day);
      });
      side.appendChild(week);
      row.append(main, side);

      const actions = document.createElement("div");
      actions.className = "habit-row-actions";
      actions.append(
        actionButton("Edit", "edit", habit.id),
        actionButton("Delete", "delete", habit.id, true)
      );
      row.appendChild(actions);
      habitList.appendChild(row);
    });
  }

  function actionButton(label, action, id, danger = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `interactive-button interactive-button-quiet${danger ? " interactive-button-danger" : ""}`;
    button.dataset.action = action;
    button.dataset.habitId = id;
    button.textContent = label;
    return button;
  }

  function updateScheduleChoices() {
    customDays.hidden = scheduleInput.value !== "custom";
  }

  function setStatus(message) {
    status.textContent = message;
  }

  function selectedCustomDays() {
    return Array.from(customDays.querySelectorAll("input:checked"), input => Number(input.value));
  }

  function resetForm() {
    form.reset();
    document.getElementById("habit-edit-id").value = "";
    document.getElementById("habit-form-heading").textContent = "Add a habit";
    document.getElementById("habit-save").textContent = "Add habit";
    document.getElementById("habit-cancel-edit").hidden = true;
    updateScheduleChoices();
    setStatus("");
  }

  function editHabit(habit) {
    document.getElementById("habit-edit-id").value = habit.id;
    nameInput.value = habit.name;
    scheduleInput.value = habit.schedule.type;
    customDays.querySelectorAll("input").forEach(input => {
      input.checked = habit.schedule.days.includes(Number(input.value));
    });
    updateScheduleChoices();
    document.getElementById("habit-form-heading").textContent = "Edit habit";
    document.getElementById("habit-save").textContent = "Save changes";
    document.getElementById("habit-cancel-edit").hidden = false;
    form.hidden = false;
    document.getElementById("habit-form-toggle").textContent = "Hide form";
    document.getElementById("habit-form-toggle").setAttribute("aria-expanded", "true");
    nameInput.focus();
  }

  function toggleCompletion(habit, dateKey) {
    const date = parseDateKey(dateKey);
    if (date > parseDateKey(todayKey()) || dateKey < habit.createdAt || !isScheduled(habit, date)) return;
    if (habit.completions[dateKey]) delete habit.completions[dateKey];
    else habit.completions[dateKey] = true;
    saveHabits();
    render();
    setStatus(`${habit.name} updated for ${formatShortDate(date)}.`);
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), habits }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mohaktools-habits-${todayKey()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus("Habit backup downloaded.");
  }

  async function importBackup(file) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const imported = Array.isArray(parsed) ? parsed : parsed.habits;
      if (!Array.isArray(imported)) throw new Error("This file does not contain a habit list.");
      const normalized = imported.map(normalizeHabit).filter(Boolean);
      if (!window.confirm(`Replace your current ${habits.length} habit${habits.length === 1 ? "" : "s"} with ${normalized.length} from this backup?`)) return;
      habits = normalized;
      saveHabits();
      resetForm();
      render();
      setStatus(`Restored ${habits.length} habit${habits.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not read that backup file.");
    }
  }

  function buildCustomDayOptions() {
    [1, 2, 3, 4, 5, 6, 0].forEach(dayNumber => {
      const label = document.createElement("label");
      label.className = "habit-schedule-day";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = String(dayNumber);
      input.defaultChecked = dayNumber >= 1 && dayNumber <= 5;
      input.checked = input.defaultChecked;
      const text = document.createElement("span");
      text.textContent = DAY_NAMES[dayNumber];
      label.append(input, text);
      customDays.appendChild(label);
    });
  }

  habitList.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const habit = habits.find(item => item.id === button.dataset.habitId);
    if (!habit) return;

    if (button.dataset.action === "today") {
      toggleCompletion(habit, todayKey());
    } else if (button.dataset.action === "toggle-day") {
      toggleCompletion(habit, button.dataset.date);
    } else if (button.dataset.action === "edit") {
      editHabit(habit);
    } else if (button.dataset.action === "delete" && window.confirm(`Delete “${habit.name}” and its history?`)) {
      habits = habits.filter(item => item.id !== habit.id);
      saveHabits();
      render();
      setStatus("Habit and its history deleted.");
    }
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!name) {
      setStatus("Enter a name for this habit.");
      nameInput.focus();
      return;
    }
    const type = scheduleInput.value;
    const days = type === "custom" ? selectedCustomDays() : type === "weekdays" ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6];
    if (!days.length) {
      setStatus("Choose at least one day for this habit.");
      return;
    }

    const editId = document.getElementById("habit-edit-id").value;
    if (editId) {
      const habit = habits.find(item => item.id === editId);
      if (!habit) return;
      habit.name = name.slice(0, 60);
      habit.schedule = { type, days };
      setStatus("Habit updated.");
    } else {
      habits.push({ id: makeId(), name: name.slice(0, 60), schedule: { type, days }, createdAt: todayKey(), completions: {} });
      setStatus("Habit added. Small, repeatable steps add up.");
    }
    saveHabits();
    resetForm();
    render();
    nameInput.focus();
  });

  scheduleInput.addEventListener("change", updateScheduleChoices);
  document.getElementById("habit-cancel-edit").addEventListener("click", resetForm);
  document.getElementById("habit-prev-week").addEventListener("click", () => { weekOffset -= 1; render(); });
  document.getElementById("habit-next-week").addEventListener("click", () => {
    if (weekOffset < 0) weekOffset += 1;
    render();
  });
  document.getElementById("habit-this-week").addEventListener("click", () => { weekOffset = 0; render(); });
  document.getElementById("habit-export").addEventListener("click", exportBackup);
  document.getElementById("habit-import-file").addEventListener("change", event => {
    importBackup(event.target.files[0]);
    event.target.value = "";
  });
  document.getElementById("habit-form-toggle").addEventListener("click", event => {
    form.hidden = !form.hidden;
    event.currentTarget.textContent = form.hidden ? "Add a habit" : "Hide form";
    event.currentTarget.setAttribute("aria-expanded", String(!form.hidden));
    if (!form.hidden) nameInput.focus();
  });

  buildCustomDayOptions();
  updateScheduleChoices();
  render();
})();
