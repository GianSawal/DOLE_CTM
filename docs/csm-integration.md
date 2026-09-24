# DOLE Client Queueing System ↔ CSM Integration Contract

This document specifies the integration contract between the **DOLE Regional Office III Queueing System** (`queueing`) and the **Client Satisfaction Measurement (CSM)** survey system.

The two systems share the same database (`dole_csm_system`). **No HTTP API calls or WebSockets are made between the backends; the shared database view and atomic row updates constitute the integration contract.**

---

## 1. Core Principles

1. **Per-Service Eligibility**: Survey eligibility is evaluated per `TicketItem` (service availed), not per client visit (`QueueTicket`). A client availing multiple services (e.g. TUPAD at TSSD-EW and Labor Rights Query at TSSD-LRLS) can rate each service independently as soon as that service is marked **Done**.
2. **Done Prerequisite**: A service must have `status = 'DONE'` to be eligible for survey. A waiting, called, serving, or skipped service cannot be surveyed.
3. **One Service $\to$ At Most One Survey**: Each `TicketItem` can be surveyed at most once. Once surveyed, the item is frozen in the queue system.
4. **Time Window**: Surveys must be submitted within `CSM_SURVEY_WINDOW_DAYS` (default: **3 days**) from `completed_at`.

---

## 2. Shared Database View: `csm_survey_eligibility`

The CSM system reads only this view to verify survey eligibility.

### View Definition
```sql
CREATE VIEW csm_survey_eligibility AS
SELECT
    ti.id AS ticket_item_id,
    qt.public_id,
    qt.transaction_number,
    qt.verification_code,
    o.code AS office_code,
    u.name AS unit_name,
    s.name AS service_name,
    ti.status AS item_status,
    ti.completed_at,
    ti.survey_submitted_at,
    (ti.status = 'DONE'
     AND ti.survey_submitted_at IS NULL
     AND ti.completed_at IS NOT NULL
     AND ti.completed_at >= DATE_SUB(NOW(), INTERVAL 3 DAY)) AS is_eligible
FROM queueing_ticketitem ti
JOIN queueing_queueticket qt ON ti.ticket_id = qt.id
JOIN queueing_service s ON ti.service_id = s.id
JOIN queueing_unit u ON ti.unit_id = u.id
JOIN queueing_office o ON qt.office_id = o.id;
```

### Columns

| Column | Type | Description |
|---|---|---|
| `ticket_item_id` | BigInt | Primary key of the `queueing_ticketitem` row. Target for the atomic survey claim. |
| `public_id` | UUID | UUID from the client ticket page and QR code URL (`/survey/t/<public_id>/`). |
| `transaction_number` | Varchar(32) | Formatted transaction number (e.g., `RO3-260923-014`). |
| `verification_code` | Varchar(4) | 4-character code (unambiguous alphabet: no 0/O/1/I/L) used as manual fallback on kiosk. |
| `office_code` | Varchar(20) | Code of the DOLE office (e.g., `RO3`, `BUL`, `PAM`). |
| `unit_name` | Varchar(200) | Name of the division/section (e.g., `TSSD-EW`, `TSSD-LRLS`). |
| `service_name` | Varchar(255) | Name of the specific service availed. |
| `item_status` | Varchar(20) | `WAITING`, `CALLED`, `SERVING`, `DONE`, or `SKIPPED`. |
| `completed_at` | DateTime | Timestamp when staff completed the service. |
| `survey_submitted_at` | DateTime | Timestamp when CSM claimed the survey; `NULL` if not yet surveyed. |
| `is_eligible` | Boolean (1/0) | `TRUE` (1) only if `status = 'DONE'`, `survey_submitted_at IS NULL`, and `completed_at >= NOW() - INTERVAL 3 DAY`. |

---

## 3. CSM Write Operations (Atomic Claim)

The CSM system writes only one thing to the queueing system database: **claiming the ticket item upon survey submission**.

When a client submits their CSM response, the CSM backend executes the following SQL inside the same transaction as inserting its survey response:

```sql
UPDATE queueing_ticketitem
SET survey_submitted_at = NOW()
WHERE id = %s
  AND status = 'DONE'
  AND survey_submitted_at IS NULL
  AND completed_at >= DATE_SUB(NOW(), INTERVAL 3 DAY);
```

### Response Validation Rule:
- Check the affected row count of the `UPDATE` query:
  - **Rows affected == 1**: Survey claimed successfully. Commit transaction.
  - **Rows affected == 0**: **REJECT submission immediately.** Either:
    1. The service is not yet marked `DONE`.
    2. The service has already been surveyed.
    3. The 3-day survey window has expired.
- Roll back the survey insertion if row count is not 1.

---

## 4. Uniqueness Guarantee

The CSM response table must enforce a `UNIQUE` constraint or index on `ticket_item_id`:
```sql
ALTER TABLE csm_csmresponse ADD CONSTRAINT uq_csm_ticket_item UNIQUE (ticket_item_id);
```
This guarantees at the database storage engine level that two concurrent requests cannot insert responses for the same ticket item.

---

## 5. Verification & Security Rules

1. **QR Scanning**:
   - The ticket QR code directs the user to:
     `{CSM_SURVEY_BASE_URL}/survey/t/{public_id}/`
   - The CSM queries `csm_survey_eligibility` by `public_id`.
   - If multiple completed services exist for that `public_id`, the CSM presents the list of completed services for the client to rate.

2. **Manual Entry on Kiosk**:
   - Manual lookup **MUST require both `transaction_number` AND `verification_code`**.
   - Searching by `transaction_number` alone is strictly prohibited to prevent clients from guessing or enumerating sequential transaction numbers.

3. **Immutability in Queueing System**:
   - The queueing system will **never** clear `survey_submitted_at`.
   - Once `survey_submitted_at` is non-null, the item is frozen: staff cannot change status, requeue, or modify the item.
