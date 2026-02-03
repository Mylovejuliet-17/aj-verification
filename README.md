# Employee Registry Web App (QR + Verification)

This is a lightweight Node.js + SQLite web app that provides:

- Employee registry CRUD (create / update / delete)
- Driver addendum + documents checklist
- QR code generation per employee
- Printable ID cards (PDF)
- Public verification page: `/verify/:employeeId`

## Quick start

1) Install Node.js **18+ (LTS recommended)**  
2) In this folder:

```bash
npm install
cp .env.example .env
npm start
```

3) Open:
- Admin UI: `http://localhost:3000`
- Verification page example: `http://localhost:3000/verify/AJ-EMP-001`

> Database file is stored at: `./data/registry.db`

## QR & verification URL

Set `BASE_VERIFY_URL` in `.env` to the domain you will use publicly, for example:

- `https://verify.yourcompany.com/verify`

The QR code will point to:

- `https://verify.yourcompany.com/verify/AJ-EMP-001`

If you host this app behind a reverse proxy at `/verify`, your public route can be:

- `https://verify.yourcompany.com/verify/<EmployeeID>`

## Production notes (recommended)

- Put the admin UI behind authentication (VPN, SSO, or reverse-proxy auth).
- Use HTTPS.
- Keep the **public verification** page minimal (name/title/id/status only).

## Optional: connect/sync to an existing verification system

If you already have a verification backend, you have two common options:

### Option A) Use your existing verification page as the QR target
- Set `BASE_VERIFY_URL` to your existing verification base URL.
- The QR will point to that system, and this app can remain internal.

### Option B) Use this app as the verification page, and push updates to your system
When the following events occur, the app can POST a webhook:

- `employee.created`
- `employee.updated`
- `employee.deleted`
- `employee.driver_updated`
- `employee.documents_updated`

Configure in `.env`:

- `VERIFICATION_WEBHOOK_URL`
- `VERIFICATION_API_KEY` (sent as `X-API-Key`)
- `HMAC_SECRET` (optional; adds `X-Signature` header)

**Webhook payload example:**
```json
{
  "event": "employee.updated",
  "employee": {
    "employee_id": "AJ-EMP-001",
    "full_name": "Jane Doe",
    "job_title": "Driver",
    "status": "Active",
    "updated_at": "2026-02-03T12:34:56Z"
  }
}
```

**HMAC signature**
- If `HMAC_SECRET` is set, signature is: `hex(hmac_sha256(body))`
- Sent as header: `X-Signature`

## Useful endpoints

- `GET /api/employees`
- `POST /api/employees`
- `PUT /api/employees/:id`
- `GET /api/employees/:id/qrcode.png`
- `GET /api/employees/:id/idcard.pdf`
- `GET /api/idcards.pdf?ids=AJ-EMP-001,AJ-EMP-002`
- `GET /verify/:id` (public verification page)

---

If you'd like, I can adapt this to MongoDB, add role-based access, or integrate directly with your current verification API spec (JWT, OAuth, custom headers, etc.).
