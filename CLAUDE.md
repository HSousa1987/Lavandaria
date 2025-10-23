# CLAUDE.md

## Mandatory as an autonomous agent you will:
1. Call vibe_check after planning and before major actions.
2. Provide the full user request and your current plan
3. Opcionally, record resolved issues with vibe_learn

---

## Project Overview

**Lavandaria** is a dual-business management system serving:
1. **Laundry Service** - Traditional clothing cleaning with order tracking and itemization
2. **Property Cleaning Service** - Airbnb/house cleaning with photo verification and time tracking

### Core Capabilities
- **Multi-Role User Management**: Master → Admin → Worker → Client hierarchy
- **Order Lifecycle Management**: Status tracking from intake to completion
- **Photo Verification**: Before/after/detail photos with client viewing tracking
- **Time Tracking**: Worker clock-in/out with manual entry support
- **Financial Management**: Split payment tables for referential integrity
- **Notification System**: Client alerts for order status changes

---

## Role Boundaries & Expectations

### Four-Tier Permission Model

**Master (Owner)**
- Full system access
- Can create admins
- Finance access
- User management: all roles

**Admin (Manager)**
- Can create workers & clients
- Manage all orders and jobs
- Finance access
- Cannot create other admins

**Worker (Field Operations)**
- View assigned jobs only
- Upload photos to assigned jobs
- Track time for assigned jobs
- **NO finance access**

**Client (Customer)**
- View own orders (read-only)
- View photos for own jobs
- Provide feedback/ratings

---

## Request/Response & Correlation ID Conventions

### Standardized Response Envelope

All API responses follow this pattern:

```javascript
{
  "success": true|false,
  "data": { ... },      // or "error": "message"
  "_meta": {
    "timestamp": "2025-10-23T01:23:45.678Z",
    "correlationId": "req_1729..."
  }
}
```

### Correlation IDs

Every request receives a unique correlation ID for tracing:

```http
X-Correlation-Id: req_1729638225678_abc123
```

**Usage:**
- Included in all log messages
- Returned in error responses
- Essential for debugging failed requests

**Example:**
```bash
# Search logs by correlation ID
docker-compose logs -f app | grep "req_1729638225678"
```

---

## Terminal-First Testing Workflow

### Recommended Test Sequence

**1. Seed Test Data**
```bash
npm run test:seed
```
Creates: master, admin, worker1, client with known passwords

**2. Run E2E Tests (Headless)**
```bash
npm run test:e2e
```
Runs all Playwright tests in terminal, collects screenshots/traces

**3. View Results**
```bash
npm run test:e2e:report
```
Opens HTML report in browser

**4. Debug Failures (Playwright UI)**
```bash
npm run test:e2e:ui
```
Opens Playwright UI for trace replay and debugging

### Test Coverage

| Suite | File | Scenarios |
|-------|------|-----------|
| Worker Photo Upload | `tests/e2e/worker-photo-upload.spec.js` | Batch uploads, RBAC, invalid files |
| Client Photo Viewing | `tests/e2e/client-photo-viewing.spec.js` | Pagination, viewing tracking |
| RBAC & Sessions | `tests/e2e/rbac-and-sessions.spec.js` | Finance restrictions, session persistence |
| Tab Navigation | `tests/e2e/tab-navigation.spec.js` | Keyboard accessibility |

---

## Using MCPs in This Repository

### PostgreSQL-RO MCP

**Purpose:** Database schema inspection, query analysis, performance monitoring

**Connection String:**
```bash
postgresql://lavandaria:lavandaria2025@localhost:5432/lavandaria
```

**Common Operations:**
```bash
# Get schema info
pg_manage_schema --operation get_info

# Analyze index usage
pg_manage_indexes --operation analyze_usage --showUnused true

# List constraints
pg_manage_constraints --operation get

# Monitor database
pg_monitor_database --includeQueries true
```

### Playwright MCP

**Purpose:** E2E testing with browser automation

**Common Operations:**
```bash
# Navigate and snapshot
browser_navigate --url http://localhost:3000
browser_snapshot

# Interact with elements
browser_click --element "Login button" --ref <ref>
browser_type --element "Username field" --ref <ref> --text "admin"

# Take screenshots
browser_take_screenshot --filename "test-result.png"
```

### Context7 MCP

**Purpose:** Domain terminology validation and code snippet discovery

**Library ID:** `/hsousa1987/lavandaria` (494 code snippets)

**Common Operations:**
```bash
# Validate workflows
get-library-docs --context7CompatibleLibraryID /hsousa1987/lavandaria \
  --topic "order lifecycle workflows"

# Get code examples
get-library-docs --context7CompatibleLibraryID /hsousa1987/lavandaria \
  --topic "photo upload patterns" --tokens 3000
```

### Linear MCP (if configured)

**Purpose:** Issue tracking and project management

**Common Operations:**
```bash
# Create issue for bug
linear_create_issue --title "P1: Client photo viewing pagination failure" \
  --description "..." --priority 1

# Link issue to PR
linear_link_issue --issueId <id> --prUrl <url>
```

### Vibe Check MCP

**Purpose:** Autonomous agent validation and learning feedback loop

**Installation:**
```bash
# Already installed globally and configured in .claude.json
npm list -g @pv-bhat/vibe-check-mcp
```

**Required Usage Pattern:**

As mandated at the top of this file, Claude must:
1. Call `vibe_check` after planning and before major actions
2. Provide the full user request and current plan
3. Optionally record resolved issues with `vibe_learn`

**Common Operations:**
```bash
# Validate plan before execution (MANDATORY)
vibe_check --userRequest "Diagnose P0 auth failure" \
  --plan "1. Evidence sweep 2. Flow inspection 3. Hypothesis testing..."

# Record successful resolution pattern (OPTIONAL)
vibe_learn --issue "Session cookies not persisting across requests" \
  --resolution "Added SameSite=lax and domain=localhost to cookie options" \
  --category "authentication"
```

**Verification:**
```bash
# After restarting Claude Code, verify connection
/mcp  # Should list 'vibe-check' as connected

# Run verification script
./scripts/verify-vibe-check.sh
```

---

## Docs Auto-Update Contract

### Mandatory Documentation Updates

Before considering **any task done**, update and commit:

**1. [docs/progress.md](docs/progress.md)**
- Today's "Planned / Doing / Done" with links to PRs and test artifacts

**2. [docs/decisions.md](docs/decisions.md)**
- Any policy or behavior choices made (context, options, decision, consequences)

**3. [docs/bugs.md](docs/bugs.md)**
- Evidence, root cause, fix summary, tests added, PR link for each bug

**4. [docs/architecture.md](docs/architecture.md)**
- Any change in states, flows, or relationships discovered

**5. [docs/security.md](docs/security.md)**
- Checklist notes when auth/sessions/uploads/CORS/rate limits/logging are touched

**6. [README.md](README.md)**
- Update glossary/index if entry points or doc locations changed

**Commit Message Pattern:**
```bash
git commit -m "docs: auto-update progress/decisions/bugs (+refs)"
# or
git commit -m "docs: no-op update" # if nothing changed
```

---

## Security Minimums

### Authentication & Authorization

**Session Management:**
- PostgreSQL-backed sessions (persistent, scalable)
- HTTP-only cookies (XSS protection)
- SameSite=lax (CSRF mitigation)
- 30-day session duration

**Password Security:**
- Bcrypt hashing (cost factor 10)
- Default passwords force change (`must_change_password`)
- No plaintext passwords in logs

**RBAC Enforcement:**
- Middleware level: `requireAuth`, `requireMaster`, `requireFinanceAccess`, etc.
- Query level: Role-specific WHERE clauses

### Input Validation & Injection Prevention

**SQL Injection:**
- 100% parameterized queries (`$1`, `$2`, etc.)
- No string concatenation in SQL

**File Upload Security:**
- Type whitelist: JPEG, JPG, PNG, GIF only
- 10MB file size limit per upload
- Batch limit: 10 files per request

**Rate Limiting:**
- Login endpoints: 5 attempts per 15 minutes per IP
- Returns 429 status with `retryAfter` seconds

### Network Security

**CORS:**
- Whitelist approach (`CORS_ORIGINS` env var)
- Credentials enabled (cookies)
- No wildcard origins

**HTTP Headers (Helmet.js):**
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff

### Open Security Items

**High Priority:**
1. **HTTPS Enforcement (Production)** - Deploy behind reverse proxy with SSL/TLS
2. **Database User Separation** - Create read-only user for queries
3. **API Key for Mobile/External Integrations** - Implement JWT or API key auth

**Medium Priority:**
4. **Two-Factor Authentication (2FA)** - Add TOTP for Master/Admin roles
5. **Password Complexity Requirements** - Enforce length, character variety
6. **Dependency Vulnerability Scanning** - Automate with Dependabot/Snyk

---

## Photo Policy

### Upload Policy

**Unlimited Total Photos per Job**
- No limit on total number of photos
- Supports comprehensive documentation

**Batch Cap: 10 Files per Request**
- Practical limit for single upload operation
- Prevents server overload
- Multiple batches allowed

**File Constraints:**
- **Max size**: 10MB per file
- **Allowed types**: JPEG, JPG, PNG, GIF
- **Validation**: Multer fileFilter + extension check

### Access Control

**Worker Upload:**
- Workers can only upload photos to **assigned jobs**
- Query-level filtering: `WHERE worker_id = $1`
- RBAC enforced via middleware

**Client Viewing:**
- Clients can only view photos for **their own jobs**
- Query-level filtering: `WHERE client_id = $1`
- Pagination for large photo sets
- Viewing status tracked (`viewed_by_client`, `viewed_at`)

### Error Handling

All negative cases emit standardized error envelopes:

```javascript
{
  "success": false,
  "error": "BATCH_LIMIT_EXCEEDED",
  "message": "Maximum 10 files per batch",
  "_meta": {
    "correlationId": "req_...",
    "timestamp": "..."
  }
}
```

**Error Cases:**
- Over-batch (>10 files)
- Invalid type/size
- Unauthorized (not assigned)
- Wrong ownership (client viewing another's job)

---

## Domain Workflows

### Laundry Order Lifecycle

```text
received → in_progress → ready → collected
             ↓
         cancelled
```

**Status Definitions:**
- `received` - Order received from client
- `in_progress` - Being processed by worker
- `ready` - Ready for client pickup (notification sent)
- `collected` - Client picked up order
- `cancelled` - Order cancelled

**Order Types:**
- `bulk_kg` - Charged by weight (default: €3.50/kg)
- `itemized` - Individual item pricing via service catalog
- `house_bundle` - Fixed-price package

### Cleaning Job Lifecycle

```text
scheduled → in_progress → completed
     ↓
 cancelled
```

**Status Definitions:**
- `scheduled` - Job scheduled with date/time
- `in_progress` - Worker on-site, time tracking active
- `completed` - Job finished, photos uploaded
- `cancelled` - Job cancelled

**Job Types:**
- `airbnb` - Short-term rental property cleaning
- `house` - Residential house cleaning

### Photo Verification Workflow

```text
Worker Upload (10 photos/batch, unlimited total):
┌────────┐     ┌────────┐     ┌────────┐
│ before │     │ after  │     │ detail │
└────┬───┘     └────┬───┘     └────┬───┘
     │              │              │
     └──────────────┼──────────────┘
                    │
            ┌───────▼────────┐
            │ Photo Metadata │
            │ • room_area    │
            │ • caption      │
            │ • file_size_kb │
            └───────┬────────┘
                    │
            ┌───────▼────────┐
            │ Client Viewing │
            │ • viewed_by    │
            │ • viewed_at    │
            └────────────────┘
```

---

## Development Patterns

### Backend (Node.js)

**CommonJS Modules:**
```javascript
const express = require('express');
module.exports = { ... };
```

**Parameterized Queries:**
```javascript
// ✅ Correct
const result = await pool.query(
  'SELECT * FROM orders WHERE client_id = $1',
  [clientId]
);

// ❌ Never do this
const result = await pool.query(
  `SELECT * FROM orders WHERE client_id = ${clientId}`
);
```

**Correlation IDs in Logs:**
```javascript
console.log(`[${correlationId}] Order created: ${orderId}`);
```

**Standard Response Envelope:**
```javascript
return res.json({
  success: true,
  data: { order },
  _meta: {
    timestamp: new Date().toISOString(),
    correlationId: req.correlationId
  }
});
```

### Frontend (React)

**ES6 Modules:**
```javascript
import React from 'react';
export default Component;
```

**Tailwind Utility Classes:**
```jsx
<button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
  Submit
</button>
```

**Axios with Credentials:**
```javascript
axios.defaults.withCredentials = true;
```

### Database

**Explicit ON DELETE Policies:**
```sql
-- Client deletion cascades to jobs/orders
client_id FK ON DELETE CASCADE

-- Worker deletion preserves historical data
assigned_worker_id FK ON DELETE SET NULL
```

**CHECK Constraints:**
```sql
status CHECK (status IN ('received', 'in_progress', 'ready', 'collected', 'cancelled'))
```

**Indexes on Critical Fields:**
```sql
CREATE INDEX idx_orders_client ON orders(client_id);
CREATE INDEX idx_orders_status ON orders(status);
```

---

## Useful Commands

### Docker Operations
```bash
npm run docker:build      # Build containers
npm run docker:up         # Start services
npm run docker:down       # Stop services
npm run docker:logs       # View logs
```

### Database Operations
```bash
# Connect to database
docker exec -it lavandaria-db psql -U lavandaria -d lavandaria

# Query sessions
docker exec -it lavandaria-db psql -U lavandaria -d lavandaria -c "SELECT * FROM session;"

# Backup database
docker exec lavandaria-db pg_dump -U lavandaria lavandaria > backup.sql
```

### Development Shortcuts
```bash
npm run dev               # Run server + client concurrently
npm run server            # Backend only (nodemon)
npm run client            # Frontend only (port 3001)
npm run build             # Production build
npm start                 # Production server
```

### Testing
```bash
npm run test:seed         # Seed test data
npm run test:e2e          # Run E2E tests (headless)
npm run test:e2e:ui       # Debug in Playwright UI
npm run test:e2e:report   # Open HTML report
```

---

## Quick Reference Links

- **Documentation**: [`docs/`](docs/)
- **Architecture**: [`docs/architecture.md`](docs/architecture.md)
- **Security**: [`docs/security.md`](docs/security.md)
- **Progress**: [`docs/progress.md`](docs/progress.md)
- **Bugs**: [`docs/bugs.md`](docs/bugs.md)
- **Decisions**: [`docs/decisions.md`](docs/decisions.md)
- **GitHub**: [HSousa1987/Lavandaria](https://github.com/HSousa1987/Lavandaria)

---

**Last Updated:** 2025-10-23
**Version:** 1.0.0 (Post-Cutover)
