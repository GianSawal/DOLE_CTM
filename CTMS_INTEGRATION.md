# CTMS ↔ CSM — Client Transaction Monitoring System (prerequisite of the CSM)

Handoff for building the **Client Transaction Monitoring System (CTMS)**: the queueing / transaction system a client
must pass through **before** they may answer the DOLE **Client Satisfaction Measurement (CSM)** survey that already
lives in this repo. Give this **whole file** to the AI coding assistant building the CTMS: §1 is the master prompt,
§2–§12 are the reference it relies on.

> **The rule this whole design serves:** a client can answer the CSM survey **only with a CTMS transaction number, and
> only after DOLE staff have marked that transaction _Done_.** No transaction number → no survey. Transaction still
> waiting/being served, cancelled, or a no-show → no survey. One transaction → at most one survey.

---

## 1. MASTER PROMPT — build the CTMSs

Build a **Client Transaction Monitoring System (CTMS)** for the Department of Labor and Employment (DOLE). It is the
**front door** of every DOLE office visit and the **prerequisite** of the existing CSM survey system:

1. **Check in.** A client arriving at a DOLE office scans the office's **check-in QR** (or a guard/staff registers
   them at the desk, or they use a check-in kiosk). They pick the service they came for. The CTMS issues a
   **transaction number** (e.g. `CRK-260923-0042`), a short **queue number** (`042`, or `P-007` for priority lanes),
   and a 4-character **claim code**, and shows them a live **ticket page**.
2. **Queue.** The client waits. Staff at a counter/window press **Call next**; the office's TV **display board** and
   the client's ticket page show "Now serving 042 — Window 2". Priority clients (senior citizens, PWDs, pregnant women:
   RA 9994 / RA 7277 priority lanes) are called before regular ones.
3. **Done.** When the service is finished, the staff member marks the transaction **Done** (or **No-show** /
   **Cancelled**).
4. **Survey.** Only a **Done** transaction unlocks the CSM survey. The client's ticket page turns into a
   **"Rate our service"** button linking to `{CSM_SURVEY_BASE_URL}/survey/t/{survey_token}`; printed slips carry the same
   link as a QR code, plus the transaction number and claim code for typing it in at a kiosk. The CSM checks the
   transaction itself (same database) before accepting an answer.

**Hard requirements**

- **Same database as the CSM.** The CTMS does **not** get its own database. Its tables live inside the CSM's MySQL
  database (§4), all named with the `ctms_` prefix. It **reads** the CSM's `csm_office` and `csm_service` tables
  (offices and services are managed only in the CSM admin; never duplicate them) and **never writes any `csm_*` table**.
- **Stack: match the CSM exactly** (§3): Django **5.2.x** + Django REST Framework + SimpleJWT + mysqlclient, React
  (Vite) + React Router. Same Django minor version is mandatory: both projects share the `auth_*`, `django_migrations`
  and `django_content_type` tables of the one database. Staff therefore **log in to the CTMS with the same accounts as
  the CSM** (`auth_user`, `is_staff`); each system issues its own JWTs with its own `SECRET_KEY`.
- Django app label **`ctms`**, so every table is `ctms_<model>` automatically. Map CSM's tables with **unmanaged**
  models (`managed = False`, `db_table = 'csm_office'` / `'csm_service'`), read-only.
- `USE_TZ = True`, `TIME_ZONE = 'Asia/Manila'`: every datetime in the database is **UTC**. The CSM relies on it.
- MySQL options identical to the CSM: `charset utf8mb4`, `init_command "SET sql_mode='STRICT_TRANS_TABLES'"`.
- Data model, lifecycle, numbering, the survey link, APIs, env, security: §5–§9 and §11. Build exactly that.
- **Real-time = polling** (ticket page and display board every 5 s; staff queue every 3 s). No WebSockets for v1.
- UI: reuse the CSM's look. Copy the tokens from `frontend/src/index.css` (neutral `#f2f2f6` ground, flat white cards,
  hairline borders, DOLE blue `#0305ba` single accent, gold `#ffc603` only for progress, red `#d8000f` errors; Archivo
  Expanded headings, Public Sans UI, JetBrains Mono for transaction/queue numbers). Logos: `frontend/src/assets/`
  `dole-logo.png` / `dole-mark.png`. Client pages are mobile-first with ≥52 px tap targets; the display board is a
  high-contrast full-screen page readable from across a room; the ticket page and display offer EN/FIL like the survey.

**Screens**

| Path | Who | What |
|------|-----|------|
| `/checkin/office/:officeId` | client (public, no login) | office shown locked; service dropdown (active `csm_service`, CSM order); optional name; priority checkbox (senior / PWD / pregnant); submit → redirect to ticket |
| `/t/:ticketToken` | client (public) | live ticket: queue no. (huge), transaction no., claim code, status, "n ahead of you", counter when called; when **Done** → big **Rate our service** button to the CSM survey link; after the survey → "Thank you, feedback received" |
| `/display/office/:officeId` | TV at the office (public, read-only) | now serving per counter + next few queue numbers. Queue numbers only, **never names** |
| `/staff/login` | staff | JWT login (same accounts as CSM) |
| `/staff/queue` | staff | pick office + counter (remembered), waiting list (priority first, then FIFO), **Call next**, Recall, **Done**, No-show, Cancel, Undo done (only if not yet surveyed); walk-in register form (same fields as check-in) with **Print slip** |
| `/staff/transactions` | staff | searchable/filterable history (office, service, status, date), per-row survey status |
| `/staff/reports` | staff | per office/service/day: checked in, served, no-shows, avg waiting time, avg service time, **survey response rate** (done vs surveyed) |
| `/staff/qr` | staff | printable **check-in QR** per active office (encodes `{CTMS_BASE_URL}/checkin/office/{id}`) |

Office scoping: a staff member sees only offices assigned to them in `ctms_staff_office`; superusers see all.
No offices/services admin in the CTMS. Link to the CSM admin (`/admin/offices`, `/admin/services`) instead.

**Build order:** models + migrations against the shared DB → public check-in + ticket page → staff login + queue
screen (call/done) → display board → survey link hand-off (verify end-to-end with the CSM changes in §10) → slips &
check-in QR → reports → rate limiting and polish.

---

## 2. End-to-end flow

```
 CLIENT                        CTMS (new)                                   CSM (this repo)
 ──────                        ──────────                                   ───────────────
 scan check-in QR ───────────▶ /checkin/office/3  → pick service
                               INSERT ctms_transaction (status=waiting)
                               ◀── ticket: 042 · CRK-260923-0042 · code K7QX
 waits (ticket page polls) ◀── staff "Call next"  → status=serving, counter=Window 2
                               staff "Done"       → status=done, done_at=now
 ticket shows "Rate our service" ─────────────────────────────────────────▶ /survey/t/<survey_token>
                                                                            GET  /api/public/transactions/<token>/
                                                                              reads ctms_transaction (same DB):
                                                                              done? not yet surveyed? within window?
                                                                            client answers CC/SQD
                                                                            POST /api/public/csm-responses/
                                                                              {transaction_token, ...answers}
                                                                              INSERT csm_csmresponse
                                                                                (ctms_transaction_id UNIQUE)
 ticket shows "Thank you"  ◀── CTMS sees the csm_csmresponse row for this transaction (same DB)
```

No HTTP call is made between the two backends: **the shared database is the integration**. HTTP only carries the
client's browser from the CTMS ticket to the CSM survey link.

---

## 3. The CSM: framework reference (what already exists)

Full spec: [AGENTS.md](./AGENTS.md). Deploy: [DEPLOY.md](./DEPLOY.md). Summary of what the CTMS must fit into:

| Layer | CSM |
|-------|-----|
| Backend | Django **5.2.17** (LTS), djangorestframework 3.18.1, djangorestframework_simplejwt 5.5.1, mysqlclient 2.3.0, python-dotenv, gunicorn (prod) — `backend/requirements.txt` |
| Frontend | React + Vite + React Router, Chart.js; dev proxy `/api` → `http://127.0.0.1:8000` (`frontend/vite.config.js`) |
| Database | MySQL — **8.0.46** on the local PC, **8.4** in Docker/Coolify. utf8mb4, strict mode |
| Auth | SimpleJWT (access 30 min, refresh 1 day), admin = `is_staff`. JWT only, no session auth on the API |
| Public API | unauthenticated, throttled per IP (`SURVEY_THROTTLE_RATE`, default 10/min); signed kiosk tokens (`X-Kiosk-Token`) get a higher limit |
| Timezone | `Asia/Manila`, `USE_TZ=True` (DB stores UTC) |
| Ports (dev) | backend `:8000`, frontend `:5173` → use **`:8001` / `:5174`** for the CTMS |
| Prod | Docker Compose on Coolify: `frontend` (nginx, public) → `backend` (gunicorn) → `db` (MySQL 8.4, volume `mysql-data`, **no published port**) |

Repo layout:

```
backend/config/        settings.py (env-driven), urls.py (/api/ → csm.urls, /django-admin/)
backend/csm/           models.py, serializers.py, views.py, urls.py, csf.py (DOLE form order), exports.py, reports.py, tests.py
frontend/src/          App.jsx (routes), csm.jsx (EN/FIL strings), index.css (design tokens), pages/public, pages/admin
docker-compose.yaml    frontend + backend + db
```

### CSM tables the CTMS uses (read-only for the CTMS)

**`csm_office`**: one per DOLE office / operating unit

| column | type | notes |
|--------|------|-------|
| `id` | bigint PK | never reused; encoded in printed QR codes |
| `name` | varchar(200) unique | e.g. "DOLE Pampanga Field Office" |
| `code` | varchar(10) unique | 2–10 caps/digits, e.g. `CRK`. **Use it as the transaction-number prefix.** Editable in CSM; only affects numbers issued afterwards |
| `is_active` | tinyint(1) | inactive → no check-in, hide from pickers |
| `qr_issued_at` | datetime(6) null | CSM-internal |

**`csm_service`**: one shared catalogue, every active service applies to every office

| column | type | notes |
|--------|------|-------|
| `id` | bigint PK | |
| `name` | varchar(200) unique | e.g. "Single Entry Approach (SEnA)" |
| `is_active` | tinyint(1) | inactive → not offered at check-in |
| `sort_order` | smallint unsigned | DOLE's CSF Form No. 3 order. **Order service lists by `sort_order, name`** |

**`csm_csmresponse`**: the survey answers. The CTMS reads only **`ctms_transaction_id`** (added by the CSM, §10) to
know a transaction has been surveyed. Everything else in it is personal/survey data the CTMS must not read or show.

**`auth_user`** (+ `auth_group`, …): Django's users, shared. Staff = `is_staff = 1`.

Current local data: 8 offices, 23 services.

### CSM API (for reference; the CTMS backend doesn't need to call it)

Base: dev `http://127.0.0.1:8000/api` (browser: `http://localhost:5173/api` via proxy); prod `{PUBLIC_URL}/api`.

| Method & path | Auth | Purpose |
|---------------|------|---------|
| `GET /api/health/` | none | liveness |
| `GET /api/public/offices/` | none | active offices `{offices:[{id,name}]}` |
| `GET /api/public/offices/:id/` | none | office name + active services |
| `POST /api/public/csm-responses/` | none (throttled) | submit a survey → `{control_no, transaction_no}` |
| `POST /api/admin/auth/login/`, `/refresh/` | — | JWT |
| `/api/admin/offices/`, `/api/admin/services/` | JWT staff | CRUD (managed here, not in the CTMS) |
| `/api/admin/csm-responses/`, `/api/admin/analytics/*` | JWT staff | responses, reports |

New CSM endpoints added for the CTMS are in §8.1.

---

## 4. Shared database

Both systems use **one** MySQL database:

| | Local PC (dev) | Production (Docker / Coolify) |
|---|---|---|
| Database | `dole_csm_system` | `dole_csm` (`MYSQL_DATABASE`) |
| Host | `127.0.0.1` | `db` (Docker service name; reachable **only inside the compose network**) |
| Port | `3306` | `3306` |
| User | `root` (as the CSM uses today) | dedicated `ctms` user (below). The CSM's app user is `csm` |
| Password | same as `DB_PASSWORD` in `backend/.env` (not copied here; this file is committed) | a new random secret, set in Coolify |

### Table ownership (the contract)

| Tables | Owner (migrates / writes) | The other system |
|--------|---------------------------|------------------|
| `csm_office`, `csm_service` | CSM | CTMS **reads** (FK target) |
| `csm_csmresponse` | CSM | CTMS **reads** `ctms_transaction_id` only |
| `ctms_*` | CTMS | CSM **reads** `ctms_transaction` only |
| `auth_*`, `django_content_type`, `django_migrations`, `django_session`, `django_admin_log` | shared Django tables | both (Django does this itself) |
| `django_cache` (prod) | CSM | CTMS uses its own `ctms_cache` |

Neither system writes the other's tables. Every CTMS table name starts with `ctms_`, so nothing can collide.

### Conventions both sides rely on

- Datetimes stored in **UTC** (`datetime(6)`), shown in Asia/Manila.
- `utf8mb4` everywhere; `STRICT_TRANS_TABLES`.
- Foreign keys from `ctms_*` to `csm_office` / `csm_service` are real DB constraints with **PROTECT** semantics
  (`ON DELETE` restricted): a used office/service can only be deactivated in the CSM, never deleted (§10 item 6).
- **Migration order on a fresh database:** the CSM migrates first (creates `csm_*` and `auth_*`), then the CTMS.

### Creating the CTMS database user (production)

MySQL can't grant by table-name prefix, and the CTMS (a Django project) also needs the shared Django tables, so the
user gets rights on the one schema. Run as MySQL root inside the `db` container:

```sql
CREATE USER 'ctms'@'%' IDENTIFIED BY '<strong random password>';
GRANT ALL PRIVILEGES ON dole_csm.* TO 'ctms'@'%';
FLUSH PRIVILEGES;
```

For local dev, reuse the CSM's credentials from `backend/.env` (or create the same user on `dole_csm_system`).

**Reaching the prod database:** the compose file publishes no MySQL port (good). Deploy the CTMS **in the same
Coolify project / Docker network** (or add its services to this `docker-compose.yaml`) and use `DB_HOST=db`. Never
expose 3306 to the internet.

**Backups:** `scripts/backup.sh` dumps the whole database, so the `ctms_*` tables are included automatically.

---

## 5. CTMS data model

Django models in app `ctms` (→ tables below). Types are what Django 5.2 creates on MySQL.

### `ctms_transaction`: one client visit for one service

| column | type | notes |
|--------|------|-------|
| `id` | bigint PK | |
| `transaction_no` | varchar(24) **unique** | `{office.code}-{YYMMDD}-{seq:04d}`, e.g. `CRK-260923-0042`. Shown on the ticket, slip, CSM receipt and CSM admin |
| `office_id` | bigint FK → `csm_office.id` | PROTECT |
| `service_id` | bigint FK → `csm_service.id` | PROTECT |
| `queue_date` | date | Manila local date of check-in |
| `queue_seq` | int unsigned | per office per day, restarts daily; **unique (`office_id`, `queue_date`, `queue_seq`)**. Same number as the `seq` in `transaction_no` |
| `queue_no` | varchar(8) | what is called out: `042` regular, `P-007`-style for priority (`is_priority`); a separate priority counter is optional, one sequence is fine |
| `is_priority` | tinyint(1) | senior / PWD / pregnant |
| `client_name` | varchar(200) null | optional; **never shown on the public display** |
| `status` | varchar(12) | `waiting` · `serving` · `done` · `no_show` · `cancelled` (§6) |
| `counter_id` | bigint FK → `ctms_counter.id` null | set when called |
| `source` | varchar(10) | `qr` · `kiosk` · `staff` |
| `checked_in_at` | datetime(6) | |
| `called_at` | datetime(6) null | first call |
| `done_at` | datetime(6) null | set on Done; cleared on Undo |
| `closed_at` | datetime(6) null | no-show / cancelled time |
| `served_by_id` | int FK → `auth_user.id` null | staff who marked Done |
| `ticket_token` | varchar(32) **unique** | `secrets.token_urlsafe(16)`; client's ticket page `/t/:ticketToken` |
| `survey_token` | varchar(32) **unique** | `secrets.token_urlsafe(16)`, **different** from `ticket_token`; the only thing in the survey link |
| `claim_code` | char(4) | random from `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (no 0/O/1/I/L); printed on the slip, needed to type a transaction number into the CSM by hand |

Indexes: (`office_id`, `status`, `queue_date`) for the queue; `checked_in_at`.

Numbering: generate `queue_seq` inside `transaction.atomic()` with `select_for_update()` on the office's row (read via
the unmanaged `csm_office` model). Same pattern the CSM uses for its Control No. (`backend/csm/models.py`,
`CSMResponse.save`). The unique constraint is the backstop.

### `ctms_counter`: a window / desk at an office

| column | type | notes |
|--------|------|-------|
| `id` | bigint PK | |
| `office_id` | bigint FK → `csm_office.id` | PROTECT |
| `name` | varchar(50) | "Window 2"; unique per office |
| `is_active` | tinyint(1) | |

### `ctms_staff_office`: which staff work at which office

| column | type | notes |
|--------|------|-------|
| `id` | bigint PK | |
| `user_id` | int FK → `auth_user.id` | CASCADE |
| `office_id` | bigint FK → `csm_office.id` | PROTECT; unique (`user_id`, `office_id`) |

---

## 6. Transaction lifecycle

```
            call next / call specific              mark done
 waiting ─────────────────────────────▶ serving ──────────────▶ done ──▶ (survey allowed)
    │  ▲                                   │                     │
    │  └──────── return to queue ──────────┤                     │ undo done (only if NOT yet surveyed)
    │                                      │                     ▼
    ├──▶ cancelled  (client left / staff)  └──▶ no_show        serving
    └──▶ no_show
```

- Only **`done`** unlocks the survey. `no_show` and `cancelled` are final.
- **Undo done** exists for mis-clicks, and is refused once a `csm_csmresponse` row points at the transaction.
- A transaction still `waiting`/`serving` at end of day stays open; staff close it as no-show (optional nightly job:
  mark the day's leftover `waiting` as `no_show`).
- One transaction = one service. A client with two services checks in twice (two transactions, two surveys), which
  matches the CSM, where each response is for one service.

---

## 7. Survey hand-off (the integration contract)

**Survey link** (on the ticket page after Done, and as a QR on the printed slip):

```
{CSM_SURVEY_BASE_URL}/survey/t/{survey_token}
e.g. http://csm.dole.lan:5173/survey/t/Qm3v0l8x2Rk9ZpYt1aW4bA
```

`CSM_SURVEY_BASE_URL` = the CSM's `SURVEY_BASE_URL` (the CSM's public origin). The link is a plain navigation: no API
call, no CORS.

**Typed entry** (kiosk / a client without the QR): on the CSM's office form the client enters **transaction number +
claim code**. The CSM exchanges them for the `survey_token`. The claim code keeps a guessed sequential number from
being enough to answer someone else's survey.

**What the CSM checks before showing and before saving the form** (reads `ctms_transaction` directly):

| Check | Fails → CSM shows |
|-------|-------------------|
| token / (number + claim code) matches a transaction | "Transaction not found" |
| `status = 'done'` | "Your transaction isn't finished yet. Please come back when staff mark it done." |
| no `csm_csmresponse` with this `ctms_transaction_id` | "Feedback for this transaction was already received. Thank you!" |
| `done_at` within `CSM_SURVEY_WINDOW_DAYS` (default 7) | "This feedback link has expired." |
| office & service still active | the existing invalid-link screen |

Office and service on the survey are **taken from the transaction and locked**. The client no longer picks the
service. `csm_csmresponse.ctms_transaction_id` is **UNIQUE**, so a double-submit can't create two surveys.

The CSM receipt ("RECEIVED" stamp) shows the CTMS **transaction number**. The CTMS knows a survey happened by the
existence of `csm_csmresponse.ctms_transaction_id = <id>`: surveyed = yes/no, and the time from its `created_at`.
The CTMS must not read any other column of `csm_csmresponse`.

---

## 8. APIs

### 8.1 New CSM endpoints (built in this repo, §10)

| Method & path | Auth | Body / response |
|---------------|------|-----------------|
| `GET /api/public/transactions/:surveyToken/` | none, throttled | `200 {transaction_no, office:{id,name}, service:{id,name}, status:"ready"}`, or `409 {status:"not_done"\|"already_answered"\|"expired"}`, `404` unknown |
| `POST /api/public/transactions/lookup/` | none, throttled (tight, e.g. 5/min) | `{transaction_no, claim_code}` → `200 {survey_token}` / `404` (same response for wrong number or wrong code) |
| `POST /api/public/csm-responses/` | none, throttled | **now requires `transaction_token`**; `office`/`service` are ignored and taken from the transaction. Response `{control_no, transaction_no}`, where `transaction_no` is now the CTMS number |

### 8.2 CTMS API (its own backend, base `/api`)

| Method & path | Auth | Purpose |
|---------------|------|---------|
| `GET /api/health/` | none | liveness |
| `GET /api/public/offices/:officeId/` | none | office name + active services (from `csm_*`) for check-in; 404 if inactive |
| `POST /api/public/checkin/` | none, throttled per IP | `{office, service, client_name?, is_priority}` → `201 {ticket_token}` |
| `GET /api/public/tickets/:ticketToken/` | none | `{queue_no, transaction_no, claim_code, status, ahead, counter, survey_url (only when done & not surveyed), surveyed}` |
| `GET /api/public/display/:officeId/` | none | `{serving:[{counter, queue_no}], next:[queue_no…]}`. Queue numbers only |
| `POST /api/staff/auth/login/`, `/refresh/` | — | SimpleJWT, `is_staff` only (same pattern as CSM's `StaffTokenSerializer`), login throttled |
| `GET /api/staff/queue/?office=&counter=` | JWT | waiting + serving lists |
| `POST /api/staff/transactions/` | JWT | walk-in register (`source=staff`) |
| `POST /api/staff/transactions/:id/call/` · `/recall/` · `/done/` · `/undo-done/` · `/no-show/` · `/cancel/` · `/requeue/` | JWT | state transitions (§6); invalid transition → 409 |
| `POST /api/staff/call-next/` | JWT | `{office, counter}` → next waiting (priority first, then oldest), locked with `select_for_update(skip_locked=True)` so two windows never call the same client |
| `GET /api/staff/transactions/` | JWT | history, filters: office, service, status, date_from, date_to, q |
| `GET /api/staff/reports/summary/` | JWT | counts, avg wait (`called_at − checked_in_at`), avg service (`done_at − called_at`), survey rate |
| `GET /api/staff/qr/:officeId/` | JWT | check-in QR PNG/SVG (`qrcode` lib, as the CSM does) |
| CRUD `/api/staff/counters/`, `/api/staff/staff-offices/` | JWT superuser | counters, staff ↔ office assignment |

Every staff endpoint filters by the caller's `ctms_staff_office` offices (superuser: all).

---

## 9. Environment

### CTMS `backend/.env` (template)

```ini
DJANGO_SECRET_KEY=<new random key; NOT the CSM's>
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

# Shared database: the CSM's (see §4)
DB_NAME=dole_csm_system          # prod: dole_csm
DB_USER=root                     # prod: ctms
DB_PASSWORD=<local: same as CSM backend/.env DB_PASSWORD · prod: the ctms user's password>
DB_HOST=127.0.0.1                # prod: db
DB_PORT=3306

# Where the CTMS itself is reached (check-in QR codes encode this)
CTMS_BASE_URL=http://localhost:5174
# The CSM's public origin (survey links) = the CSM's SURVEY_BASE_URL
CSM_SURVEY_BASE_URL=http://csm.dole.lan:5173

CHECKIN_THROTTLE_RATE=10/min
LOGIN_THROTTLE_RATE=5/min
# prod only, as in the CSM:
# PUBLIC_URL=https://ctms.example.gov.ph
# DRF_NUM_PROXIES=2
# CACHE_TABLE=ctms_cache        # own table (manage.py createcachetable): sharing the CSM's django_cache would
#                               # merge both systems' throttle counters (same "login" scope key)
```

### CSM values the CTMS needs to know (from this repo)

| Variable | Local value | Meaning |
|----------|-------------|---------|
| `DB_NAME` | `dole_csm_system` | the shared database |
| `DB_HOST` / `DB_PORT` | `127.0.0.1` / `3306` | |
| `DB_USER` | `root` | |
| `DB_PASSWORD` | *in `backend/.env`* | not written here on purpose |
| `SURVEY_BASE_URL` | `http://csm.dole.lan:5173` | → the CTMS's `CSM_SURVEY_BASE_URL` |
| CSM API | `http://127.0.0.1:8000/api` | backend dev server |
| Prod | `MYSQL_DATABASE=dole_csm`, `MYSQL_USER=csm`, `DB_HOST=db` | see `docker-compose.yaml`, DEPLOY.md |

New CSM variables (added with §10): `CSM_REQUIRE_TRANSACTION` (`False` until the CTMS is live, then `True`),
`CSM_SURVEY_WINDOW_DAYS` (default `7`).

---

## 10. Changes needed on the CSM side (this repo; not done yet)

1. **Read-only model** `CtmsTransaction` (`managed = False`, `db_table = 'ctms_transaction'`): the columns the CSM reads
   (`id, transaction_no, office_id, service_id, status, done_at, survey_token, claim_code`). In tests, make it managed
   so the test database has the table.
2. **`CSMResponse.ctms_transaction`**: `OneToOneField(CtmsTransaction, null=True, db_constraint=False,
   on_delete=DO_NOTHING)`, giving a **unique** `ctms_transaction_id` column. Nullable for the 13 existing responses. No DB FK
   constraint, so the CSM's migrations don't depend on the CTMS having migrated.
3. **Endpoints** of §8.1, with the checks of §7. On submit the CSM re-checks everything, takes office/service from the
   transaction, and relies on the unique column for double-submits (IntegrityError → the "already received" 409).
4. **`CSM_REQUIRE_TRANSACTION`** switch: `False` = today's behaviour (QR / kiosk forms work without a transaction);
   `True` = `/survey/office/:id` and `/survey` open with a "Transaction number + claim code" step, and the POST without
   a valid `transaction_token` is a 400.
5. **Frontend:** route `/survey/t/:token` (loads the transaction, locks office + service, skips the service question);
   the typed-entry step; receipt shows the CTMS transaction number.
6. **Office/service deletion:** the CSM's delete must also treat CTMS transactions as "in use" (409 → deactivate
   instead). Otherwise the DB-level PROTECT from `ctms_transaction` surfaces as a 500.
7. **Admin:** show the CTMS transaction number in Responses (list, detail, CSV/XLSX export).
8. **"Transaction No." naming:** the CSM already has its own `transaction_no` (an integer counted per office +
   service). Recommended: keep that column (reports and constraints use it), relabel it on screen, and show the CTMS
   number as "Transaction No.". See §12.

---

## 11. Security

- Public CTMS endpoints (check-in, ticket, display) are open doors: throttle per IP like the CSM does
  (`SurveySubmitThrottle` pattern); check-in kiosks may get a signed kiosk token like the CSM's (`X-Kiosk-Token`).
- The survey link carries only a random `survey_token` (128-bit). Never put the sequential transaction number alone in a
  link. Typed entry needs the claim code, and the lookup is throttled tightly and gives the same 404 for "wrong number"
  and "wrong code".
- `ticket_token` ≠ `survey_token`: sharing a ticket screenshot doesn't expose the survey.
- Display board and ticket pages never show client names or other clients' data.
- The CTMS must not read survey answers or personal fields of `csm_csmresponse` (only `ctms_transaction_id`).
- Secrets live in `.env` / Coolify variables, never in the repo. Separate `SECRET_KEY` per system.
- Production MySQL stays unpublished; the CTMS joins the Docker network.

---

## 12. Open decisions (defaults assumed above; change them here first)

| # | Question | Default in this doc |
|---|----------|---------------------|
| 1 | Rule reading: "can't answer if no transaction number and if it is marked done" was taken to mean **"can answer only when it exists _and_ is Done"** | as stated |
| 2 | Survey window after Done | 7 days (`CSM_SURVEY_WINDOW_DAYS`) |
| 3 | Do clients **log in** (accounts) to the CTMS, or just check in? | check-in without accounts (optional name). Client accounts = v2 |
| 4 | Which number the CSM shows as "Transaction No." | the CTMS number; CSM's old counter kept and relabelled |
| 5 | Separate project vs. inside this one | separate Django project on the shared DB (as asked). Simpler alternative: a `ctms` app inside this `backend/` (one deploy, same auth, real FKs); the table layout above works unchanged either way |
| 6 | Priority lane numbering | one sequence, priority flag + `P-` prefix |
