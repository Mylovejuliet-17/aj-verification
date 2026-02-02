// index.js - Signed QR Verification (Option A)
// npm i express
// SECRET="your-long-random-secret" node server.js
const express = require("express");
const crypto = require("crypto");

const app = express();
const SECRET = process.env.SECRET || "CHANGE_ME_TO_A_LONG_RANDOM_SECRET"; // CHANGE IN PRODUCTION

function b64url(buf) {
  return buf.toString("base64").replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
}

function verifyToken(t) {
  const parts = (t||"").split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = b64url(crypto.createHmac("sha256", SECRET).update(body).digest());
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch(e) { return null; }
  const json = Buffer.from(body.replace(/-/g,"+").replace(/_/g,"/"), "base64").toString("utf8");
  const payload = JSON.parse(json);
  if (!payload.exp || Date.now()/1000 > payload.exp) return null;
  return payload;
}

// Replace with a real DB (Google Sheet/Airtable/Postgres)
const STAFF = {
  "AJAGLCEO2026001": {
    name: "ABRAHAM AGYEMAN BADU",
    role: "CEO / DRIVER",
    status: "ACTIVE",
    photo: "/US_PASSPORT.jpg"
  }
};

app.use(express.static(__dirname));

app.get("/v", (req, res) => {
  const id = req.query.id;
  const t = req.query.t;
  const payload = verifyToken(t);
  const record = STAFF[id];

  const ok = payload && payload.id === id && record;
  const status = ok ? record.status : "INVALID";
  const badgeColor = status === "ACTIVE" ? "#1DB954" : "#D93025";

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!doctype html>
  <html><head><meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Staff Verification</title>
  <style>
    body{font-family:Arial;margin:0;background:#f6f8fb}
    .wrap{max-width:760px;margin:24px auto;padding:16px}
    .card{background:#fff;border-radius:16px;box-shadow:0 6px 20px rgba(0,0,0,.08);overflow:hidden}
    .header{padding:18px 20px;border-bottom:1px solid #eef2f7}
    .content{display:flex;gap:18px;padding:20px;flex-wrap:wrap}
    .photo{width:180px;height:180px;border-radius:14px;object-fit:cover;border:1px solid #e6edf5}
    .badge{display:inline-block;padding:8px 12px;border-radius:999px;background:${badgeColor};color:#fff;font-weight:700;letter-spacing:.5px}
    .row{margin:10px 0}
    .label{color:#5b6b7a;font-size:13px}
    .value{font-size:16px;font-weight:700}
    code{background:#f0f4f8;padding:2px 6px;border-radius:6px}
    .note{color:#6a7a89;font-size:12px;margin-top:8px}
  </style></head>
  <body><div class="wrap"><div class="card">
    <div class="header"><h2 style="margin:0">A&J ALPHA GLOBAL LOGISTICS LLC • Verification</h2></div>
    <div class="content">
      <img class="photo" src="${ok ? record.photo : "/placeholder.png"}" alt="Employee photo"/>
      <div>
        <div class="row"><span class="badge">${status}</span></div>
        <div class="row"><div class="label">Employee ID</div><div class="value"><code>${id||""}</code></div></div>
        <div class="row"><div class="label">Name</div><div class="value">${ok?record.name:"—"}</div></div>
        <div class="row"><div class="label">Role</div><div class="value">${ok?record.role:"—"}</div></div>
        <div class="note">Signature: <b>${ok?"VALID":"INVALID/TAMPERED"}</b> • Token expiry enforced</div>
      </div>
    </div>
  </div></div></body></html>`);
});

const PORT = process.env.PORT || 1000;
app.listen(PORT, () => console.log("Running on port", PORT));


