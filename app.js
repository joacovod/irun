const form = document.querySelector("#run-form");
const dateInput = document.querySelector("#date");
const distanceInput = document.querySelector("#distance");
const durationInput = document.querySelector("#duration");
const noteInput = document.querySelector("#note");
const saveButton = document.querySelector("#save-button");
const cancelEditButton = document.querySelector("#cancel-edit");
const statusPill = document.querySelector("#sync-status");
const list = document.querySelector("#run-list");
const emptyState = document.querySelector("#empty-state");
const totalDistance = document.querySelector("#total-distance");
const totalRuns = document.querySelector("#total-runs");
const favoriteCircuit = document.querySelector("#favorite-circuit");
const averagePace = document.querySelector("#average-pace");
const filterTabs = Array.from(document.querySelectorAll(".filter-tab"));

const API_URL = "/api/runs";
const LOCAL_KEY = "kilometros-en-equipo:runs";
let runs = [];
let activeFilter = "todos";
let editingRunId = null;

dateInput.valueAsDate = new Date();

function normalizeCircuit(circuit) {
  return circuit === "montana" ? "montana" : "calle";
}

function circuitLabel(circuit) {
  return normalizeCircuit(circuit) === "montana" ? "Montana" : "Calle";
}

function circuitIcon(circuit) {
  return normalizeCircuit(circuit) === "montana" ? "M" : "C";
}

function formatDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(year, month - 1, day));
}

function formatKm(value) {
  const number = Number(value) || 0;
  return `${number.toLocaleString("es-AR", { maximumFractionDigits: 1 })} km`;
}

function formatMinutes(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? `${Math.round(number)} min` : "Sin tiempo";
}

function formatPace(minutes, kilometers) {
  const duration = Number(minutes);
  const distance = Number(kilometers);

  if (!Number.isFinite(duration) || !Number.isFinite(distance) || duration <= 0 || distance <= 0) {
    return "-";
  }

  const pace = duration / distance;
  const wholeMinutes = Math.floor(pace);
  const seconds = Math.round((pace - wholeMinutes) * 60);
  const adjustedMinutes = seconds === 60 ? wholeMinutes + 1 : wholeMinutes;
  const adjustedSeconds = seconds === 60 ? 0 : seconds;

  return `${adjustedMinutes}:${String(adjustedSeconds).padStart(2, "0")} min/km`;
}

function setStatus(text, type = "ok") {
  statusPill.textContent = text;
  statusPill.classList.toggle("error", type === "error");
}

function showToast(message) {
  const previous = document.querySelector(".toast");
  if (previous) previous.remove();

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), 2600);
}

function saveLocal(nextRuns) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(nextRuns));
}

function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
  } catch {
    return [];
  }
}

function sortRuns(items) {
  return [...items].sort((a, b) => {
    if (a.date === b.date) return (b.createdAt || "").localeCompare(a.createdAt || "");
    return b.date.localeCompare(a.date);
  });
}

function resetFormMode() {
  editingRunId = null;
  form.reset();
  dateInput.valueAsDate = new Date();
  saveButton.innerHTML = '<span aria-hidden="true">+</span>Guardar salida';
  cancelEditButton.classList.add("hidden");
}

function startEdit(runId) {
  const run = runs.find((item) => item.id === runId);
  if (!run) return;

  editingRunId = run.id;
  dateInput.value = run.date;
  distanceInput.value = run.distanceKm;
  durationInput.value = Number(run.durationMinutes) > 0 ? run.durationMinutes : "";
  noteInput.value = run.note || "";

  const circuitInput = form.querySelector(`input[name="circuit"][value="${run.circuit}"]`);
  if (circuitInput) circuitInput.checked = true;

  saveButton.innerHTML = '<span aria-hidden="true">*</span>Guardar cambios';
  cancelEditButton.classList.remove("hidden");
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  distanceInput.focus();
}

function render() {
  const sorted = sortRuns(runs);
  const filtered = activeFilter === "todos" ? sorted : sorted.filter((run) => run.circuit === activeFilter);
  const total = runs.reduce((sum, run) => sum + Number(run.distanceKm || 0), 0);
  const timedRuns = runs.filter((run) => Number(run.durationMinutes) > 0 && Number(run.distanceKm) > 0);
  const timedDistance = timedRuns.reduce((sum, run) => sum + Number(run.distanceKm || 0), 0);
  const totalMinutes = timedRuns.reduce((sum, run) => sum + Number(run.durationMinutes || 0), 0);
  const mountainCount = runs.filter((run) => run.circuit === "montana").length;
  const streetCount = runs.filter((run) => run.circuit === "calle").length;

  totalDistance.textContent = formatKm(total);
  totalRuns.textContent = String(runs.length);
  averagePace.textContent = formatPace(totalMinutes, timedDistance);
  favoriteCircuit.textContent = mountainCount === streetCount
    ? runs.length ? "Empate" : "-"
    : mountainCount > streetCount ? "Montana" : "Calle";

  list.replaceChildren();
  emptyState.classList.toggle("hidden", filtered.length > 0);

  filtered.forEach((run) => {
    const item = document.createElement("li");
    item.className = "run-item";
    item.dataset.circuit = run.circuit;

    const badge = document.createElement("div");
    badge.className = "run-badge";
    badge.textContent = circuitIcon(run.circuit);

    const main = document.createElement("div");
    main.className = "run-main";

    const title = document.createElement("strong");
    title.textContent = `${circuitLabel(run.circuit)} - ${formatDate(run.date)}`;

    const note = document.createElement("span");
    const details = [formatMinutes(run.durationMinutes), formatPace(run.durationMinutes, run.distanceKm)]
      .filter((detail) => detail !== "-")
      .join(" - ");
    note.textContent = run.note ? `${run.note} - ${details}` : details;

    const distance = document.createElement("div");
    distance.className = "run-distance";
    distance.textContent = formatKm(run.distanceKm);

    const actions = document.createElement("div");
    actions.className = "run-actions";

    const editButton = document.createElement("button");
    editButton.className = "edit-button";
    editButton.type = "button";
    editButton.textContent = "Editar";
    editButton.addEventListener("click", () => startEdit(run.id));

    actions.append(distance, editButton);
    main.append(title, note);
    item.append(badge, main, actions);
    list.append(item);
  });
}

async function fetchRuns() {
  const response = await fetch(API_URL);
  if (!response.ok) throw new Error("No se pudieron leer las salidas");
  return response.json();
}

async function createRun(run) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(run)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "No se pudo guardar");
  }

  return response.json();
}

async function updateRun(run) {
  const response = await fetch(API_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(run)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "No se pudo actualizar");
  }

  return response.json();
}

async function init() {
  runs = loadLocal();
  render();

  try {
    const remoteRuns = await fetchRuns();
    runs = remoteRuns.runs || [];
    saveLocal(runs);
    setStatus("Sincronizado");
    render();
  } catch {
    setStatus("Modo local", "error");
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const data = new FormData(form);
  const distanceKm = Number(String(data.get("distance")).replace(",", "."));
  const durationMinutes = Number(String(data.get("duration")).replace(",", "."));

  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    showToast("La distancia tiene que ser mayor a cero.");
    return;
  }

  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    showToast("El tiempo tiene que ser mayor a cero.");
    return;
  }

  const run = {
    id: editingRunId || crypto.randomUUID(),
    date: String(data.get("date")),
    distanceKm: Math.round(distanceKm * 10) / 10,
    durationMinutes: Math.round(durationMinutes),
    circuit: normalizeCircuit(String(data.get("circuit"))),
    note: String(data.get("note") || "").trim(),
    createdAt: runs.find((item) => item.id === editingRunId)?.createdAt || new Date().toISOString(),
    updatedAt: editingRunId ? new Date().toISOString() : undefined
  };

  const isEditing = Boolean(editingRunId);
  const optimisticRuns = isEditing
    ? runs.map((item) => item.id === run.id ? run : item)
    : [run, ...runs];
  runs = optimisticRuns;
  saveLocal(runs);
  render();
  resetFormMode();
  setStatus(isEditing ? "Actualizando..." : "Guardando...");

  try {
    const result = isEditing ? await updateRun(run) : await createRun(run);
    runs = result.runs || optimisticRuns;
    saveLocal(runs);
    setStatus("Sincronizado");
    showToast(isEditing ? "Salida actualizada para todos." : "Salida guardada para todos.");
    render();
  } catch (error) {
    setStatus("Pendiente local", "error");
    showToast(isEditing ? "El cambio quedo en este dispositivo. Falta sincronizar GitHub." : "Quedo guardada en este dispositivo. Falta sincronizar GitHub.");
  }
});

cancelEditButton.addEventListener("click", () => {
  resetFormMode();
  showToast("Edicion cancelada.");
});

filterTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    activeFilter = tab.dataset.filter;
    filterTabs.forEach((item) => item.classList.toggle("active", item === tab));
    render();
  });
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

init();
