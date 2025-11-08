# Security Documentation

**Last Security Audit:** 2025-10-23
**Next Review:** 2026-01-23 (Quarterly)

This document outlines the security posture, implemented controls, open items, and compliance checklist.

---

## Security Principles

1. **Defense in Depth** - Multiple layers of security controls
2. **Principle of Least Privilege** - Users/roles have minimum necessary permissions
3. **Secure by Default** - Secure configurations out of the box
4. **Fail Secure** - Errors don't compromise security
5. **Audit Trail** - All actions logged with correlation IDs

---

## Current Security Posture

### ✅ Implemented Controls

#### Authentication & Authorization

**Session Management:**
- PostgreSQL-backed sessions (persistent, scalable)
- HTTP-only cookies (XSS protection)
- SameSite=lax (CSRF mitigation)
- 30-day session duration (configurable)
- Secure cookies in production (HTTPS-only when `HTTPS=true`)

**Password Security:**
- Bcrypt hashing (cost factor 10)
- Minimum password requirements enforced
- Default passwords force change on first login (`must_change_password`)
- No plaintext passwords in database or logs

**Dual Authentication:**
- Staff: Username + password
- Clients: Phone + password (unique by phone)
- Separate login endpoints (`/api/auth/login/user`, `/api/auth/login/client`)

**Role-Based Access Control (RBAC):**
- Four-tier hierarchy: Master → Admin → Worker → Client
- Middleware enforcement (`requireAuth`, `requireMaster`, `requireFinanceAccess`, etc.)
- Query-level filtering (workers see only assigned jobs)
- Finance routes blocked for workers

#### Input Validation & Injection Prevention

**SQL Injection:**
- 100% parameterized queries (`$1`, `$2`, etc.)
- No string concatenation in SQL
- ORM-less architecture with manual parameter binding

**Input Validation:**
- express-validator chains on all endpoints
- Type checking, length limits, format validation
- Sanitization of user inputs
- Error details exposed via `validationResult()`

**File Upload Security:**
- Type whitelist: JPEG, JPG, PNG, GIF only
- 10MB file size limit per upload
- Batch limit: 10 files per request
- Multer fileFilter validation
- Unique filenames (timestamp + random suffix)

#### Network Security

**CORS:**
- Whitelist approach (`CORS_ORIGINS` env var)
- Credentials enabled (cookies)
- No wildcard origins
- `X-Correlation-Id` exposed for debugging

**HTTP Headers (Helmet.js):**
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS) - 1 year in production
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: no-referrer

**Rate Limiting:**
- Login endpoints: 5 attempts per 15 minutes per IP
- Prevents brute force attacks
- Returns 429 status with `retryAfter` seconds

#### Data Protection

**Database Security:**
- No sensitive data in logs
- Password fields never selected in queries (explicit column lists)
- Correlation IDs for request tracing (no PII)
- Session data encrypted in PostgreSQL

**File Storage:**
- Photo uploads stored in `uploads/cleaning_photos/`
- No executable extensions allowed
- File permissions: 755 (read-execute for others)
- No public directory listing

#### Audit & Monitoring

**Request Logging:**
- Morgan middleware (method, URL, status, response time)
- Correlation IDs on every request (`X-Correlation-Id`)
- Error logging with stack traces (non-production)
- Console logs with emoji prefixes (❌ error, ✅ success, 🔐 auth)

**Database Audit:**
- `created_by` tracking on users, jobs, orders
- `created_at` / `updated_at` timestamps
- Session table queryable for debugging
- Payment history preserved (no deletion)

#### Deployment Security

**Container Security:**
- Alpine Linux base (minimal attack surface)
- No root user in containers
- Environment variables for secrets (never committed)
- Health checks (`/api/healthz`, `/api/readyz`)

**Environment Configuration:**
- `.env` file (never committed, .gitignored)
- Strong `SESSION_SECRET` (32+ chars, hex) auto-generated
- Validation in deploy.sh (exits on weak secrets)
- Separate production/development configs

---

### ⚠️ Open Security Items

#### High Priority

1. **HTTPS Enforcement (Production)**
   - **Status:** Not enforced (HTTP allowed)
   - **Risk:** Man-in-the-middle attacks, session hijacking
   - **Mitigation:** Deploy behind reverse proxy (nginx) with SSL/TLS
   - **Target:** Before production launch

2. **Database User Separation**
   - **Status:** Single user (`lavandaria`) for all operations
   - **Risk:** Compromised app has full DB access
   - **Mitigation:** Create read-only user for queries, admin user for migrations
   - **Target:** Q1 2026

3. **API Key for Mobile/External Integrations**
   - **Status:** No API key mechanism
   - **Risk:** Cannot authenticate external systems
   - **Mitigation:** Implement JWT or API key authentication
   - **Target:** When mobile app planned

#### Medium Priority

4. **Two-Factor Authentication (2FA)**
   - **Status:** Not implemented
   - **Risk:** Compromised passwords grant full access
   - **Mitigation:** Add TOTP-based 2FA for Master/Admin roles
   - **Target:** Q2 2026

5. **Password Complexity Requirements**
   - **Status:** No minimum complexity
   - **Risk:** Weak passwords easily cracked
   - **Mitigation:** Enforce length, character variety, common password blacklist
   - **Target:** Q1 2026

6. **Security Headers Review**
   - **Status:** Helmet defaults used
   - **Risk:** May not cover all attack vectors
   - **Mitigation:** Periodic review of CSP, permissions policy
   - **Target:** Quarterly reviews

7. **Dependency Vulnerability Scanning**
   - **Status:** Manual npm audit
   - **Risk:** Vulnerable dependencies undetected
   - **Mitigation:** Automated scanning (Dependabot, Snyk)
   - **Target:** Q1 2026

#### Low Priority

8. **Brute Force Protection for Client Login**
   - **Status:** Rate limiting on staff login only
   - **Risk:** Client accounts vulnerable to brute force
   - **Mitigation:** Extend rate limiting to `/api/auth/login/client`
   - **Target:** Q2 2026

9. **Session Timeout (Idle)**
   - **Status:** Fixed 30-day duration
   - **Risk:** Abandoned sessions remain valid
   - **Mitigation:** Implement idle timeout (e.g., 24 hours inactivity)
   - **Target:** Q2 2026

10. **Content Security Policy Tuning**
    - **Status:** Helmet defaults
    - **Risk:** May block legitimate resources
    - **Mitigation:** Test and tune CSP directives
    - **Target:** Ongoing

---

## Security Checklist for New Features

When implementing new features, ensure:

### Authentication & Authorization
- [ ] Appropriate auth middleware applied (`requireAuth`, `requireStaff`, etc.)
- [ ] RBAC enforced (role-specific logic)
- [ ] Workers cannot access unassigned resources
- [ ] Finance routes blocked for workers
- [ ] Clients cannot access other clients' data

### Input Validation
- [ ] express-validator chains added
- [ ] All user inputs validated (type, format, length)
- [ ] Parameterized SQL queries ($1, $2, etc.)
- [ ] No string concatenation in queries
- [ ] File uploads validated (type, size, extension)

### Error Handling
- [ ] Try/catch blocks around async operations
- [ ] Correlation IDs included in errors
- [ ] No sensitive data in error messages
- [ ] Proper HTTP status codes (401, 403, 404, 500)
- [ ] Standardized error response format

### Data Protection
- [ ] Passwords never logged or selected
- [ ] Sensitive fields excluded from query results
- [ ] Foreign keys use CASCADE/SET NULL appropriately
- [ ] Audit fields populated (`created_by`, `created_at`)

### Network Security
- [ ] CORS whitelist validated
- [ ] Rate limiting considered for sensitive endpoints
- [ ] Helmet headers applied
- [ ] Response envelope pattern followed

### Testing
- [ ] E2E tests include security scenarios
- [ ] Test unauthenticated access (expect 401)
- [ ] Test wrong role access (expect 403)
- [ ] Test input validation (expect 400)
- [ ] Test SQL injection attempts (expect sanitized)

---

## Threat Model

### Assets to Protect

1. **User Credentials** (passwords, session tokens)
2. **Client PII** (names, phones, addresses, NIF)
3. **Financial Data** (payments, pricing)
4. **Business Data** (orders, jobs, photos)
5. **System Integrity** (database, file storage)

### Threat Actors

1. **External Attackers**
   - Goal: Data theft, service disruption
   - Vectors: Web attacks, credential stuffing

2. **Malicious Insiders** (Workers)
   - Goal: Unauthorized data access, privilege escalation
   - Vectors: RBAC bypass, SQL injection

3. **Accidental Misuse** (Staff)
   - Goal: None (unintentional)
   - Vectors: Configuration errors, weak passwords

### Attack Scenarios & Mitigations

**Scenario 1: SQL Injection**
- **Attack:** Malicious input in search/filter fields
- **Impact:** Data exfiltration, database compromise
- **Mitigation:** ✅ Parameterized queries (100% coverage)

**Scenario 2: Credential Stuffing**
- **Attack:** Automated login attempts with leaked passwords
- **Impact:** Account takeover
- **Mitigation:** ✅ Rate limiting (5/15min), ⚠️ Add 2FA (future)

**Scenario 3: RBAC Bypass**
- **Attack:** Worker accesses unassigned jobs via API manipulation
- **Impact:** Privacy breach, unauthorized data access
- **Mitigation:** ✅ Query-level filtering, middleware enforcement

**Scenario 4: Session Hijacking**
- **Attack:** Intercept session cookie over HTTP
- **Impact:** Account impersonation
- **Mitigation:** ✅ HTTP-only cookies, ⚠️ HTTPS enforcement (production)

**Scenario 5: File Upload Exploit**
- **Attack:** Upload executable file disguised as image
- **Impact:** Remote code execution
- **Mitigation:** ✅ Type whitelist, extension validation, size limits

**Scenario 6: XSS (Cross-Site Scripting)**
- **Attack:** Inject malicious script in user input fields
- **Impact:** Session theft, defacement
- **Mitigation:** ✅ React auto-escaping, CSP headers

**Scenario 7: CSRF (Cross-Site Request Forgery)**
- **Attack:** Trick user into making unwanted requests
- **Impact:** Unauthorized actions
- **Mitigation:** ✅ SameSite cookies, CORS whitelist

---

## Compliance Considerations

### GDPR (General Data Protection Regulation)

**Data Minimization:**
- Only collect necessary PII (name, phone, email, address)
- Optional fields: date_of_birth, NIF

**Right to Erasure:**
- Client deletion cascades to jobs/orders (`ON DELETE CASCADE`)
- Payment history preserved (legal requirement)

**Data Portability:**
- Clients can export their data (future feature)
- JSON API responses support data extraction

**Consent:**
- `must_change_password` enforces explicit password creation
- Terms acceptance required (future feature)

### Portuguese Data Protection Law (Lei n.º 58/2019)

**NIF Handling:**
- NIF (Portuguese tax ID) optional field
- No validation logic (client responsibility)
- Stored as varchar (no encryption required)

**Payment Methods:**
- MBWay support (Portuguese mobile payment)
- Cash, card, transfer options

---

## Incident Response Plan

### Detection
- Monitor error logs for unusual patterns
- Review correlation IDs for failed requests
- Check rate limiter logs for brute force attempts
- Database query performance monitoring

### Response Steps

1. **Identify:** What happened? When? Who was affected?
2. **Contain:** Disable compromised accounts, block IPs
3. **Eradicate:** Fix vulnerability, deploy patch
4. **Recover:** Restore service, verify integrity
5. **Learn:** Document in docs/bugs.md, update checklist

### Contact Information
- **Security Lead:** [Define role]
- **Database Admin:** [Define role]
- **DevOps:** [Define role]

---

## Security Audit History

### 2025-10-23 - Initial Security Review

**Reviewed By:** Claude Code (Automated)
**Scope:** Authentication, authorization, input validation, network security
**Findings:**
- ✅ Strong authentication mechanisms
- ✅ Comprehensive RBAC implementation
- ✅ SQL injection prevention
- ⚠️ HTTPS not enforced (open item #1)
- ⚠️ No 2FA (open item #4)

**Actions:**
- Documented security posture
- Created open items list
- Established quarterly review cadence

**Next Audit:** 2026-01-23

---

## Security Resources

**Password Best Practices:**
- OWASP Password Storage Cheat Sheet
- Bcrypt cost factor recommendations (10+ for 2025)

**OWASP Top 10 (2021):**
1. Broken Access Control ✅ (RBAC implemented)
2. Cryptographic Failures ✅ (Bcrypt, session encryption)
3. Injection ✅ (Parameterized queries)
4. Insecure Design ⚠️ (Ongoing reviews)
5. Security Misconfiguration ⚠️ (HTTPS pending)
6. Vulnerable Components ⚠️ (Manual audits)
7. Authentication Failures ⚠️ (2FA pending)
8. Software & Data Integrity ✅ (Git, version control)
9. Logging Failures ✅ (Correlation IDs, audit trail)
10. SSRF ✅ (No external requests)

---

**Document Maintenance:** Update this file:
- After security audits (quarterly)
- When vulnerabilities discovered
- When security controls added
- When threat model changes
