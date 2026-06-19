# Fancy RSVP — Super Admin Control Center: File-Level Master Plan

> **Status:** Planning artifact. No application code written. Produced from a grounded
> audit of the real codebase (15 tables, 13 backend controllers, 95 frontend files).
> Scope: all 25 Super Admin sections + the four critical foundations
> (money correctness, RBAC/security, admin UX rebuild, scale/performance).
>
> **Approval gate:** Implementation begins only after sign-off on this document.

---

## 0. Conventions & Stack Decisions (apply to every section)

| Concern | Decision | Rationale |
|---|---|---|
| Backend language | Stay **JavaScript/Express** (no TS rewrite) | Match existing 13 controllers; a TS migration is its own project. Add JSDoc + Zod-style runtime validation instead. |
| Validation | Adopt `express-validator` **on every new admin route** (already a dependency) | Auth routes already use it; eliminates hand-rolled checks. |
| Authorization | Replace binary `requireSuperAdmin` with `requirePermission('<perm>')` | Enables the 6-role matrix (§18) without rewriting route mounting. |
| List endpoints | Universal `?page&limit&sort&order&q&filter[...]` contract + `{ data, pagination }` envelope | Fixes B3 (no pagination today). |
| Heavy aggregates | Move to **Postgres RPCs / materialized views**, never JS full-scans | Fixes B2. |
| Frontend | Next.js 14 App Router, **JavaScript** `.js` (match repo). Read `node_modules/next/dist/docs/` first per `frontend/AGENTS.md`. | Consistency + the repo's explicit warning. |
| Admin UI shell | Refactor monolith `admin/page.js` → `app/admin/(panel)/<section>/page.js` route segments + shared primitives | One 700-line file cannot host 25 sections. |
| Secrets at rest | New `integration_credentials` rows **encrypted** with `pgcrypto` / app-side AES | API keys (§12) must not be plaintext. |
| Migrations | Continue `supabase/migrations/YYYYMMDDHHMMSS_name.sql`, sequential from `20260619000000` | Matches existing convention. |
| Background work | Introduce a lightweight job runner (`pg-boss` on the existing Postgres) | Needed for broadcasts, backups, analytics rollups, bulk invites. No new infra. |
| Audit | Every admin mutation calls `logAdminAction(req, {...})` writing `admin_audit_logs` w/ IP + UA | §17 requires IP/device/browser. |

### Naming map for new backend files
```
backend/
  middleware/
    permissions.js        # requirePermission(), loadPermissions()
    adminAudit.js         # logAdminAction(), captureRequestMeta()
    pagination.js         # parsePagination(), buildListResponse()
  controllers/admin/
    overviewController.js        cmsController.js
    authConfigController.js      userMgmtController.js
    organizerController.js       eventAdminController.js
    invitationCenterController.js guestAdminController.js
    paymentCenterController.js   creditController.js
    subscriptionController.js    platformConfigController.js
    featureFlagController.js     notificationCenterController.js
    supportController.js         analyticsController.js
    auditController.js           rbacController.js
    securityController.js        systemHealthController.js
    aiInsightsController.js      financeController.js
    marketingController.js       dataMgmtController.js
    operationsController.js
  routes/admin/
    index.js              # mounts all sub-routers under /api/v1/admin
    <one file per controller above>
  services/
    stripeRefundService.js  encryptionService.js  jobQueue.js
    cmsService.js           rbacService.js         analyticsService.js
  jobs/
    broadcast.job.js  backup.job.js  analyticsRollup.job.js  invitation.job.js
```

### Naming map for new frontend files
```
frontend/src/app/admin/
  layout.js                      # sidebar + topbar shell, permission-gated nav
  (panel)/overview/page.js
  (panel)/cms/page.js            (panel)/cms/[block]/page.js
  (panel)/auth-config/page.js
  (panel)/users/page.js          (panel)/users/[id]/page.js
  (panel)/organizers/page.js     (panel)/organizers/[id]/page.js
  (panel)/events/page.js         (panel)/events/[id]/page.js
  (panel)/invitations/page.js
  (panel)/guests/page.js
  (panel)/payments/page.js
  (panel)/credits/page.js
  (panel)/subscriptions/page.js
  (panel)/config/page.js
  (panel)/feature-flags/page.js
  (panel)/notifications/page.js
  (panel)/support/page.js        (panel)/support/[ticket]/page.js
  (panel)/analytics/page.js
  (panel)/audit/page.js
  (panel)/roles/page.js
  (panel)/security/page.js
  (panel)/health/page.js
  (panel)/insights/page.js
  (panel)/finance/page.js
  (panel)/marketing/page.js
  (panel)/data/page.js
  (panel)/operations/page.js
  _components/                   # shared admin primitives
    AdminShell.js  Sidebar.js  DataTable.js  FilterBar.js  StatCard.js
    Chart.js  Drawer.js  BulkActionBar.js  ConfirmDialog.js  PermissionGate.js
  _hooks/
    useAdminQuery.js  usePagination.js  usePermissions.js
  _lib/
    adminApi.js   # thin wrapper over utils/apiClient for /admin/*
```

---

## 1. Database Master Schema (all new tables, by domain)

Each migration file is listed with the tables/columns it introduces. RLS: every new
table gets RLS enabled; admin tables are service-role-only (backend bypasses RLS, so
RLS here is a hard deny for any anon/auth client).

### 1.1 RBAC & Admin Identity — `20260619000000_rbac_foundation.sql`
```sql
roles(id, key UNIQUE, name, description, is_system BOOL, created_at)
permissions(id, key UNIQUE, group, description)         -- e.g. 'billing.refund'
role_permissions(role_id, permission_id, PK(role_id,permission_id))
admin_users(id, user_id UNIQUE FK auth.users, status, mfa_enabled, last_login_at, created_at)
admin_user_roles(admin_user_id, role_id, PK)            -- many-to-many
-- Seed 6 roles: super_admin, admin, finance_manager, operations_manager,
--               marketing_manager, support_agent + full permission catalog.
-- Migrate existing user_roles.role='super_admin' rows into admin_users + super_admin role.
```

### 1.2 Sessions, Devices, Security — `20260619010000_sessions_security.sql`
```sql
sessions(id, user_id, jti UNIQUE, ip, user_agent, device_label,
         created_at, last_seen_at, revoked_at, expires_at)
login_history(id, user_id, email, ip, user_agent, success BOOL,
              failure_reason, created_at)
devices(id, user_id, fingerprint, label, trusted BOOL, first_seen, last_seen)
security_events(id, user_id, type, severity, ip, metadata JSONB, created_at)
ALTER organizations ADD COLUMN status TEXT DEFAULT 'active'
    CHECK (status IN ('active','suspended','banned'));
ALTER organizations ADD COLUMN suspended_reason TEXT, suspended_at TIMESTAMPTZ;
-- JWT gains `jti` claim; requireAuth checks sessions.revoked_at IS NULL.
```

### 1.3 Audit (IP/device/browser) — `20260619020000_admin_audit.sql`
```sql
admin_audit_logs(id, actor_user_id, actor_role, action, entity_type, entity_id,
                 ip, user_agent, browser, os, before JSONB, after JSONB,
                 metadata JSONB, created_at)
CREATE INDEX ON admin_audit_logs(created_at DESC);
CREATE INDEX ON admin_audit_logs(actor_user_id, created_at DESC);
-- activity_logs stays for organizer/event scope; admin_audit_logs is platform scope.
```

### 1.4 Platform Settings, Feature Flags, Integrations — `20260619030000_platform_config.sql`
```sql
platform_settings(key PK, value JSONB, group, updated_by, updated_at)  -- replaces single-row blob
feature_flags(key PK, enabled BOOL, description, rollout_pct INT DEFAULT 100,
              audience JSONB, updated_by, updated_at)
integration_credentials(id, provider, label, encrypted_secret BYTEA,
                        meta JSONB, is_active BOOL, updated_by, updated_at)
-- Seed flags: sms, email, qr, rsvp, payments, registration, ai_features, social_login.
-- Migrate super_admin_config (pricing/sms-rate/manual-methods) into platform_settings rows.
```

### 1.5 Subscriptions & Plans — `20260619040000_subscriptions.sql`
```sql
plans(id, key UNIQUE, name, description, price_cents, interval,
      features JSONB, max_guests, max_events, is_active BOOL, sort_order)
subscriptions(id, org_id FK, plan_id FK, status, current_period_start,
              current_period_end, stripe_subscription_id, cancel_at, created_at)
-- pricing_tiers JSON from super_admin_config seeds the plans table.
```

### 1.6 Generalized Credits — `20260619050000_credits.sql`
```sql
credit_wallets(id, org_id FK, type CHECK(type IN('sms','email','qr')),
               purchased INT, used INT, remaining GENERATED, UNIQUE(org_id,type))
credit_ledger(id, wallet_id FK, type, transaction_type, amount,
              reference, metadata JSONB, created_at)
credit_packages(id, type, name, credits, price_cents, bonus_credits, is_active)
-- Backfill: existing sms_credit_wallets -> credit_wallets(type='sms'); keep old table read-compat via view.
```

### 1.7 CMS — `20260619060000_cms.sql`
```sql
cms_pages(id, slug UNIQUE, title, status, seo JSONB, updated_by, updated_at)
cms_blocks(id, page_id FK, type, position INT, content JSONB, is_visible BOOL)
cms_media(id, url, alt, type, size_bytes, uploaded_by, created_at)
banners(id, location, content JSONB, starts_at, ends_at, is_active, priority)
-- Seed cms_pages from current hardcoded landing sections (hero/features/pricing/faq/footer).
```

### 1.8 Notifications & Invitation Funnel — `20260619070000_notifications.sql`
```sql
notification_templates(id, key UNIQUE, channel CHECK(channel IN('email','sms','push','inapp')),
                       subject, body, variables JSONB, is_active, updated_by)
broadcasts(id, title, channel, audience JSONB, template_id, status,
           scheduled_at, sent_count, created_by, created_at)
notification_log(id, channel, recipient, template_key, status
                 CHECK(status IN('queued','sent','delivered','opened','clicked','bounced','failed')),
                 provider_id, event_id, rsvp_id, error, created_at, updated_at)
inapp_notifications(id, user_id, title, body, read_at, created_at)
-- notification_log powers Invitation Center funnel (§7) sent/delivered/opened/clicked.
ALTER rsvps ADD COLUMN delivery_status TEXT, opened_at TIMESTAMPTZ, clicked_at TIMESTAMPTZ;
```

### 1.9 Support Center — `20260619080000_support.sql`
```sql
support_tickets(id, org_id, subject, body, category, priority, status,
                assigned_to, sla_due_at, resolved_at, created_at)
ticket_messages(id, ticket_id FK, author_id, author_type, body, attachments JSONB, created_at)
ticket_events(id, ticket_id, type, actor_id, metadata, created_at)  -- assignment/status history
```

### 1.10 Marketing — `20260619090000_marketing.sql`
```sql
coupons(id, code UNIQUE, type CHECK(type IN('percent','fixed')), value,
        max_redemptions, redeemed_count, valid_from, valid_until, is_active)
coupon_redemptions(id, coupon_id, org_id, payment_id, amount_discounted, created_at)
campaigns(id, name, channel, audience JSONB, status, metrics JSONB, created_at)
referrals(id, referrer_org_id, referred_org_id, code, reward_status, created_at)
```

### 1.11 Guest Tags/Groups/VIP — `20260619100000_guest_management.sql`
```sql
guest_tags(id, event_id, name, color)
rsvp_tags(rsvp_id, tag_id, PK)
guest_groups(id, event_id, name)
ALTER rsvps ADD COLUMN group_id UUID FK guest_groups, is_vip BOOL DEFAULT false;
```

### 1.12 Analytics & Finance rollups — `20260619110000_analytics_rollups.sql`
```sql
-- Materialized views (refreshed by analyticsRollup.job):
mv_daily_revenue(day, gross_cents, net_cents, refunded_cents, fee_cents, tax_cents)
mv_event_funnel(event_id, invited, sent, opened, confirmed, declined, attended)
mv_platform_kpis(snapshot_date, events, orgs, rsvps, revenue_cents, sms_used, ...)
-- RPC get_executive_overview() replaces the JS full-scan in getPlatformOverview (B2 fix).
```

### 1.13 Stripe refund correctness — `20260619120000_payment_refunds.sql`
```sql
ALTER event_payments ADD COLUMN stripe_refund_id TEXT,
      refund_amount_cents INT, refunded_at TIMESTAMPTZ, refunded_by UUID;
payment_disputes(id, payment_id, stripe_dispute_id, status, amount_cents, reason, created_at);
```

---

## 2. Cross-Cutting Foundations (build FIRST — everything depends on them)

### F1. RBAC engine
- **DB:** §1.1. **Backend:** `middleware/permissions.js` (`requirePermission(key)` loads the
  actor's roles→permissions, caches per-request), `services/rbacService.js`,
  `controllers/admin/rbacController.js` (CRUD roles/permissions/assignments).
- **Auth change:** `middleware/auth.js` `requireAuth` resolves `req.user.permissions` (cached
  ~60s in-memory keyed by user) — also fixes **B4** (2 queries/request) via caching.
- **Frontend:** `_components/PermissionGate.js`, `_hooks/usePermissions.js`; sidebar nav filters by permission.

### F2. Sessions & audit
- **DB:** §1.2, §1.3. JWT gains `jti`; `requireAuth` validates against `sessions`. Logout/revoke
  set `revoked_at`. `middleware/adminAudit.js` parses UA → browser/os, captures IP, wraps mutations.

### F3. Admin UI shell + primitives
- `app/admin/layout.js` (AdminShell), `_components/*` (Sidebar, DataTable, FilterBar, StatCard,
  Chart, Drawer, BulkActionBar, ConfirmDialog), `_hooks/useAdminQuery.js`, `_lib/adminApi.js`.
- Migrate the 9 existing tabs out of `admin/page.js` into route segments using the new shell.

### F4. Pagination + list envelope
- `middleware/pagination.js`; retrofit existing `listAllPayments`, `listOrganizations`,
  `listPlatformUsers`, `listSmsWallets`, `getGlobalActivity` (**B3 fix**).

### F5. Job queue
- `services/jobQueue.js` (pg-boss on existing Postgres) + `jobs/*`. Used by broadcasts, backups, rollups.

---

## 3. Per-Section Implementation Spec (all 25)

> Format per section: **DB** (migration) · **API** (route file + endpoints) · **FE** (page/components) · **Notes**.
> Sections reuse foundations F1–F5; only net-new files are listed.

### §1 Executive Overview — *enhance*
- **DB:** §1.12 `mv_platform_kpis`, RPC `get_executive_overview(range)`.
- **API:** `routes/admin/overview.js` → `GET /overview?range=daily|weekly|monthly|annual`, `GET /overview/forecast`.
- **FE:** `(panel)/overview/page.js` using StatCard grid + Chart (revenue trend, funnel, heatmap).
- **Notes:** Replaces `getPlatformOverview` JS scan (**B2**). Add daily/weekly/annual splits + simple linear forecast.

### §2 Landing Page CMS — *new*
- **DB:** §1.7. **API:** `routes/admin/cms.js` → CRUD `/cms/pages`, `/cms/pages/:id/blocks`, `/cms/media`, `/cms/banners`.
- **FE:** `(panel)/cms/page.js` (page list), `(panel)/cms/[block]/page.js` (block editor w/ live preview).
- **Public side:** refactor `components/landing/*` to read from `cms_pages`/`cms_blocks` via a new
  `GET /api/v1/public/cms/:slug`; keep hardcoded copy as seed/fallback.

### §3 Authentication Management — *new (config layer)*
- **DB:** `platform_settings` rows (`auth.otp`, `auth.password_policy`, `auth.session`, `auth.social`).
- **API:** `routes/admin/authConfig.js` → `GET/PATCH /auth-config`.
- **Backend wiring:** `authController` reads policy from settings (OTP on/off, min length, lockout thresholds, Google toggle).
- **FE:** `(panel)/auth-config/page.js` (toggles + policy form).

### §4 User Management — *enhance*
- **DB:** §1.2 (`organizations.status`, sessions, login_history, devices).
- **API:** `routes/admin/users.js` → `GET /users` (paginated, search/filter), `GET /users/:id`,
  `PATCH /users/:id` (edit), `POST /users/:id/suspend|ban|restore`, `DELETE /users/:id`,
  `GET /users/:id/sessions`, `POST /users/:id/sessions/:sid/revoke`, `GET /users/:id/login-history`.
- **FE:** `(panel)/users/page.js` (DataTable + BulkActionBar), `(panel)/users/[id]/page.js` (profile, devices, sessions, history tabs).

### §5 Organizer Management — *enhance*
- **API:** `routes/admin/organizers.js` → `GET /organizers` (paginated), `GET /organizers/:id`
  (revenue/events/guests/credits/sms/rsvp aggregates), `PATCH`, `POST /:id/suspend|activate|reset-password`,
  `POST /:id/impersonate` (issues short-lived scoped session + audit), `DELETE /:id`.
- **FE:** `(panel)/organizers/page.js`, `(panel)/organizers/[id]/page.js`.
- **Notes:** Impersonation writes `security_events` + `admin_audit_logs`; banner in organizer UI while impersonating.

### §6 Event Management — *enhance*
- **API:** `routes/admin/events.js` → existing `GET/PATCH/DELETE` + `POST /events` (admin create),
  `POST /events/:id/duplicate|archive|cancel`, `GET /events/:id/analytics`.
- **FE:** `(panel)/events/page.js`, `(panel)/events/[id]/page.js` (analytics/revenue/attendance/guests).

### §7 Invitation Center — *new (tracking)*
- **DB:** §1.8 (`notification_log` + rsvps delivery columns). Edge functions `send-email`/`send-sms`
  write provider IDs + status; add a `notification_log` webhook for delivered/opened/clicked.
- **API:** `routes/admin/invitations.js` → `GET /invitations/funnel`, `GET /invitations?channel=&status=`.
- **FE:** `(panel)/invitations/page.js` (funnel chart sent→delivered→opened→clicked→confirmed/declined).

### §8 Guest Management — *new*
- **DB:** §1.11. **API:** `routes/admin/guests.js` → tags/groups CRUD, `PATCH /guests/:rsvpId` (vip/group/tags), bulk tag.
- **FE:** `(panel)/guests/page.js` (cross-event guest table, VIP filter, tag/group management).

### §9 Payment Center — *enhance + B1 fix*
- **DB:** §1.13. **Backend:** `services/stripeRefundService.js` (real `stripe.refunds.create`).
- **API:** `routes/admin/payments.js` → paginated `GET /payments`, `POST /:id/refund` (REAL refund),
  `GET /payments/disputes`, `GET /payments/failed|pending`. Stripe webhook handles `charge.dispute.created`.
- **FE:** `(panel)/payments/page.js` (filters: status/method/dispute; refund confirm dialog).
- **Notes:** **B1 fixed** — refund now calls Stripe, records `stripe_refund_id`, then flips status.

### §10 Credit Management — *generalize*
- **DB:** §1.6. **API:** `routes/admin/credits.js` → wallets list (sms/email/qr), `POST /credits/grant`,
  `POST /credits/deduct`, `POST /credits/bonus`, packages CRUD.
- **FE:** `(panel)/credits/page.js`. **Notes:** Generalizes current SMS-only `grantSmsCredits`.

### §11 Subscription Management — *new*
- **DB:** §1.5. **API:** `routes/admin/subscriptions.js` → plans CRUD + enable/disable, `GET /subscriptions`.
- **FE:** `(panel)/subscriptions/page.js`. **Notes:** Plans become first-class; `super_admin_config.pricing_tiers` deprecated to seed.

### §12 Platform Configuration — *new*
- **DB:** §1.4 (`platform_settings`, `integration_credentials` encrypted via `services/encryptionService.js`).
- **API:** `routes/admin/config.js` → branding, SMTP, SMS provider, payment provider, API keys (masked on read).
- **FE:** `(panel)/config/page.js` (grouped settings forms; secret fields write-only).

### §13 Feature Flags — *new*
- **DB:** §1.4 (`feature_flags`). **Backend:** `services/featureFlags.js` (`isEnabled(key)`), gate routes/edge.
- **API:** `routes/admin/featureFlags.js` → `GET/PATCH /feature-flags`.
- **FE:** `(panel)/feature-flags/page.js` (toggle grid). **Notes:** No redeploy to flip sms/email/qr/payments/registration/ai.

### §14 Notification Center — *new*
- **DB:** §1.8. **API:** `routes/admin/notifications.js` → templates CRUD, `POST /broadcasts` (queued via job),
  announcements, maintenance alerts. `jobs/broadcast.job.js` does the sending.
- **FE:** `(panel)/notifications/page.js` (template editor + broadcast composer + audience picker).

### §15 Support Center — *new*
- **DB:** §1.9. **API:** `routes/admin/support.js` → tickets CRUD, assign, reply, status, SLA metrics.
- **FE:** `(panel)/support/page.js` (queue), `(panel)/support/[ticket]/page.js` (thread + assignment + SLA timer).

### §16 Analytics Center — *enhance*
- **DB:** §1.12 materialized views. **Backend:** `services/analyticsService.js`, `excelHelper`/PDF export.
- **API:** `routes/admin/analytics.js` → revenue/rsvp/conversion/funnel/attendance/organizer-performance + `GET /analytics/export?format=csv|xlsx|pdf`.
- **FE:** `(panel)/analytics/page.js` (chart board + export buttons).

### §17 Audit Logs — *enhance*
- **DB:** §1.3 (`admin_audit_logs` w/ IP/UA/browser). **API:** `routes/admin/audit.js` → paginated search/filter + export.
- **FE:** `(panel)/audit/page.js` (filterable table: actor/action/entity/IP/device/time).

### §18 Role & Permission System — *new (F1)*
- **DB:** §1.1. **API:** `routes/admin/rbac.js` → roles CRUD, permission catalog, assign roles to admins.
- **FE:** `(panel)/roles/page.js` (role list + permission matrix checkboxes).
- **Notes:** 6 seeded roles; `requirePermission` enforced platform-wide.

### §19 Security Center — *new*
- **DB:** §1.2 (`security_events`). **Backend:** anomaly rules (impossible travel, burst logins) writing `security_events`.
- **API:** `routes/admin/security.js` → active sessions, device monitor, security events, rate-limit status.
- **FE:** `(panel)/security/page.js`. **Notes:** Reuses sessions/devices/login_history from F2.

### §20 System Health — *enhance*
- **API:** `routes/admin/health.js` → extend `/health` to probe DB, job queue, storage, email, SMS provider.
- **FE:** `(panel)/health/page.js` (status cards + latency, auto-refresh).

### §21 AI Insights — *new*
- **Backend:** `services/aiInsightsService.js` using **Claude (`claude-opus-4-8`)** via Anthropic SDK over the
  analytics rollups → revenue predictions, churn detection, growth/risk alerts. Gated by `ai_features` flag (§13).
- **API:** `routes/admin/insights.js` → `GET /insights` (cached daily via job).
- **FE:** `(panel)/insights/page.js` (insight cards). **Notes:** Confirm Anthropic key handling via `integration_credentials`.

### §22 Financial Command Center — *enhance*
- **DB:** §1.12 (`mv_daily_revenue` w/ net/fee/tax). **API:** `routes/admin/finance.js` → gross/net/profit/outstanding/taxes/refund-trends + forecast.
- **FE:** `(panel)/finance/page.js` (financial KPIs + forecast chart).

### §23 Marketing Center — *new*
- **DB:** §1.10. **API:** `routes/admin/marketing.js` → coupons CRUD + redemption tracking, campaigns, referrals.
- **Backend:** coupon validation hook in `paymentController` checkout.
- **FE:** `(panel)/marketing/page.js`.

### §24 Data Management — *new*
- **Backend:** `jobs/backup.job.js` (scheduled `pg_dump` to storage), `services/dataMgmtService.js` (import/export).
- **API:** `routes/admin/data.js` → `POST /data/export`, `POST /data/import`, `POST /backups`, `GET /backups`, `POST /backups/:id/restore`.
- **FE:** `(panel)/data/page.js` (backup history + schedule config).

### §25 Platform Operations Center — *new*
- **DB:** reuse `login_history`, `sessions`, `activity_logs`, `mv_platform_kpis`.
- **API:** `routes/admin/operations.js` → active users (live sessions), event-creation trends, resource usage.
- **FE:** `(panel)/operations/page.js` (real-time-ish ops dashboard).

---

## 4. Phased Sequencing (with explicit file checklist)

### Phase 0 — Foundations (blocks everything) 🔴
- [ ] §1.1 RBAC migration + seed · `middleware/permissions.js` · `rbacController/routes` · `PermissionGate.js`
- [ ] §1.2/§1.3 sessions+audit migrations · `middleware/adminAudit.js` · `auth.js` jti/cache (B4)
- [ ] F3 admin shell: `app/admin/layout.js` + `_components/*` + `_lib/adminApi.js`
- [ ] F4 `middleware/pagination.js` + retrofit 5 existing list endpoints (B3)
- [ ] F5 `services/jobQueue.js`

### Phase 1 — Money correctness 🔴 (your top focus)
- [ ] §1.13 migration · `services/stripeRefundService.js` · Payment Center §9 (real refunds = **B1**)
- [ ] §1.5 subscriptions + §11 plans · §1.6 credits + §10
- [ ] §22 Finance + §1.12 `mv_daily_revenue` · §1 Overview RPC (**B2**)

### Phase 2 — RBAC & Security 🔴 (your top focus)
- [ ] §18 roles UI · §4 user lifecycle (suspend/ban/sessions) · §5 organizer + impersonation
- [ ] §19 Security Center · §17 Audit UI · §20 System Health

### Phase 3 — UX-heavy operational tools 🟠
- [ ] §6 events · §7 invitation funnel · §8 guests · §16 analytics + export · §25 operations

### Phase 4 — Platform control 🟠
- [ ] §12 config + integrations · §13 feature flags · §3 auth-config · §14 notifications

### Phase 5 — Growth & extras 🟡
- [ ] §2 CMS · §15 support · §23 marketing · §24 data/backup · §21 AI insights

---

## 5. Risks, Migrations & Compatibility

| Risk | Mitigation |
|---|---|
| `super_admin_config` single-row blob is read in `paymentController`/pricing | Keep table; migrate values into `platform_settings`; dual-read shim until callers updated |
| Existing `user_roles` (organizer/super_admin) referenced in `auth.js` | Migrate super_admins into `admin_users`; keep `user_roles` for organizer flag during transition |
| `sms_credit_wallets` used across SMS flow | Backfill into `credit_wallets`; expose a compat **view** named `sms_credit_wallets` |
| Stateless JWT has no revocation today | Add `jti` + `sessions` check; existing tokens treated as valid until 24h expiry (no forced logout) |
| Service-role key bypasses RLS | All admin tables RLS-deny anon; backend is the only writer; encryption for secrets |
| `frontend/AGENTS.md` warns Next.js differs | Read `node_modules/next/dist/docs/` before each FE change |
| Big-bang admin refactor | Strangler pattern: new shell mounts alongside old `admin/page.js`; migrate tab-by-tab |

---

## 6. Definition of Done (per section)
1. Migration applied + RLS verified. 2. Endpoints paginated, validated (`express-validator`),
permission-gated, audit-logged. 3. Frontend page in new shell, responsive, permission-aware nav.
4. Unit tests for services/helpers (match existing `backend/test/` pattern). 5. No full-table scans.
6. Secrets never returned in plaintext.

---

*End of master plan. Awaiting approval to begin Phase 0.*
