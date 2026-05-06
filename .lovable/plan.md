
# Pivot: Parts Tracking Dashboard for HCP Jobs & Estimates

Goal: replace the technician time-tracking UI with a **Parts Tracking** dashboard. A user enters an HCP **Job #** or **Estimate #**, the app pulls live data from HouseCall Pro, lets users add the parts required for that work, and tracks each part through its lifecycle (Requested → Sent to Parts → Pricing → Ordered → Shipped → Received → Installed). Dispatch and Parts departments collaborate via status updates and notes. No login. English UI.

The existing HCP API integration (server functions, retry logic, `HCP_API_KEY` secret) is preserved and extended.

---

## What gets removed vs kept

**Removed (UI only — files deleted):**
- `src/routes/technician.tsx`, `src/routes/admin.tsx`
- `src/components/admin/*` (LiveView, TimeEntriesTab, ReportsTab, EmployeesTab)
- `src/components/reports/*`, `src/components/JobTypeBadge.tsx`
- Time-tracking lib code: `time.ts`, `reports.ts`, `export-utils.ts`, `scheduled.server.ts` (auto clock-out cron)

**Kept:**
- `HCP_API_KEY` secret + `src/lib/hcp-client.ts` (extended with Estimates + lookup-by-number)
- `src/integrations/supabase/*` (regenerated after migration)
- Tailwind theme, shadcn/ui, MCR branding, favicon, `MCRLogo.tsx`
- TanStack Start setup, root route

---

## New data model (one migration)

Drop unused tables (`time_entries`, `pause_logs`, `admin_edits_log`, `employees`, `hcp_jobs_cache`). Create:

**work_orders** — local cache of any HCP Job/Estimate the team is tracking
- `id` uuid PK, `hcp_id` text, `hcp_type` text check (`'job'|'estimate'`)
- `number` text, UNIQUE(`hcp_type`, `number`)
- `customer_name`, `address`, `description`, `hcp_status` text
- `scheduled_date` date, `assigned_to` text, `raw_data` jsonb
- `last_synced_at`, `created_at`, `updated_at` timestamptz

**parts** — line items added by Dispatch/Parts
- `id` uuid PK, `work_order_id` uuid FK CASCADE
- `name` text NOT NULL — **free-text "what part is needed"; entered by Dispatch the moment they know, even before Parts has identified the exact SKU/vendor**
- `description` text — extra context (model, symptom, photo URL, etc.)
- `part_number` text nullable — filled in later by Parts once identified
- `quantity` numeric default 1
- `vendor` text nullable — filled in later by Parts
- `unit_price` numeric nullable, `total_price` numeric nullable — Parts fills after pricing is confirmed
- `pricing_status` text default `'pending'` — `pending | quoted | confirmed`
- `status` text NOT NULL default `'requested'`, check in: `requested`, `sent_to_parts`, `pricing`, `quoted`, `approved`, `ordered`, `shipped`, `received`, `installed`, `cancelled`, `backordered`
- `tracking_number`, `tracking_carrier` text, `eta` date
- `requested_by` text, `ordered_at`, `received_at` timestamptz
- `notes` text, `created_at`, `updated_at` timestamptz

**part_events** — audit log + chat thread per part
- `id` uuid PK, `part_id` uuid FK CASCADE
- `author` text, `department` text check (`dispatch|parts|system|other`)
- `event_type` text (`created|status_change|pricing_update|tracking_added|note|field_update`)
- `from_status`, `to_status`, `message` text
- `created_at` timestamptz

RLS: enabled on all 3 tables, open `Allow all` policies (no login). `updated_at` triggers on `work_orders` and `parts`. Trigger on `parts` auto-inserts `part_events` rows on status/pricing/tracking changes. Realtime publication includes `parts` and `part_events`.

---

## HCP integration (server functions)

Extend `src/lib/hcp-client.ts`:
- `fetchHcpJobByNumber(number)` — search jobs, match `invoice_number`/`job_number`; fallback to `GET /jobs/{id}`.
- `fetchHcpEstimateByNumber(number)` — search estimates by `estimate_number`.
- Reuse existing auth, retry, mappers.

New `src/lib/work-orders.functions.ts`:
- `lookupHcpWorkOrder({ type, number })` — calls HCP, returns normalized preview, no DB write.
- `importWorkOrder({ type, number })` — lookup + upsert into `work_orders`.
- `refreshWorkOrder({ id })` — re-fetch from HCP, update row + `last_synced_at`.
- `createManualWorkOrder({ type, number, customer_name, address, description })` — fallback if HCP lookup fails.

New `src/lib/parts.functions.ts`:
- `listWorkOrders({ search?, status? })` — local list + parts rollup.
- `getWorkOrderDetail({ id })` — work order + parts + recent events.
- `addPart({ workOrderId, name, description?, quantity?, requested_by, department })` — **only `name` required, so Dispatch can drop in "Hydraulic pump for X model" before Parts sources it**.
- `updatePart({ id, fields, author, department })` — partial update; logs `field_update` event (separate `pricing_update` event when `unit_price`/`vendor`/`part_number` change).
- `updatePartStatus({ id, status, message?, author, department })` — validates transitions; auto-stamps `ordered_at`/`received_at`.
- `addPartNote({ partId, message, author, department })`
- `deletePart({ id, author, department })`

All write functions take `author` + `department` strings (no auth) and write to `part_events`.

Validation: zod schemas for every server-fn input (length limits on text, enum checks for status/department).

---

## Frontend (full rewrite)

```
src/routes/
  __root.tsx                # title "MCR Parts Tracker"
  index.tsx                 # Dashboard + lookup
  work-orders.$id.tsx       # Work order detail
```

### `/` — Dashboard
- Header: MCR logo, "Parts Tracker", **department selector** (Dispatch / Parts / Other + name input) persisted in `localStorage`; auto-attached as `author`/`department` on writes.
- Lookup bar: Job / Estimate toggle + number input + "Look up" → `lookupHcpWorkOrder`. Preview card with **Import** → navigates to detail. "Create manual entry" link if HCP returns nothing.
- Active work orders table: Number, Type, Customer, Address, HCP status, Parts count, Status rollup chips (e.g. "2 ordered · 1 received · 3 pending"), Last update, Open/Refresh.
- Filters: search (number/customer), parts-state filter (any pending / awaiting pricing / awaiting shipment / all received).

### `/work-orders/$id` — Detail
- **Top card**: HCP info (number, type badge, customer, address, scheduled date, HCP status, assigned techs), "Refresh from HCP" button, "Open in HCP" external link.
- **Parts panel**:
  - **"Add part needed" button** — opens dialog with a single required field (`name` — free-text, e.g. "Hydraulic seal kit, model X"), plus optional `description`, `quantity`, `requested_by`. This is the fast-path so Dispatch can log the need immediately while Parts is still hunting for vendor + price.
  - Parts list (expandable rows). Each part shows:
    - Name + description, qty, requested by, age ("requested 12m ago").
    - **Status pill with dropdown** (full lifecycle, including new `pricing` and `quoted` states for the vendor-pricing wait period).
    - **Pricing block** — editable inline by Parts: vendor, part number, unit price, total, `pricing_status` (pending/quoted/confirmed). Visible to Dispatch read-only; a "Pricing pending" badge shows until confirmed.
    - **Tracking block** — carrier + tracking # + ETA, editable when status ≥ `ordered`.
    - **Timeline / thread** (`part_events`): chronological feed showing status changes ("Parts — Jose: Requested → Sent to Parts"), pricing updates ("Parts added vendor SupplyCo, $245.00"), tracking, free-text notes. Compose box at bottom to add notes.
    - Edit / Delete actions.
- **Realtime**: subscribe to `parts` and `part_events` filtered by `work_order_id` so Dispatch & Parts see live updates without refresh.

### Components (`src/components/parts/`)
`WorkOrderLookup`, `WorkOrderTable`, `WorkOrderHeader`, `PartsList`, `PartCard`, `PartStatusBadge`, `PartStatusSelect`, `AddPartDialog` (the "type the part needed" fast-form), `EditPartDialog`, `PricingBlock`, `TrackingBlock`, `PartTimeline`, `DepartmentSelector`.

UI kit: existing shadcn/ui (Card, Table, Dialog, Select, Badge, Textarea, Button, Tabs, Tooltip, Sonner). Industrial MCR theme retained.

---

## Status lifecycle

```text
requested → sent_to_parts → pricing → quoted → approved → ordered → shipped → received → installed
                                                                  ↘ backordered ↗
                                              ↘ cancelled (allowed from any state, requires note)
```

`updatePartStatus` enforces forward progression; backward moves require a note and log a `status_change` event with the message.

---

## Technical notes

- HCP estimates endpoint may differ from jobs; client surfaces a clear error if the plan doesn't expose them — manual-entry fallback keeps the workflow unblocked.
- All HCP calls remain server-only via `createServerFn`, using `HCP_API_KEY`.
- Migration replaces unused tables; DB types regenerate automatically.
- Favicon + meta updated to "MCR Parts Tracker"; existing MCR logo reused.
- `/admin` and `/technician` routes deleted; `/` is the only entry point.
- Input validation with zod on every server-fn; client-side mirrors the schemas.

---

## Open question

Plan assumes a **single shared workspace** (no login, anyone with the link can read/write; department is self-selected). Say the word if you want soft per-department gating (e.g. only Parts can edit pricing, only Parts can mark Ordered/Shipped/Received) — still no login, just role-aware UI.
