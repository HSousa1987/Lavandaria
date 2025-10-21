# CI/CD Automation Checklist
**Last Updated**: 2025-10-09

---

## CI Pipeline Steps (Recommended Order)

### 1. Install Dependencies
```bash
npm ci --only=production
cd client && npm ci
```
**Expected**: Clean install, no warnings, packages match lock file
**Failure**: Check package.json, package-lock.json integrity

### 2. Lint Code
```bash
# Backend (if ESLint configured)
npm run lint  # Or: npx eslint server.js routes/ middleware/

# Frontend
cd client && npm run lint
```
**Expected**: Zero lint errors
**Failure**: Fix lint issues, re-run

### 3. Build Application
```bash
# Frontend production build
cd client && npm run build

# Docker image build
docker build -t lavandaria-app:latest .
```
**Expected**: Build succeeds, static files in `client/build/`
**Failure**: Check build logs, fix errors

### 4. Run Tests
```bash
# Unit tests (if implemented)
npm test

# Integration tests (if implemented)
npm run test:integration

# Coverage report
npm run test:coverage
```
**Expected**: All tests pass, coverage > threshold
**Failure**: Fix failing tests, check coverage report

### 5. Security Audit
```bash
# NPM audit
npm audit --production

# Check for known vulnerabilities
npm audit --audit-level=high
```
**Expected**: Zero high/critical vulnerabilities
**Failure**: Update vulnerable packages, re-audit

### 6. Validate OpenAPI Spec
```bash
# Lint OpenAPI spec (requires swagger-cli)
npx @apidevtools/swagger-cli validate docs/openapi.yaml
```
**Expected**: Valid OpenAPI 3.1 spec
**Failure**: Fix spec errors, re-validate

### 7. Database Migrations Check
```bash
# Verify migrations are idempotent
docker-compose up -d db
cat database/migrations/*.sql | docker exec -i lavandaria-db psql -U lavandaria -d lavandaria
cat database/migrations/*.sql | docker exec -i lavandaria-db psql -U lavandaria -d lavandaria  # Run twice
```
**Expected**: Second run has no errors (idempotent)
**Failure**: Fix migration scripts

### 8. Integration Test (End-to-End)
```bash
# Start services
docker-compose up -d

# Wait for ready
sleep 30

# Test health endpoints
curl -f http://localhost:3000/api/healthz || exit 1
curl -f http://localhost:3000/api/readyz || exit 1

# Test auth flow
curl -X POST http://localhost:3000/api/auth/login/user \
  -H "Content-Type: application/json" \
  -d '{"username":"master","password":"master123"}' | grep "success"
```
**Expected**: All endpoints respond correctly
**Failure**: Check logs, fix issues

### 9. Generate Artifacts
```bash
# OpenAPI spec (for API documentation)
cp docs/openapi.yaml dist/openapi.yaml

# Frontend build (static files)
cp -r client/build dist/frontend

# Docker image tag
docker tag lavandaria-app:latest lavandaria-app:${CI_COMMIT_SHA}

# Coverage reports
cp -r coverage dist/
```
**Expected**: Artifacts in `dist/` directory
**Failure**: Check build paths

### 10. Cleanup
```bash
# Stop containers
docker-compose down -v

# Remove temp files
rm -rf node_modules/*/test
```

---

## Local Equivalents (Without CI Service)

### Run Full CI Pipeline Locally
```bash
#!/bin/bash
# Local CI simulation script

set -e  # Exit on error

echo "=== 1. Install Dependencies ==="
npm ci --only=production
cd client && npm ci && cd ..

echo "=== 2. Lint (skipped - no linter configured) ==="

echo "=== 3. Build Application ==="
cd client && npm run build && cd ..

echo "=== 4. Build Docker Image ==="
docker build -t lavandaria-app:test .

echo "=== 5. Security Audit ==="
npm audit --audit-level=high

echo "=== 6. Validate OpenAPI ==="
npx @apidevtools/swagger-cli validate docs/openapi.yaml || echo "⚠️ Install swagger-cli for validation"

echo "=== 7. Start Services ==="
docker-compose up -d
sleep 30

echo "=== 8. Health Checks ==="
curl -f http://localhost:3000/api/healthz
curl -f http://localhost:3000/api/readyz

echo "=== 9. Integration Test ==="
./test_rate_limit.sh
./test_session_secret.sh
./test_cors.sh

echo "=== 10. Cleanup ==="
docker-compose down

echo "✅ CI Pipeline Complete!"
```

Save as `scripts/ci-local.sh`, make executable: `chmod +x scripts/ci-local.sh`

---

## GitHub Actions Example (Optional)

If using GitHub Actions, create `.github/workflows/ci.yml`:

```yaml
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: lavandaria
          POSTGRES_PASSWORD: lavandaria2025
          POSTGRES_DB: lavandaria
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: |
          npm ci --only=production
          cd client && npm ci

      - name: Build frontend
        run: cd client && npm run build

      - name: Security audit
        run: npm audit --audit-level=high

      - name: Validate OpenAPI
        run: npx @apidevtools/swagger-cli validate docs/openapi.yaml

      - name: Run migrations
        env:
          DB_HOST: localhost
          DB_PORT: 5432
          DB_USER: lavandaria
          DB_PASSWORD: lavandaria2025
          DB_NAME: lavandaria
        run: |
          cat database/migrations/*.sql | PGPASSWORD=lavandaria2025 psql -h localhost -U lavandaria -d lavandaria

      - name: Start application
        env:
          SESSION_SECRET: test-secret-for-ci-only-not-production
          NODE_ENV: production
          DB_HOST: localhost
        run: |
          npm start &
          sleep 10

      - name: Health checks
        run: |
          curl -f http://localhost:3000/api/healthz
          curl -f http://localhost:3000/api/readyz

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: openapi-spec
          path: docs/openapi.yaml
```

---

## Interpreting Failures

### Common Failure Scenarios

| Step | Failure Message | Cause | Fix |
|------|----------------|-------|-----|
| Install | `EINTEGRITY` | Lock file mismatch | Delete node_modules, package-lock.json; run `npm install` |
| Build | `Module not found` | Missing dependency | Check imports, install missing package |
| Audit | `High severity vulnerabilities` | Outdated packages | Run `npm audit fix`, manual review if needed |
| OpenAPI | `Invalid schema` | Spec syntax error | Fix YAML syntax, check references |
| Health | `Connection refused` | App not started | Check logs, increase sleep time |
| Integration | `401 Unauthorized` | Auth flow broken | Check credentials, session handling |

### Exit Codes

- **0**: Success
- **1**: Generic failure (check logs)
- **2**: Misuse of shell command
- **126**: Command cannot execute
- **127**: Command not found
- **130**: Script terminated by Ctrl+C

---

## Coverage Thresholds (Recommended)

If implementing Jest/testing:

```json
{
  "jest": {
    "coverageThreshold": {
      "global": {
        "branches": 70,
        "functions": 75,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```

**Interpretation**:
- **Lines**: 80% of code lines must be executed
- **Branches**: 70% of if/else branches covered
- **Functions**: 75% of functions called
- **Statements**: 80% of statements executed

---

## Pre-commit Hooks (Optional)

Install Husky for git hooks:

```bash
npm install --save-dev husky
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "npm test"
npx husky add .husky/pre-commit "npm audit --audit-level=high"
```

---

## Continuous Deployment (Optional)

### Deploy to Production Checklist

**Pre-deployment**:
- [ ] All CI checks pass
- [ ] Code reviewed and approved
- [ ] Changelog updated
- [ ] Database migrations tested
- [ ] Backup created

**Deployment**:
```bash
# 1. Tag release
git tag -a v2.0.0 -m "Release 2.0.0"
git push origin v2.0.0

# 2. Pull on production server
git pull origin main

# 3. Rebuild
docker-compose build --no-cache app

# 4. Stop old, start new (zero-downtime with health checks)
docker-compose up -d app

# 5. Verify
curl -f https://lavandaria.example.com/api/healthz
curl -f https://lavandaria.example.com/api/readyz

# 6. Monitor for 2 hours (see OPERATIONS_RUNBOOK.md)
```

**Post-deployment**:
- [ ] Health checks pass
- [ ] Logs show no errors
- [ ] Key workflows tested
- [ ] Performance metrics normal
- [ ] Backup verified

---

## Automated Monitoring Setup

### Healthcheck Monitoring (Uptime Robot, etc.)

**Endpoints to monitor**:
- `https://lavandaria.example.com/api/healthz` - Every 5 minutes
- `https://lavandaria.example.com/api/readyz` - Every 5 minutes

**Alert conditions**:
- HTTP status != 200
- Response time > 5 seconds
- 3 consecutive failures

### Log Aggregation (Recommended)

Use Docker logging drivers or external service:

```yaml
# docker-compose.yml
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

---

**Document Version**: 1.0
**Review Date**: 2025-11-09 (30 days)
