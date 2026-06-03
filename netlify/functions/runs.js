const { randomUUID } = require("crypto");

const DEFAULT_PATH = "data/runs.json";

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
    },
    body: JSON.stringify(body)
  };
}

function getConfig() {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  const branch = process.env.GITHUB_BRANCH || "main";
  const filePath = process.env.DATA_FILE_PATH || DEFAULT_PATH;

  if (!owner || !repo || !token) {
    return null;
  }

  return { owner, repo, token, branch, filePath };
}

function githubUrl(config) {
  const filePath = encodeURIComponent(config.filePath).replace(/%2F/g, "/");
  return `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${filePath}`;
}

async function githubRequest(config, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${config.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "kilometros-en-equipo",
      ...(options.headers || {})
    }
  });

  if (response.status === 404) {
    return { status: 404, data: null };
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.message || `GitHub respondio con ${response.status}`;
    throw new Error(message);
  }

  return { status: response.status, data };
}

function decodeBase64(value) {
  return Buffer.from(value || "", "base64").toString("utf8");
}

function encodeBase64(value) {
  return Buffer.from(value, "utf8").toString("base64");
}

function sanitizeRuns(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((run) => ({
      id: String(run.id || ""),
      date: String(run.date || ""),
      distanceKm: Number(run.distanceKm),
      durationMinutes: Number(run.durationMinutes || 0),
      circuit: run.circuit === "montana" ? "montana" : "calle",
      note: String(run.note || "").slice(0, 90),
      createdAt: String(run.createdAt || "")
    }))
    .filter((run) => run.id && /^\d{4}-\d{2}-\d{2}$/.test(run.date) && Number.isFinite(run.distanceKm));
}

async function readRuns(config) {
  const url = `${githubUrl(config)}?ref=${encodeURIComponent(config.branch)}`;
  const { status, data } = await githubRequest(config, url);

  if (status === 404) {
    return { runs: [], sha: null };
  }

  const text = decodeBase64(data.content);
  const parsed = JSON.parse(text || "[]");
  return { runs: sanitizeRuns(parsed), sha: data.sha };
}

async function writeRuns(config, runs, sha) {
  const body = {
    message: "Guardar salidas familiares",
    content: encodeBase64(`${JSON.stringify(runs, null, 2)}\n`),
    branch: config.branch
  };

  if (sha) body.sha = sha;

  await githubRequest(config, githubUrl(config), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

function validateRun(payload) {
  const date = String(payload.date || "");
  const distanceKm = Number(payload.distanceKm);
  const durationMinutes = Number(payload.durationMinutes);
  const circuit = payload.circuit === "montana" ? "montana" : payload.circuit === "calle" ? "calle" : "";
  const note = String(payload.note || "").trim().slice(0, 90);
  const id = String(payload.id || randomUUID());
  const createdAt = String(payload.createdAt || new Date().toISOString());

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: "La fecha no tiene un formato valido." };
  }

  if (!Number.isFinite(distanceKm) || distanceKm <= 0 || distanceKm > 300) {
    return { error: "La distancia tiene que estar entre 0 y 300 km." };
  }

  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0 || durationMinutes > 1440) {
    return { error: "El tiempo tiene que estar entre 1 y 1440 minutos." };
  }

  if (!circuit) {
    return { error: "El circuito tiene que ser montana o calle." };
  }

  return {
    run: {
      id,
      date,
      distanceKm: Math.round(distanceKm * 10) / 10,
      durationMinutes: Math.round(durationMinutes),
      circuit,
      note,
      createdAt
    }
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return json(204, {});
  }

  const config = getConfig();
  if (!config) {
    return json(503, {
      message: "Faltan variables de entorno de GitHub en Netlify."
    });
  }

  try {
    if (event.httpMethod === "GET") {
      const { runs } = await readRuns(config);
      return json(200, { runs });
    }

    if (event.httpMethod === "POST") {
      const payload = JSON.parse(event.body || "{}");
      const result = validateRun(payload);

      if (result.error) {
        return json(400, { message: result.error });
      }

      const { runs, sha } = await readRuns(config);
      const withoutDuplicate = runs.filter((run) => run.id !== result.run.id);
      const nextRuns = [result.run, ...withoutDuplicate];

      await writeRuns(config, nextRuns, sha);
      return json(201, { runs: nextRuns });
    }

    return json(405, { message: "Metodo no permitido." });
  } catch (error) {
    return json(500, {
      message: error.message || "No se pudo completar la operacion."
    });
  }
};
