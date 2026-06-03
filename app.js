const form = document.querySelector("#run-form");
const dateInput = document.querySelector("#date");
const statusPill = document.querySelector("#sync-status");
const list = document.querySelector("#run-list");
const emptyState = document.querySelector("#empty-state");
const totalDistance = document.querySelector("#total-distance");
const totalRuns = document.querySelector("#total-runs");
const favoriteCircuit = document.querySelector("#favorite-circuit");
const filterTabs = Array.from(document.querySelectorAll(".filter-tab"));

const API_URL = "/api/runs";
const LOCAL_KEY = "kilometros-en-equipo:runs";
let runs = [];
let activeFilter = "todos";

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

function render() {
  const sorted = sortRuns(runs);
  const filtered = activeFilter === "todos" ? sorted : sorted.filter((run) => run.circuit === activeFilter);
  const total = runs.reduce((sum, run) => sum + Number(run.distanceKm || 0), 0);
  const mountainCount = runs.filter((run) => run.circuit === "montana").length;
  const streetCount = runs.filter((run) => run.circuit === "calle").length;

  totalDistance.textContent = formatKm(total);
  totalRuns.textContent = String(runs.length);
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
    note.textContent = run.note ? run.note : "Salida registrada en equipo";

    const distance = document.createElement("div");
    distance.className = "run-distance";
    distance.textContent = formatKm(run.distanceKm);

    main.append(title, note);
    item.append(badge, main, distance);
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

  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    showToast("La distancia tiene que ser mayor a cero.");
    return;
  }

  const run = {
    id: crypto.randomUUID(),
    date: String(data.get("date")),
    distanceKm: Math.round(distanceKm * 10) / 10,
    circuit: normalizeCircuit(String(data.get("circuit"))),
    note: String(data.get("note") || "").trim(),
    createdAt: new Date().toISOString()
  };

  const optimisticRuns = [run, ...runs];
  runs = optimisticRuns;
  saveLocal(runs);
  render();
  form.reset();
  dateInput.valueAsDate = new Date();
  setStatus("Guardando...");

  try {
    const result = await createRun(run);
    runs = result.runs || optimisticRuns;
    saveLocal(runs);
    setStatus("Sincronizado");
    showToast("Salida guardada para todos.");
    render();
  } catch (error) {
    setStatus("Pendiente local", "error");
    showToast("Quedo guardada en este dispositivo. Falta sincronizar GitHub.");
  }
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
