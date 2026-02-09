 const express = require("express");
 const helmet = require("helmet");
 const cors = require("cors");

 const db = require("./db");

// Promise wrapper for sqlite db.run
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}





const app = express();
app.use(express.json());
app.use(helmet({ contentSecurityPolicy: false })); // allow inline admin UI for simplicity
app.use(cors());
app.use(express.json({ limit: "2mb" }));
// app.use('/webhook', webhook);

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const BASE_VERIFY_URL = (process.env.BASE_VERIFY_URL || "https://YfOUR-DOMAIN/verify").replace(/\/+$/, "");

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



// ==== API ====
app.get("/api/health", (req, res) => res.json({ ok: true }));

// ---- API ----
app.get("/verify/:id", async (req, res) => {
  try {

    const id = normalizeEmployeeId(req.params.id);

    const employee = await sqlGet(
  "SELECT * FROM employees WHERE employee_id = ?",
  [id]
);
    if (!employee) {
      return res.status(404).send("Employee not found");
    }

    res.send(`
      <h2>Employment Verified ✅</h2>
      <p><b>ID:</b> ${employee.employee_id}</p>
      <p><b>Name:</b> ${employee.full_name}</p>
      <p><b>Position:</b> ${employee.position || ""}</p>
      <p><b>Department:</b> ${employee.department || ""}</p>
      <p><b>Company:</b> ${employee.company || ""}</p>
      <p><b>Status:</b> ${employee.status || ""}</p>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});


// ================================
 // CREATE EMPLOYEE (ADD HERE)
 // ================================
 // ===============================
// CREATE EMPLOYEE
// ===============================
app.post("/api/employees", async (req, res) => {
  try {
    const {
      employee_id,
      full_name,
      position,
      department,
      company,
      status
    } = req.body;

    if (!employee_id || !full_name) {
      return res.status(400).json({
        error: "employee_id and full_name required"
      });
    }

    const normalizedId = normalizeEmployeeId(employee_id);

    await dbRun(
      `INSERT INTO employees 
       (employee_id, full_name, position, department, company, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        normalizedId,
        full_name,
        position || "",
        department || "",
        company || "",
        status || "Active"
      ]
    );
    return res.status(201).json({
      ok: true,
      employee_id: normalizedId,
      verify_url: verifyUrlFor(normalizedId)
    });

  } catch (err) {
    console.error("CREATE EMPLOYEE ERROR:", err);
    return res.status(500).json({
      error: "Failed to add employee"
    });
  }
});





    

   // 👉 STEP 2: GET employee by ID (SQLite)
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
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch employee" });
  }
});




  

 
    


 

 

  
  // ============================
// DEBUG: LIST ALL EMPLOYEES
// ============================
app.get("/api/debug/employees", async (req, res) => {
  try {
    const rows = await sqlAll("SELECT * FROM employees");
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// ============================
// FALLBACK (ERROR HANDLER)
// ============================
app.use((err, req, res, next) => {
  console.error(err);
  return res.status(500).json({
    error: "Server error",
    detail: String((err && err.message) || err),
  });
});

// ============================
// START SERVER (ONLY ONCE)
// ============================
app.listen(PORT, () => {
  console.log(`Employee registry server running on http://localhost:${PORT}`);
  console.log(`Public verify base URL: ${BASE_VERIFY_URL}`);
});

