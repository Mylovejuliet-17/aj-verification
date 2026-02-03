require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const QRCode = require("qrcode");
const PDFDocument = require("pdfkit");

const db = require("./db");
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

app.get("/api/employees", async (req, res) => {
  const rows = await dbAll("SELECT * FROM employees ORDER BY employee_id ASC");
  res.json(rows.map(r => ({ ...r, verify_url: verifyUrlFor(r.employee_id) })));
});

app.get("/api/employees/:id", async (req, res) => {
  const id = normalizeEmployeeId(req.params.id);
  const e = await dbGet("SELECT * FROM employees WHERE employee_id = ?", [id]);
  if (!e) return res.status(404).json({ error: "Not found" });

  const d = await dbGet("SELECT * FROM drivers WHERE employee_id = ?", [id]);
  const docs = await dbGet("SELECT * FROM documents WHERE employee_id = ?", [id]);

  res.json({ employee: { ...e, verify_url: verifyUrlFor(id) }, driver: d || null, documents: docs || null });
});

app.post("/api/employees", async (req, res) => {
  employees.push({
  employee_id: "AJ-EMP-001",
  full_name: "Abraham Agyeman Badu",
  department: "CEO / Driver",
  company: "AJ Alpha Global Logistics LLC",
  status: "Active"
});
  const p = req.body || {};
  const employee_id = normalizeEmployeeId(p.employee_id);

  if (!employee_id || !p.full_name) return res.status(400).json({ error: "employee_id and full_name are required" });

  const status = p.status || "Active";

  await dbRun(`
    INSERT INTO employees (
      employee_id, full_name, job_title, department, employment_type, hire_date, status,
      phone, email, home_address, dob, emergency_contact_name, emergency_contact_phone, notes,
      created_at, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))
  `, [
    employee_id, p.full_name, p.job_title || "", p.department || "", p.employment_type || "", p.hire_date || "", status,
    p.phone || "", p.email || "", p.home_address || "", p.dob || "", p.emergency_contact_name || "", p.emergency_contact_phone || "", p.notes || ""
  ]);

  const created = await dbGet("SELECT * FROM employees WHERE employee_id = ?", [employee_id]);

  // optional webhook
  sendWebhookIfConfigured({ event: "employee.created", employee: created }, process.env);

  res.status(201).json({ ...created, verify_url: verifyUrlFor(employee_id) });
});

app.put("/api/employees/:id", async (req, res) => {
  const id = normalizeEmployeeId(req.params.id);
  const p = req.body || {};
  const exists = await dbGet("SELECT * FROM employees WHERE employee_id = ?", [id]);
  if (!exists) return res.status(404).json({ error: "Not found" });

  await dbRun(`
    UPDATE employees SET
      full_name = COALESCE(?, full_name),
      job_title = COALESCE(?, job_title),
      department = COALESCE(?, department),
      employment_type = COALESCE(?, employment_type),
      hire_date = COALESCE(?, hire_date),
      status = COALESCE(?, status),
      phone = COALESCE(?, phone),
      email = COALESCE(?, email),
      home_address = COALESCE(?, home_address),
      dob = COALESCE(?, dob),
      emergency_contact_name = COALESCE(?, emergency_contact_name),
      emergency_contact_phone = COALESCE(?, emergency_contact_phone),
      notes = COALESCE(?, notes),
      updated_at = datetime('now')
    WHERE employee_id = ?
  `, [
    p.full_name, p.job_title, p.department, p.employment_type, p.hire_date, p.status,
    p.phone, p.email, p.home_address, p.dob, p.emergency_contact_name, p.emergency_contact_phone,
    p.notes, id
  ]);

  const updated = await dbGet("SELECT * FROM employees WHERE employee_id = ?", [id]);
  sendWebhookIfConfigured({ event: "employee.updated", employee: updated }, process.env);

  res.json({ ...updated, verify_url: verifyUrlFor(id) });
});

app.delete("/api/employees/:id", async (req, res) => {
  const id = normalizeEmployeeId(req.params.id);
  const exists = await dbGet("SELECT * FROM employees WHERE employee_id = ?", [id]);
  if (!exists) return res.status(404).json({ error: "Not found" });

  await dbRun("DELETE FROM employees WHERE employee_id = ?", [id]);
  sendWebhookIfConfigured({ event: "employee.deleted", employee: exists }, process.env);

  res.json({ ok: true });
});

// Driver addendum
app.put("/api/employees/:id/driver", async (req, res) => {
  const id = normalizeEmployeeId(req.params.id);
  const p = req.body || {};
  const exists = await dbGet("SELECT * FROM employees WHERE employee_id = ?", [id]);
  if (!exists) return res.status(404).json({ error: "Employee not found" });

  await dbRun(`
    INSERT INTO drivers (employee_id, license_number, license_state, license_expiry, medical_card_expiry,
      drug_alcohol_status, assigned_vehicle, route_type, notes, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(employee_id) DO UPDATE SET
      license_number=excluded.license_number,
      license_state=excluded.license_state,
      license_expiry=excluded.license_expiry,
      medical_card_expiry=excluded.medical_card_expiry,
      drug_alcohol_status=excluded.drug_alcohol_status,
      assigned_vehicle=excluded.assigned_vehicle,
      route_type=excluded.route_type,
      notes=excluded.notes,
      updated_at=datetime('now')
  `, [
    id,
    p.license_number || "", p.license_state || "", p.license_expiry || "", p.medical_card_expiry || "",
    p.drug_alcohol_status || "", p.assigned_vehicle || "", p.route_type || "", p.notes || ""
  ]);

  const driver = await dbGet("SELECT * FROM drivers WHERE employee_id = ?", [id]);
  sendWebhookIfConfigured({ event: "employee.driver_updated", employee_id: id, driver }, process.env);

  res.json(driver);
});

// Documents checklist
app.put("/api/employees/:id/documents", async (req, res) => {
  const id = normalizeEmployeeId(req.params.id);
  const p = req.body || {};
  const exists = await dbGet("SELECT * FROM employees WHERE employee_id = ?", [id]);
  if (!exists) return res.status(404).json({ error: "Employee not found" });

  await dbRun(`
    INSERT INTO documents (
      employee_id, employment_agreement, w4, i9, government_id_copy, driver_license_copy,
      medical_card, nda, insurance_ack, background_check, notes, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(employee_id) DO UPDATE SET
      employment_agreement=excluded.employment_agreement,
      w4=excluded.w4,
      i9=excluded.i9,
      government_id_copy=excluded.government_id_copy,
      driver_license_copy=excluded.driver_license_copy,
      medical_card=excluded.medical_card,
      nda=excluded.nda,
      insurance_ack=excluded.insurance_ack,
      background_check=excluded.background_check,
      notes=excluded.notes,
      updated_at=datetime('now')
  `, [
    id,
    p.employment_agreement || "", p.w4 || "", p.i9 || "", p.government_id_copy || "", p.driver_license_copy || "",
    p.medical_card || "", p.nda || "", p.insurance_ack || "", p.background_check || "", p.notes || ""
  ]);

  const docs = await dbGet("SELECT * FROM documents WHERE employee_id = ?", [id]);
  sendWebhookIfConfigured({ event: "employee.documents_updated", employee_id: id, documents: docs }, process.env);

  res.json(docs);
});

// QR image
app.get("/api/employees/:id/qrcode.png", async (req, res) => {
  const id = normalizeEmployeeId(req.params.id);
  const e = await dbGet("SELECT * FROM employees WHERE employee_id = ?", [id]);
  if (!e) return res.status(404).send("Not found");

  const url = verifyUrlFor(id);
  res.type("png");
  QRCode.toFileStream(res, url, { margin: 1, scale: 6 });
});

// ID card PDF (single)
app.get("/api/employees/:id/idcard.pdf", async (req, res) => {
  const id = normalizeEmployeeId(req.params.id);
  const e = await dbGet("SELECT * FROM employees WHERE employee_id = ?", [id]);
  if (!e) return res.status(404).send("Not found");

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${id}_idcard.pdf"`);

  const doc = new PDFDocument({ size: [241, 151], margin: 10 }); // approx 3.35x2.1 inches @72dpi
  doc.pipe(res);

  // Header
  doc.rect(0, 0, doc.page.width, 34).fill("#1F4E79");
  doc.fillColor("white").font("Helvetica-Bold").fontSize(10).text("A&J ALPHA GLOBAL LOGISTICS LLC", 10, 12);

  // Body text
  doc.fillColor("#000000").font("Helvetica").fontSize(9);
  doc.text(`Name: ${e.full_name}`, 10, 44);
  doc.text(`Title: ${e.job_title || ""}`, 10, 62);
  doc.text(`Employee ID: ${e.employee_id}`, 10, 80);
  doc.text(`Status: ${e.status || ""}`, 10, 98);

  // QR code
  const url = verifyUrlFor(id);
  const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, scale: 6 });
  const img = qrDataUrl.replace(/^data:image\/png;base64,/, "");
  const buf = Buffer.from(img, "base64");
  doc.image(buf, doc.page.width - 88, 46, { fit: [72, 72] });

  doc.fillColor("#666666").fontSize(7).text("Scan to verify", 10, 126);
  doc.end();
});

// ID cards PDF (multiple on letter)
app.get("/api/idcards.pdf", async (req, res) => {
  const idsParam = (req.query.ids || "").toString();
  const ids = idsParam.split(",").map(normalizeEmployeeId).filter(Boolean);
  if (ids.length === 0) return res.status(400).send("Provide ids query param, e.g. ?ids=AJ-EMP-001,AJ-EMP-002");

  const employees = await dbAll(`SELECT * FROM employees WHERE employee_id IN (${ids.map(() => "?").join(",")}) ORDER BY employee_id`, ids);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "inline; filename=\"idcards.pdf\"");

  const doc = new PDFDocument({ size: "LETTER", margin: 36 });
  doc.pipe(res);

  doc.fillColor("#1F4E79").font("Helvetica-Bold").fontSize(14).text("Employee ID Cards", { align: "left" });
  doc.moveDown(0.5);

  const cardW = 241, cardH = 151, gapX = 18, gapY = 18;
  const startX = doc.page.margins.left;
  let x = startX, y = doc.y + 10;
  let col = 0, row = 0;

  for (const e of employees) {
    // new page if needed
    if (y + cardH > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      doc.fillColor("#1F4E79").font("Helvetica-Bold").fontSize(14).text("Employee ID Cards", { align: "left" });
      doc.moveDown(0.5);
      x = startX; y = doc.y + 10; col = 0; row = 0;
    }

    // Card border
    doc.save();
    doc.lineWidth(2).strokeColor("#1F4E79").rect(x, y, cardW, cardH).stroke();

    // Header bar
    doc.rect(x, y, cardW, 34).fill("#1F4E79");
    doc.fillColor("white").font("Helvetica-Bold").fontSize(10).text("A&J ALPHA GLOBAL LOGISTICS LLC", x+10, y+12, { width: cardW-20 });

    // Text
    doc.fillColor("#000000").font("Helvetica").fontSize(9);
    doc.text(`Name: ${e.full_name}`, x+10, y+44);
    doc.text(`Title: ${e.job_title || ""}`, x+10, y+62);
    doc.text(`Employee ID: ${e.employee_id}`, x+10, y+80);
    doc.text(`Status: ${e.status || ""}`, x+10, y+98);

    const url = verifyUrlFor(e.employee_id);
    const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, scale: 6 });
    const img = qrDataUrl.replace(/^data:image\/png;base64,/, "");
    const buf = Buffer.from(img, "base64");
    doc.image(buf, x + cardW - 88, y + 46, { fit: [72, 72] });

    doc.fillColor("#666666").fontSize(7).text("Scan to verify", x+10, y+126);
    doc.restore();

    // position
    col += 1;
    if (col >= 2) {
      col = 0;
      x = startX;
      y += cardH + gapY;
    } else {
      x += cardW + gapX;
    }
  }

  doc.end();
});

// ---- Public Verification Page ----
// This page should show only minimal info (name/title/id/status).
app.get("/verify/:id", async (req, res) => {
  const id = normalizeEmployeeId(req.params.id);
  const e = await dbGet("SELECT * FROM employees WHERE employee_id = ?", [id]);

  res.setHeader("Content-Type", "text/html; charset=utf-8");

  if (!e) {
    return res.status(404).send(`
      <html><head><title>Verification - Not Found</title>
      <style>body{font-family:system-ui,Arial;margin:40px} .badge{display:inline-block;padding:6px 10px;border-radius:8px;background:#eee}</style>
      </head><body>
        <h2>Employee Verification</h2>
        <p class="badge">NOT FOUND</p>
        <p>No employee record found for <b>${id}</b>.</p>
      </body></html>
    `);
  }

  const status = (e.status || "Active").toUpperCase();
  const color = status === "ACTIVE" ? "#1b7f3a" : (status === "ON LEAVE" ? "#a36a00" : "#b00020");

  const safe = safePublicEmployeeView(e);

  res.send(`
    <html>
      <head>
        <title>Employee Verification - ${safe.employee_id}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          body{font-family:system-ui,Arial;margin:40px;background:#f7f9fc}
          .card{max-width:680px;background:#fff;border:1px solid #e4e8f0;border-radius:14px;padding:22px;box-shadow:0 8px 20px rgba(0,0,0,.06)}
          .brand{color:#1F4E79;font-weight:800}
          .status{display:inline-block;padding:8px 12px;border-radius:999px;color:#fff;font-weight:700;background:${color}}
          .row{margin:10px 0}
          .muted{color:#667}
          .small{font-size:12px}
        </style>
      </head>
      <body>
        <div class="card">
          <div class="brand">A&J ALPHA GLOBAL LOGISTICS LLC</div>
          <h2 style="margin:10px 0 6px 0;">Employee Verification</h2>
          <div class="row"><span class="status">${status}</span></div>
          <div class="row"><b>${safe.full_name}</b> — ${safe.job_title || ""}</div>
          <div class="row muted">Employee ID: <b>${safe.employee_id}</b></div>
          <div class="row small muted">Verified at: ${safe.verified_at}</div>
          <hr style="border:none;border-top:1px solid #e7ebf3;margin:16px 0;" />
          <div class="small muted">This page confirms employment status only. For HR details, contact the company directly.</div>
        </div>
      </body>
    </html>
  `);
});

// Fallback
app.use((err, req, res, next) => {
  res.status(500).json({ error: "Server error", detail: String(err && err.message || err) });
});

app.listen(PORT, () => {
  console.log(`Employee registry server running on http://localhost:${PORT}`);
  console.log(`Public verify base URL: ${BASE_VERIFY_URL}`);
});
