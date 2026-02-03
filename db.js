const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dbPath = path.join(__dirname, "data", "registry.db");

function ensureDbDir() {
  const fs = require("fs");
  const dir = path.join(__dirname, "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

ensureDbDir();
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS employees (
      employee_id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      job_title TEXT,
      department TEXT,
      employment_type TEXT,
      hire_date TEXT,
      status TEXT DEFAULT 'Active',
      phone TEXT,
      email TEXT,
      home_address TEXT,
      dob TEXT,
      emergency_contact_name TEXT,
      emergency_contact_phone TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS drivers (
      employee_id TEXT PRIMARY KEY,
      license_number TEXT,
      license_state TEXT,
      license_expiry TEXT,
      medical_card_expiry TEXT,
      drug_alcohol_status TEXT,
      assigned_vehicle TEXT,
      route_type TEXT,
      notes TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS documents (
      employee_id TEXT PRIMARY KEY,
      employment_agreement TEXT,
      w4 TEXT,
      i9 TEXT,
      government_id_copy TEXT,
      driver_license_copy TEXT,
      medical_card TEXT,
      nda TEXT,
      insurance_ack TEXT,
      background_check TEXT,
      notes TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
    )
  `);
});

module.exports = db;
