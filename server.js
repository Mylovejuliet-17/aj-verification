 const express = require("express");
 const helmet = require("helmet");
 const cors = require("cors");

 const db = require("./db");
 const { dbAll, dbRun } = db;


// --- TEMP seed employee (so /verify works) ---



// const webhook = require('./services/webhook');


const app = express();
app.use(helmet({ contentSecurityPolicy: false })); // allow inline admin UI for simplicity
app.use(cors());
app.use(express.json({ limit: "2mb" }));
// app.use('/webhook', webhook);

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const BASE_VERIFY_URL = (process.env.BASE_VERIFY_URL || "https://YOUR-DOMAIN/verify").replace(/\/+$/, "");

// ---- Helpers ----
function normalizeEmployeeId(id) {
  return String(id || "").trim().toUpperCase();
}

function verifyUrlFor(id) {
  id = normalizeEmployeeId(id);
  return `${BASE_VERIFY_URL}/${encodeURIComponent(id)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function dbAll(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}
function dbGet(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
}
function dbRun(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

function safePublicEmployeeView(e) {
  if (!e) return null;
  return {
    employee_id: e.employee_id,
    full_name: e.full_name,
    job_title: e.job_title,
    status: e.status,
    verified_at: nowIso()
  };
}

// ---- API ----
app.get("/api/health", (req, res) => res.json({ ok: true }));

app.post("/api/employees", async (req, res) => {
  try {
    const data = req.body;

    // Auto-generate ID if not provided
    if (!data.employee_id) {
      data.employee_id = await generateEmployeeId(
        data.position || data.department || "EMP"
      );
    }

    const employee = await Employee.create(data);

    res.status(201).json({
  employee_id: employee.employee_id,
  verify_url: verifyUrlFor(employee.employee_id),
  employee
});

} catch (err) {
  console.error(err);
  res.status(500).json({ error: "Failed to create employee" });
}
});

 // =========================
// STEP 2: GET / UPDATE ROUTES
// =========================

// Get employee by ID (SQLite)
app.get("/api/employees/:id", async (req, res) => {
  try {
    const id = normalizeEmployeeId(req.params.id);

    const rows = await dbAll(
      "SELECT * FROM employees WHERE employee_id = ?",
      [id]
    );
    const employee = rows[0];

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
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch employee" });
  }
});

// Update employee by ID (SQLite)
app.put("/api/employees/:id", async (req, res) => {
  try {
    const id = normalizeEmployeeId(req.params.id);
    const p = req.body || {};

    // Build update fields safely
    const fields = [];
    const values = [];

    const allowed = [
      "full_name",
      "department",
      "position",
      "company",
      "photo_url",
      "status",
    ];

    for (const key of allowed) {
      if (p[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(p[key]);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    values.push(id);

    await dbRun(
      `UPDATE employees SET ${fields.join(", ")} WHERE employee_id = ?`,
      values
    );

    const rows = await dbAll(
      "SELECT * FROM employees WHERE employee_id = ?",
      [id]
    );
    const employee = rows[0];

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
    console.error(err);
    return res.status(500).json({ error: "Failed to update employee" });
  }
});


   // 👉 STEP 2: GET employee by ID (SQLite)
app.get("/api/employees/:id", async (req, res) => {
  try {
    const id = normalizeEmployeeId(req.params.id);

    const rows = await dbAll(
      "SELECT * FROM employees WHERE employee_id = ?",
      [id]
    );

    const employee = rows[0];

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
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch employee" });
  }
});




  

 
    
// ✅ LIST all employees
app.get("/api/employees", async (req, res) => {
  try {
    const rows = await dbAll(
      "SELECT * FROM employees ORDER BY employee_id ASC"
    );
    return res.json({ employees: rows });
  } catch (err) {
  console.error(err);
  return res.status(500).json({
    error: "Failed to list employees",
    detail: err.message || String(err)
  });
}

});

  // GET employee by ID (single source of truth)
app.get("/api/employees/:id", async (req, res) => {
  try {
    const id = normalizeEmployeeId(req.params.id);

    const rows = await dbAll(
      "SELECT * FROM employees WHERE employee_id = ?",
      [id]
    );
 const employee = rows[0];
if (!employee) {
 return res.status(404).json({ error: "Employee not found" });
}
res.json({
  employee: {
    ...employee,
     verify_url: verifyUrlFor(employee.employee_id),
  },
 });
 } catch (err) {
  console.error(err);
  res.status(500).json({ error: "Failed to fetch employee" });
 }
 });


 

// Fallback
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: "Server error",
    detail: String((err && err.message) || err),
  });
});

app.listen(PORT, () => {
  console.log(`Employee registry server running on http://localhost:${PORT}`);
  console.log(`Public verify base URL: ${BASE_VERIFY_URL}`);
});
