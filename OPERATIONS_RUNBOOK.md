# Operations Runbook
**Service**: Lavandaria Management System
**Last Updated**: 2025-10-09
**Owner**: Operations Team

---

## Environment Matrix

| Environment | URL | Database | SESSION_SECRET | HTTPS | CORS_ORIGINS |
|-------------|-----|----------|----------------|-------|--------------|
| **Development** | http://localhost:3000 | localhost:5432 | Auto-generated (64 char) | No | http://localhost:3000,http://localhost:3001 |
| **Production** | https://lavandaria.example.com | prod-db:5432 | Vault/Secrets Manager | Yes | https://lavandaria.example.com |

### Environment Variables Required

**Critical (Required)**:
- `SESSION_SECRET` - 64+ char hex (server exits if missing)
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`

**Optional (with defaults)**:
- `NODE_ENV` - development | production (default: production)
- `PORT` - API port (default: 3000)
- `CORS_ORIGINS` - Comma-separated origins (default: localhost:3000,3001)

---

## Boot Sequence

### Normal Startup (Docker)

**Order**:
1. Database container starts (PostgreSQL 16)
2. Database healthcheck passes (`pg_isready`)
3. Application container starts
4. Migrations run automatically (via deploy.sh)
5. Application healthcheck passes (`/api/readyz`)

**Expected Timeline**:
- DB ready: 5-10 seconds
- App ready: 30-40 seconds (including migrations)
- **Total**: ~50 seconds from `docker-compose up`

**Healthcheck Commands**:
```bash
# Database health
docker exec lavandaria-db pg_isready -U lavandaria

# Application liveness
curl http://localhost:3000/api/healthz

# Application readiness (includes DB ping)
curl http://localhost:3000/api/readyz
```

### Manual Startup (Development)

```bash
# 1. Start PostgreSQL
docker-compose up -d db

# 2. Start application (separate terminal)
npm run server  # Uses nodemon for auto-reload

# 3. Start frontend (separate terminal)
cd client && npm start  # Runs on port 3001
```

---

## Rotating SESSION_SECRET

**When**: Every 90 days or after security incident

**Procedure**:

1. **Generate new secret**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Output: a1b2c3d4e5f6...
```

2. **Update environment**:
```bash
# Docker deployment
echo "SESSION_SECRET=<new_secret>" >> .env
docker-compose restart app
```

3. **Verify**:
```bash
# Check logs for successful startup
docker-compose logs app | grep "Server running"

# Test login
curl -X POST http://localhost:3000/api/auth/login/user \
  -H "Content-Type: application/json" \
  -d '{"username":"master","password":"master123"}'
```

**Impact**: All users logged out (must re-authenticate)

**Rollback**: Revert .env to previous SECRET, restart app

---

## Backup & Restore

### Quick Backup

```bash
# Database dump
docker exec lavandaria-db pg_dump -U lavandaria lavandaria > backup_$(date +%Y%m%d_%H%M).sql

# Uploads backup
tar -czf uploads_$(date +%Y%m%d_%H%M).tar.gz uploads/

# Full backup (DB + uploads)
./scripts/backup.sh  # Creates timestamped backups in ./backups/
```

### Quick Restore

```bash
# Restore database
cat backup_20251009_2200.sql | docker exec -i lavandaria-db psql -U lavandaria lavandaria

# Restore uploads
tar -xzf uploads_20251009_2200.tar.gz

# Restart application
docker-compose restart app
```

### Backup Retention Policy

- **Daily backups**: Keep 7 days
- **Weekly backups**: Keep 4 weeks
- **Monthly backups**: Keep 12 months
- **Migration backups**: Keep 30 days after cutover

**Current migration backups** (purge on 2025-11-08):
- `backup_20251008_*` tables (6 tables, 53 kB)
- `final_backup_20251008_2145_*` tables (6 tables, 53 kB)

---

## Incident Response Checklist

### Service Down / Unresponsive

**Triage** (< 5 minutes):

1. **Check container status**:
```bash
docker-compose ps
# Expected: db (healthy), app (healthy)
```

2. **Check healthchecks**:
```bash
curl http://localhost:3000/api/healthz  # Liveness
curl http://localhost:3000/api/readyz   # Readiness (DB)
```

3. **Check logs**:
```bash
docker-compose logs app --tail 100 | grep -E "(ERROR|FATAL|❌)"
docker-compose logs db --tail 50
```

**Common Issues**:

| Symptom | Cause | Fix |
|---------|-------|-----|
| App container exiting | Missing SESSION_SECRET | Check .env, add secret, restart |
| /readyz returns 503 | Database unreachable | `docker-compose restart db`, check network |
| Rate limit errors (429) | Too many login attempts | Wait 15 min or restart app to reset |
| CORS errors | Wrong CORS_ORIGINS | Update .env, restart app |

### Database Connection Issues

```bash
# 1. Check DB is running
docker-compose ps db
# Status should be "Up (healthy)"

# 2. Test connection from host
docker exec lavandaria-db psql -U lavandaria -d lavandaria -c "SELECT 1"

# 3. Check connection from app container
docker exec lavandaria-app node -e "const {pool}=require('./config/database');pool.query('SELECT 1').then(()=>console.log('OK')).catch(e=>console.error(e))"

# 4. Restart DB if needed
docker-compose restart db
```

### High Memory / CPU

```bash
# Check resource usage
docker stats lavandaria-app lavandaria-db

# Check slow queries
docker-compose logs app | grep "Slow query"

# Restart if needed
docker-compose restart app
```

---

## 24-48h Post-Deploy Monitor Plan

### First 2 Hours (Critical Window)

**Every 15 minutes**:
- [ ] Check healthchecks (`/api/healthz`, `/api/readyz`)
- [ ] Monitor error rates in logs
- [ ] Verify logins work (user + client)

```bash
# Automated monitoring script
while true; do
  echo "=== $(date) ==="
  curl -s http://localhost:3000/api/readyz | jq '.status'
  docker-compose logs app --since 15m | grep -c "❌"
  sleep 900  # 15 minutes
done
```

### Hours 2-24 (Active Monitoring)

**Every hour**:
- [ ] Check error log count
- [ ] Verify key workflows (login, create order, upload photo)
- [ ] Monitor database performance
- [ ] Check disk space

```bash
# Hourly check
docker-compose logs app --since 1h | grep -E "(❌|⚠️)" | wc -l
df -h | grep -E "uploads|postgres-data"
```

### Hours 24-48 (Passive Monitoring)

**Every 4 hours**:
- [ ] Review error trends
- [ ] Check for slow queries
- [ ] Verify backups running
- [ ] Monitor disk growth

---

## Emergency Rollback

### Application Code Rollback

```bash
# 1. Identify last good commit
git log --oneline -10

# 2. Rollback code
git checkout <last_good_commit>

# 3. Rebuild and restart
docker-compose build app
docker-compose up -d app

# 4. Verify
curl http://localhost:3000/api/healthz
```

### Database Rollback (Use with Caution)

**⚠️ WARNING**: Only for critical schema issues

```bash
# 1. Stop application
docker-compose stop app

# 2. Restore database
cat backup_<timestamp>.sql | docker exec -i lavandaria-db psql -U lavandaria lavandaria

# 3. Restart
docker-compose start app

# 4. Verify
docker-compose logs app | grep "Database connected"
```

---

## Performance Monitoring

### Key Metrics to Track

**Application**:
- Response times (p50, p95, p99)
- Error rates (4xx, 5xx)
- Request correlation IDs (for tracing)
- Rate limit triggers

**Database**:
- Query latency (warn if > 100ms)
- Connection pool usage
- Slow queries (> 1 second)

**System**:
- Memory usage (app container)
- Disk space (uploads/, postgres-data/)
- CPU utilization

### Viewing Metrics

```bash
# Request latency from logs
docker-compose logs app | grep "✅.*fetched" | tail -20

# Slow DB queries
docker-compose logs app | grep "Slow database"

# Rate limit events
docker-compose logs app | grep "🚫 \[RATE-LIMIT\]"

# Correlation ID tracing
docker-compose logs app | grep "req_1760046060891"
```

---

## Scheduled Maintenance

### Daily

- [ ] Check disk space: `df -h`
- [ ] Review error logs: `docker-compose logs app --since 24h | grep "❌"`
- [ ] Backup database: `./scripts/backup.sh`

### Weekly

- [ ] Review slow queries
- [ ] Clean old uploads (if implemented)
- [ ] Update dependencies: `npm audit`
- [ ] Test disaster recovery procedure

### Monthly

- [ ] Rotate SESSION_SECRET
- [ ] Review and archive old backups
- [ ] Performance testing
- [ ] Security audit

### Quarterly

- [ ] Update Node.js version
- [ ] Update PostgreSQL version
- [ ] Review and update documentation
- [ ] Disaster recovery drill

---

## Contact & Escalation

### On-Call Rotation
- **Primary**: ops-team@lavandaria.example.com
- **Secondary**: engineering@lavandaria.example.com
- **Emergency**: cto@lavandaria.example.com

### Escalation Criteria

**P0 (Critical - Immediate)**:
- Service completely down
- Data loss or corruption
- Security breach

**P1 (High - < 1 hour)**:
- Partial outage (one user type affected)
- Performance degradation (> 5s response times)
- Database connection issues

**P2 (Medium - < 4 hours)**:
- Feature not working
- Non-critical errors in logs
- Slow queries

**P3 (Low - Next business day)**:
- UI issues
- Documentation updates
- Enhancement requests

---

## Useful Commands Reference

### Docker Management
```bash
# View logs
docker-compose logs -f app                    # Follow app logs
docker-compose logs --tail 100 app            # Last 100 lines
docker-compose logs --since 1h app            # Last hour

# Container management
docker-compose up -d                          # Start all
docker-compose restart app                    # Restart app
docker-compose stop                           # Stop all
docker-compose down -v                        # Stop and remove volumes

# Resource monitoring
docker stats lavandaria-app lavandaria-db     # Real-time stats
docker-compose ps                             # Container status
```

### Database Management
```bash
# Connect to DB
docker exec -it lavandaria-db psql -U lavandaria -d lavandaria

# Run query
docker exec lavandaria-db psql -U lavandaria -d lavandaria -c "SELECT COUNT(*) FROM users"

# List tables
docker exec lavandaria-db psql -U lavandaria -d lavandaria -c "\dt"

# Check indexes
docker exec lavandaria-db psql -U lavandaria -d lavandaria -c "\di"
```

### Application Testing
```bash
# Health checks
curl http://localhost:3000/api/healthz       # Liveness
curl http://localhost:3000/api/readyz        # Readiness

# Test login
curl -X POST http://localhost:3000/api/auth/login/user \
  -H "Content-Type: application/json" \
  -d '{"username":"master","password":"master123"}'

# View API docs
open http://localhost:3000/api/docs
```

---

**Document Version**: 1.0
**Review Date**: 2025-11-09 (30 days)
