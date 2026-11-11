# 08 — Technical Audit (temuan teknis & arsitektur)

## Stack (faktak)
- **Next.js 16.4.1** (App Router, RSC, server actions, Turbopack dev) — ter-upgrade dari 16.3.3 krn RCE critical advisories (4 advisory) — ✅ patched.
- **React 19.2.8**, **zod 4.5.4+**, **drizzle-orm 0.45** + `postgres` (pg), **BullMQ + ioredis** (installed; worker service belum jalan), **sonner (toasts)**, **lucide-react**, **recharts**, **react-markdown (+mermaid client)**, **jspdf(+autotable) & xlsx (import/export)**, **@aws-sdk/client-s3**.
- Auth: session cookie `ma3_session`, token hash sha256 (tabel `sessions`), guards `lib/server/auth.ts` (`requireAuth`, `requirePermission`) & `page-auth.ts` (`requirePageUser`).
- Auditing helper: `lib/server/audit.ts` insertAudit across business actions.
- Style: Tailwind v4 (`@tailwindcss/postcss`), custom design tokens (surface, canvas, line, primary, gold …).
- Fonts: next/font variable sets (per className in layout).
- Deployment: systemd service `madani-aqiqah` (port 3100) di depan HTTPS Cloudflare (pending CDN earlier), VPS Ubuntu24 (SSH 103.107.206.10 -p 2480).

## Temuan teknis penting
| # | Severity | Area | Temuan | Bukti |
|---|---|---|---|---|
| T1 | **High** | Production/inventory link | `production_batches` tidak punya FK orderId atau items batch BOM; production→inventory move otomatis tidak berjalan (lagi manual) | schema erp-extensions.ts (production_batches, inventory_moves.refId varchar) |
| T2 | **High** | Journal automation | Hanya sales/payment jurnal otomatis; payroll & kasbon belum memicu journals (type PAYROLL enum unused) | services/hr.ts, journal.ts |
| T3 | **Medium** | Search/pagination transaksi | Orders/Invoices/Payments/Quotations tables server-side max 100–~ paginated client-side; heavy data rows watch | /orders, /invoices page.tsx |
| T4 | **Medium** | Export kumulatif | export API listCustomers max 1000 (api/customers/export/route.ts) — tidak streaming, potential istirahat di >1k rows | export route |
| T5 | **Low** | Middleware | Tidak ada `middleware.ts` authentic; security checks purely RSC level (bisa masking direct asset fetch, tidak kritis) |
| T6 | **Low** | Tokens in DB | Wa keys plaintext in wa_api_keys (could hash but must be functional for sending) |
| T7 | **Low** | Client component `wa-alarms-manager2.tsx` had `useTransition` without "use client" (fixed by adding directive) — regression risks if edited again |
| T8 | **Low** | Health | `/api/jobs/kpi` cron dipanggil on server (crontab), no dedup lock — a repeat call idempotent by design (verified) |

## Keamanan
- Login password Argon2 hash; sessions per user; `allowed-tools` permission model nitpound.
- HTTPS enforced by Cloudflare (app.madaniaqiqah.com) — reverse proxy via VPS/Nginx or direct; not part of package.json.
- CORS/CSP belum dikonfigurasi khusus (Unknown severity — perlu audit HTTP headers).
- Env secrets trained in .env; local backups limited to Vps.

## Build & deploy quality
- `npm run build` sukses bersih setelah tiap deploy; `tsc --noEmit` bersih.
- File uploads (photos, docs) tidak dilan aside: audit tidak melihat upload helper (kecuali avatar? no)
- Test: tidak ada unit tests business (vitest dep dev tapi hanya kilka minimal ritel) — `vitest` dep installed; no tests found — this is a **High** issue for future refactor safety.
- Documentation: `/docs` cadangan ada (4 docs + mermaid diag + tutorial — highlighted paging) user-visible.

## Arsitektur yang bagus (dipertahankan)
- RSC-first pages: fewer client bundles; server action for mutations (type safety end-to-end via zod + drizzle inferred types).
- Reusable table `data-table.tsx` + export strip & services patterns easily reusable per module.
- Adok `erp-extensions.ts` keeps new feature boundary clean.
- Shared permission lib (`lib/permissions.ts`) & design tokens.
