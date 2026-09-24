# DOLE CTMS — Client Transaction Monitoring System

The **Client Transaction Monitoring System (CTMS)** is the front door of every DOLE office visit and the prerequisite of the **Client Satisfaction Measurement (CSM)** survey system.

> **The Core Rule:** A client can answer the CSM survey **only with a CTMS transaction number, and only after DOLE staff have marked that transaction _Done_**. No transaction number → no survey. Transaction still waiting/being served, cancelled, or a no-show → no survey. One transaction → at most one survey.

---

## 🏛️ System Architecture

- **Backend**: Django 5.2.17 (LTS), Django REST Framework, SimpleJWT, MySQL (`mysqlclient` / `pymysql`), QR Code generator.
- **Frontend**: React + Vite, React Router, Public Sans & Archivo typography, JetBrains Mono numbers, DOLE brand design tokens.
- **Shared Database**: Uses the CSM's MySQL database (`dole_csm_system` / `dole_csm`).
  - Read-only unmanaged models: `csm_office`, `csm_service`, `csm_csmresponse`.
  - CTMS managed tables: `ctms_counter`, `ctms_staff_office`, `ctms_transaction`.
- **Ports (Dev)**:
  - Backend: `http://127.0.0.1:8001`
  - Frontend: `http://localhost:5174` (proxies `/api` → `:8001`)

---

## 📱 Routes & Screens

| Path | Audience | Purpose |
|------|----------|---------|
| `/checkin/office/:officeId` | Client (Public) | Self check-in: pick service, optional name, priority lane checkbox. Returns queue ticket. |
| `/t/:ticketToken` | Client (Public) | Live ticket page: queue number, transaction number, claim code, "X ahead of you", counter announcement. Turns into **"Rate our service"** CSM survey button when marked **Done**. |
| `/display/office/:officeId` | TV Display (Public) | Office TV display board showing currently served queue numbers per counter and upcoming waiting numbers. Queue numbers only, no names. Audio chime option. |
| `/staff/login` | Staff | JWT authentication using shared DOLE staff accounts (`auth_user`, `is_staff`). |
| `/staff/queue` | Staff | Queue management: counter selection, **Call Next** (priority clients called first), Call/Recall, **Done** (unlocks survey), Undo Done, No-show, Cancel, Return to Queue, and Walk-in registration with printable slips. |
| `/staff/transactions` | Staff | Filterable history of client transactions, timestamps, and CSM survey completion status. |
| `/staff/reports` | Staff | Summary metrics: total checked in, served, no-shows, average wait & service times, and **CSM survey response rate**. |
| `/staff/qr` | Staff | Printable office check-in QR poster for mounting at office entrances. |

---

## 🚀 Quickstart (Local Development)

### 1. Backend Setup

```bash
cd backend

# (Optional) Create and activate virtual environment
python -m venv venv
venv\Scripts\activate     # Windows
# source venv/bin/activate # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Run migrations (will use SQLite by default if USE_SQLITE_DEV=True in .env)
python manage.py migrate

# Seed development data (DOLE offices, services, counters, and admin/staff users)
python manage.py seed_ctms_dev

# Start backend server on port 8001
python manage.py runserver 8001
```

Default seeded credentials:
- **Admin**: `admin` / `admin123`
- **Staff**: `staff` / `staff123`

### 2. Frontend Setup

```bash
cd frontend

# Install npm packages
npm install

# Start development server on port 5174
npm run dev
```

Open `http://localhost:5174` in your browser:
- Public check-in: `http://localhost:5174/checkin/office/1`
- Office TV display: `http://localhost:5174/display/office/1`
- Staff queue operations: `http://localhost:5174/staff/login`

---

## 🐳 Docker Deployment

The CTMS runs alongside the CSM container on the same Docker network:

```bash
docker compose up -d --build
```
