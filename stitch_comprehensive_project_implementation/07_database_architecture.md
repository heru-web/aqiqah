# 07 — Database & Integration Architecture (bertekad kongkret, 82 tabel)

## Layout: PostgreSQL (neon connect self-host) via Drizzle ORM (`src/db/schema/*.ts`; migrations via `__drizzle_migrations` table & drizzle-kit push script `db:push`).

## Daftar tabel (verified by pg seq schema)
core, sales, finance, performance, crm & crm-v2, audit, ops/product additions, alarm, WA keys:
users, sessions, user_roles, roles, role_permissions, branches, app_settings, app_meta,
sops, sop_checks, audit_logs, notifications, webhook_events, idempotency_keys, counters,
crm_pipelines, crm_stages, crm_deals, crm_stage_history, crm_people, crm_organizations,
crm_activities, crm_notes, lead_followups, leads,
customers, customer_communications, customer_complaints,
quotations, quotation_items, orders, order_items, order_status_logs, invoices, invoice_items,
payments, cash_accounts, accounts, journals, journal_lines, receivables, payables,
products, product_categories, product_variants, price_versions, package_items, packages,
animals, suppliers, marketing_spends, vouchers, voucher_redemptions, deliveries, delivery_pods, delivery_tasks,
employees, departments, positions, attendance_records, payroll_runs, payroll_lines, kasbons, ziswaf_entries,
inventory_items, inventory_moves, production_batches,
kpi_indicators, kpi_targets, kpi_actuals, daily_scorecards, daily_scorecard_lines,
weekly_reviews, monthly_reviews, monthly_review_lines, business_units, sales_channels,
employee_performances, coaching_notes, corrective_actions, rewards, sops, sop_checks,
wa_alert_rules, wa_alerts_log, wa_api_keys.

## Hubungan antar-modul (ERD bird's eye)
```
users ─distinct sessions
   │
   └ user_roles ─ roles ─ role_permissions
Branches — scoped in almost every table (branchId FK).
customers ─ quotations ─ orders ─ invoices ─ payments
   ↓ order_items → product/ packages (priceVersions snapshots for quote)
   ↓ lead link (sales funnel: leads / crm_deals → customer conversions?)
crm_people / crm_deals → crm_activities (notes) → notifications (lonceng)
orders → order_status_logs; invoices → receivables; payments → journal auto via finance.account's journal_lines
production_batches ✗ not-linked to orders (manual refs only)
inventory_items ↔ inventory_moves (kartu stok) refId arbitrary token manual
delivery_tasks ↔ delivery_pods (POD unlinked to orders/production for now)
employees → attendance_records, payroll_runs/lines, kasbons, employee_performances
departments/positions/business_units/sales_channels — master data for KPI scopes &
  scorecards; kpi_targets/actuals with scopeRefId for branch filter
payroll/journal PAYROLL type enum available (no automation yet)
app_settings (key/value) — WhatsApp providers, alarm settings, shared config
wa_api_keys Multi provider key store; wa_alert_rules & log (as per Alarm module)
audit_logs from insertAudit() across key actions
```

## Integrasi
| Integrasi | Status | Keterangan |
|---|---|---|
| PostgreSQL | ✅ Neon | Postgres via drizzle + `postgres` package; `DATABASE_URL` |
| Redis (BullMQ worker wym) | ◐ | Redis dependency bertetap in package.json; infra worker service belum deploy |
| WhatsApp providers | ✅ service | Fonnte (api.fonnte.com/send) / Meta Cloud API (Graph v22.0) / WAHA local (docker run selanjutnya) |
| BSI VA webhook | ✅ | `/api/webhooks/bsi-va` + idempotency`
| Session (auth) | ✅ Auth session hitting `sessions` token hash |
| S3 file storage | ◐ | `@aws-sdk/client-s3` installed; storage.ts utilityReady |
| Mermaid | ✅ (_docs) | documentation diagrams rendered client |
| Neoscope | ◐ | MBS? (not visible in this audit) |

## Potensi masalah performa integrity
1. Tabel order/aggregat di halaman server pages: JURNAL POSTED (30k+ rows) current load; index `journals_branch_date_idx`, `journal_lines_account_idx` tersedia — rien di sini.
2. `customers.code` unik saja; phone duplicates belum unique-index (duplikasi data via demo could double create).
3. WAHA provider may return `ok: true` without verifying; check `ready: false` and gate sending before registering.
4. `api/customers/import` limit 500 (dev Amazon)? _production_vec pemuat server стоматological deeper for 2k+ rows: tool partying.
5. `journals.journal_date` timezone WIB conversions (`toJak`) sudah pattern-matched; batch insert logging (ALARMS) defined below.
6. BIGINT money formatting from Numerics using formatIDR — consistent.
