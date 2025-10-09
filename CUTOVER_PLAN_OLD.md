# CUTOVER PLAN - DISABLE LEGACY ROUTES

## Step 1: Update server.js to Return 410 Gone

Replace legacy route mounts with deprecation handlers:

```javascript
// OLD (lines 56-58 in server.js):
app.use('/api/services', require('./routes/services'));
app.use('/api/laundry', require('./routes/laundry'));
app.use('/api/airbnb', require('./routes/airbnb'));

// NEW (replace with):
app.use('/api/services', (req, res) => {
    res.status(410).json({
        error: 'Endpoint permanently moved',
        message: 'This API endpoint has been migrated to the new system.',
        newEndpoint: '/api/laundry-services',
        migration: 'All service catalog operations now use /api/laundry-services'
    });
});

app.use('/api/laundry', (req, res) => {
    res.status(410).json({
        error: 'Endpoint permanently moved',
        message: 'This API endpoint has been migrated to the new system.',
        newEndpoint: '/api/laundry-orders',
        migration: 'All laundry order operations now use /api/laundry-orders'
    });
});

app.use('/api/airbnb', (req, res) => {
    res.status(410).json({
        error: 'Endpoint permanently moved',
        message: 'This API endpoint has been migrated to the new system.',
        newEndpoint: '/api/cleaning-jobs',
        migration: 'All cleaning job operations now use /api/cleaning-jobs'
    });
});
```

## Step 2: Update Frontend (client/src/pages/Dashboard.js)

Replace all legacy API calls:

### Replace `/api/airbnb` → `/api/cleaning-jobs`
- Line 182: `const airbnbRes = await axios.get('/api/airbnb');`
  → `const airbnbRes = await axios.get('/api/cleaning-jobs');`
- Line 206: Same replacement
- Line 221: Same replacement
- Line 224: Remove or replace (duplicate call)

### Replace `/api/laundry` → `/api/laundry-orders`
- Line 185: `const laundryRes = await axios.get('/api/laundry');`
  → `const laundryRes = await axios.get('/api/laundry-orders');`
- Line 224: Same replacement

### Verify No Other References
- Check AdminDashboard.js, WorkerDashboard.js for legacy calls

## Step 3: Test Plan

### 3.1 Verify 410 Responses
```bash
curl -i http://localhost:3000/api/airbnb
# Expected: HTTP 410 with migration message

curl -i http://localhost:3000/api/laundry
# Expected: HTTP 410 with migration message

curl -i http://localhost:3000/api/services
# Expected: HTTP 410 with migration message
```

### 3.2 Verify NEW Endpoints Work
```bash
curl -i http://localhost:3000/api/cleaning-jobs
# Expected: HTTP 200 with data

curl -i http://localhost:3000/api/laundry-orders
# Expected: HTTP 200 with data

curl -i http://localhost:3000/api/laundry-services
# Expected: HTTP 200 with data
```

### 3.3 Browser Console Test
1. Open browser console (F12)
2. Navigate to dashboard
3. Check Network tab
4. Expected: All requests to `/api/cleaning-jobs`, `/api/laundry-orders`, `/api/laundry-services`
5. Expected: NO 410 errors
6. Expected: Data loads successfully

## Step 4: Rollback Plan

If issues arise, restore legacy routes:

```bash
cd /Applications/XAMPP/xamppfiles/htdocs/Lavandaria
git checkout server.js client/src/pages/Dashboard.js
docker-compose restart app
```

## Step 5: Monitoring Period

- Monitor for 24 hours after cutover
- Check server logs for 410 responses (indicates missed frontend updates)
- Verify no application errors in browser console
- Confirm user operations complete successfully

## GO/NO-GO Checklist

- [ ] Phase 3 verification passed (all integrity checks ✅)
- [ ] Frontend changes prepared and reviewed
- [ ] Server.js changes prepared and reviewed
- [ ] Test plan documented
- [ ] Rollback plan documented
- [ ] User notification prepared (if applicable)
- [ ] Monitoring tools ready (docker-compose logs)
- [ ] Backup confirmed (Phase 1 backups verified)

## Approval Required

**DO NOT EXECUTE** until explicit "GO" approval received.
