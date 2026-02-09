const express = require("express");
const cors = require("cors");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const app = express();

app.use(cors());
app.use(express.json());

// =========================
// CONFIG
// =========================
const PORT = process.env.PORT || 3000;

// IMPORTANT: put your real Render URL here if you want:
const BASE_VERIFY_URL =
  process.env.BASE_VERIFY_URL || "https://aj-verification-d4rh.onrender.com";

// =========================
// SQLITE SETUP
// =========================
const DB_PATH = path.join(__dirname, "data.sqlite");
const db = new sqlite3.Database(DB_PATH);

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function sqlGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function sqlAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function normalizeEmployeeId(id) {
  return String(id || "").trim().toUpperCase();
}

function verifyUrlFor(employeeId) {
  return `${BASE_VERIFY_URL}/verify/${encodeURIComponent(employeeId)}`;
}

// Create table if not exists
(async () => {
  await dbRun(`
    CREATE TABLE IF NOT EXISTS employees (
      employee_id TEXT PRIMARY KEY,
      full_name TEXT,
      position TEXT,
      department TEXT,
      company TEXT,
      status TEXT
    )
  `);
})().catch((e) => console.error("DB INIT ERROR:", e));

// =========================
// HEALTH CHECK
// =========================
app.get("/", (req, res) => {
  res.json({ ok: true });
});

// =========================
// STEP 1: CREATE EMPLOYEE
// =========================
app.post("/api/employees", async (req, res) => {
  try {
    const { employee_id, full_name, position, department, company, status } =
      req.body || {};

    const normalizedId = normalizeEmployeeId(employee_id);

    if (!normalizedId) {
      return res.status(400).json({ error: "employee_id is required" });
    }

    await dbRun(
      `
      INSERT OR REPLACE INTO employees
      (employee_id, full_name, position, department, company, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      [
        normalizedId,
        full_name || "",
        position || "",
        department || "",
        company || "",
        status || "Active",
      ]
    );

    return res.status(201).json({
      ok: true,
      employee_id: normalizedId,
      verify_url: verifyUrlFor(normalizedId),
    });
  } catch (err) {
    console.error("CREATE EMPLOYEE ERROR:", err);
    return res.status(500).json({
      error: "Failed to add employee",
      detail: err.message,
    });
  }
});

// =========================
// STEP 2: GET EMPLOYEE BY ID
// =========================
app.get("/api/employees/:id", async (req, res) => {
  try {
    const id = normalizeEmployeeId(req.params.id);

    const employee = await sqlGet(
      "SELECT * FROM employees WHERE employee_id = ?",
      [id]
    );

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    return res.json({
      employee: {
        ...employee,
        verify_url: verifyUrlFor(employee.employee_id),
      },
    });
  } catch (err) {
    console.error("GET EMPLOYEE ERROR:", err);
    return res.status(500).json({
      error: "Failed to fetch employee",
      detail: err.message,
    });
  }
});

// =========================
// DEBUG: LIST ALL EMPLOYEES
// =========================
app.get("/api/debug/employees", async (req, res) => {
  try {
    const rows = await sqlAll("SELECT * FROM employees");
    return res.json(rows);
  } catch (err) {
    console.error("DEBUG LIST ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
});

// =========================
// FALLBACK ERROR HANDLER
// =========================
app.use((err, req, res, next) => {
  console.error("UNHANDLED ERROR:", err);
  return res.status(500).json({
    error: "Server error",
    detail: String((err && err.message) || err),
  });
});

// =========================
// START SERVER (ONLY ONCE)
// =========================
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Verify base URL: ${BASE_VERIFY_URL}`);
});
