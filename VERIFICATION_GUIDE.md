# Security Updates Verification Guide

This guide provides step-by-step instructions to verify all security and stability improvements.

---

## Quick Verification (5 minutes)

### 1. Rate Limiting (F2)

**Test in Browser Console (http://localhost:3000):**

```javascript
// Run this in browser console - triggers rate limit after 5 attempts
async function testRateLimit() {
  console.log('Starting rate limit test...');

  for (let i = 1; i <= 6; i++) {
    const response = await fetch('/api/auth/login/client', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({phone: '911111111', password: 'wrongpassword'})
    });

    const data = await response.json();
    const status = response.status;

    console.log(`Attempt ${i}:`, {
      status,
      code: data.code,
      correlationId: data._meta?.correlationId,
      rateLimit: {
        limit: response.headers.get('RateLimit-Limit'),
        remaining: response.headers.get('RateLimit-Remaining'),
        reset: response.headers.get('RateLimit-Reset')
      }
    });

    if (status === 429) {
      console.log('✅ Rate limit triggered!');
      console.log('Retry after:', data.retryAfter, 'seconds');
      break;
    }

    await new Promise(r => setTimeout(r, 500)); // Wait 500ms between requests
  }
}

testRateLimit();
```

**Expected Output:**
```
Attempt 1: {status: 401, code: undefined, correlationId: "req_...", rateLimit: {...}}
Attempt 2: {status: 401, code: undefined, correlationId: "req_...", rateLimit: {...}}
Attempt 3: {status: 401, code: undefined, correlationId: "req_...", rateLimit: {...}}
Attempt 4: {status: 401, code: undefined, correlationId: "req_...", rateLimit: {...}}
Attempt 5: {status: 401, code: undefined, correlationId: "req_...", rateLimit: {...}}
Attempt 6: {status: 429, code: "RATE_LIMIT_EXCEEDED", correlationId: "req_...", ...}
✅ Rate limit triggered!
Retry after: 900 seconds
```

**Check Network Tab:**
- Attempts 1-5: HTTP 401
- Attempt 6: **HTTP 429** ✅
- Headers include: `RateLimit-Limit: 5`, `RateLimit-Remaining: 0`
- Response body includes correlation ID

---

### 2. SESSION_SECRET Validation (W1)

**Verify Server Startup:**

```bash
# Check server logs for startup errors
docker-compose logs app | head -30
```

**Expected:** No `❌ [FATAL]` errors related to SESSION_SECRET

**Verify .env Configuration:**

```bash
# Check SESSION_SECRET length
grep "SESSION_SECRET" .env
```

**Expected:** 64-character hexadecimal string

**Test Missing Secret (Optional - Will Stop Server):**

```bash
# This should FAIL and prevent startup
SESSION_SECRET= node server.js
```

**Expected:**
```
❌ [FATAL] SESSION_SECRET is not defined in environment variables
   Generate a secure secret with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   Add it to your .env file as: SESSION_SECRET=your_generated_secret
```

---

### 3. CORS Whitelist (W2)

**Test Allowed Origin (Browser Console at http://localhost:3000):**

```javascript
// This should work - same origin
fetch('/api/auth/check')
  .then(r => r.json())
  .then(d => console.log('✅ CORS allowed:', d))
  .catch(e => console.error('❌ CORS blocked:', e));
```

**Expected:** Response with user data or `{authenticated: false}`

**Test Preflight (Browser Console):**

```javascript
// Check CORS headers
fetch('/api/auth/check', {
  method: 'GET',
  credentials: 'include'
}).then(r => {
  console.log('Access-Control-Allow-Origin:', r.headers.get('access-control-allow-origin'));
  console.log('Access-Control-Allow-Credentials:', r.headers.get('access-control-allow-credentials'));
  console.log('X-Correlation-Id:', r.headers.get('x-correlation-id'));
});
```

**Expected:**
```
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Credentials: true
X-Correlation-Id: req_...
```

**Verify CORS Configuration:**

```bash
# Check allowed origins
grep "CORS_ORIGINS" .env
```

**Expected:** `CORS_ORIGINS=http://localhost:3000,http://localhost:3001`

---

### 4. Correlation IDs

**Test in Browser Console:**

```javascript
// Send a request and check correlation ID
fetch('/api/auth/login/client', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({phone: '911111111', password: 'wrong'})
})
.then(r => {
  const headerId = r.headers.get('X-Correlation-Id');
  console.log('Header Correlation ID:', headerId);
  return r.json().then(d => ({headerId, bodyId: d._meta?.correlationId}));
})
.then(({headerId, bodyId}) => {
  if (headerId === bodyId) {
    console.log('✅ Correlation IDs match:', headerId);
  } else {
    console.error('❌ Correlation ID mismatch!');
  }
});
```

**Expected:**
```
Header Correlation ID: req_1760046063998_mlb8ottt8
✅ Correlation IDs match: req_1760046063998_mlb8ottt8
```

**Check Server Logs:**

```bash
# Find requests by correlation ID
docker-compose logs app | grep "req_1760046063998_mlb8ottt8"
```

**Expected:** Multiple log entries showing the request flow with same ID

---

## Automated Test Scripts

### Run All Tests

```bash
# Rate limiting test (includes 3 scenarios)
./test_rate_limit.sh

# SESSION_SECRET validation test
./test_session_secret.sh

# CORS whitelist test
./test_cors.sh
```

**All tests should show:**
- ✅ PASS for expected behaviors
- ❌ FAIL only if something is broken

---

## Manual Testing Checklist

### Rate Limiting
- [ ] Normal login succeeds (1st attempt)
- [ ] Failed logins return 401 (attempts 1-5)
- [ ] 6th attempt returns 429 with `RATE_LIMIT_EXCEEDED`
- [ ] Response includes `retryAfter: 900` (15 minutes)
- [ ] RateLimit headers present in response
- [ ] Correlation ID in both header and body
- [ ] Server logs show `🚫 [RATE-LIMIT]` for blocked attempts

### SESSION_SECRET
- [ ] Server starts successfully with valid .env
- [ ] SESSION_SECRET is 64 characters
- [ ] Server refuses to start without SESSION_SECRET
- [ ] Server refuses to start with short SESSION_SECRET (<32 chars)
- [ ] deploy.sh generates SESSION_SECRET on first run

### CORS
- [ ] Requests from localhost:3000 succeed
- [ ] Requests from localhost:3001 succeed
- [ ] Response includes CORS headers
- [ ] OPTIONS preflight requests handled
- [ ] No-origin requests (curl) allowed
- [ ] CORS_ORIGINS in .env matches expected values

### Correlation IDs
- [ ] All auth responses include `_meta.correlationId`
- [ ] X-Correlation-Id header present in responses
- [ ] Header and body correlation IDs match
- [ ] Server logs include correlation IDs
- [ ] Correlation IDs are unique per request

---

## Browser Testing Flow

### 1. Open Application
Navigate to: **http://localhost:3000**

### 2. Open DevTools
- Chrome/Edge: F12 or Cmd+Option+I (Mac)
- Firefox: F12 or Cmd+Option+K (Mac)

### 3. Go to Network Tab
- Clear existing requests (trash icon)
- Ensure "Preserve log" is checked

### 4. Test Failed Login (5 times)
- Click "Client Login"
- Enter: Phone `911111111`, Password `wrongpassword`
- Click Submit
- Repeat 5 times

### 5. Check Network Tab
**Expected for attempts 1-5:**
- Status: `401 Unauthorized`
- Response Headers:
  - `RateLimit-Limit: 5`
  - `RateLimit-Remaining: 4, 3, 2, 1, 0`
  - `X-Correlation-Id: req_...`
- Response Body:
  ```json
  {
    "error": "Invalid credentials",
    "_meta": {
      "correlationId": "req_...",
      "timestamp": "2025-10-09T..."
    }
  }
  ```

**Expected for attempt 6:**
- Status: **`429 Too Many Requests`** ✅
- Response Headers:
  - `RateLimit-Limit: 5`
  - `RateLimit-Remaining: 0`
- Response Body:
  ```json
  {
    "error": "Too many login attempts from this IP, please try again after 15 minutes",
    "code": "RATE_LIMIT_EXCEEDED",
    "retryAfter": 900,
    "_meta": {
      "correlationId": "req_...",
      "timestamp": "2025-10-09T..."
    }
  }
  ```

### 6. Test Successful Login
- Wait 15 minutes OR restart server: `docker-compose restart app`
- Login with correct credentials:
  - Phone: `911111111`
  - Password: `lavandaria2025`

**Expected:**
- Status: `200 OK`
- Redirected to dashboard
- Session cookie set

---

## Command Line Testing

### Test Rate Limiting (curl)

```bash
# Attempt 1-5 (should return 401)
for i in {1..5}; do
  echo "Attempt $i:"
  curl -s -X POST http://localhost:3000/api/auth/login/client \
    -H "Content-Type: application/json" \
    -d '{"phone":"911111111","password":"wrong"}' | jq '.error, ._meta.correlationId'
  sleep 0.5
done

# Attempt 6 (should return 429)
echo "Attempt 6 (should be rate limited):"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X POST http://localhost:3000/api/auth/login/client \
  -H "Content-Type: application/json" \
  -d '{"phone":"911111111","password":"wrong"}' | jq '.'
```

**Expected Output (Attempt 6):**
```json
{
  "error": "Too many login attempts from this IP, please try again after 15 minutes",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 900,
  "_meta": {
    "correlationId": "req_...",
    "timestamp": "2025-10-09T..."
  }
}
HTTP Status: 429
```

### Check CORS Headers (curl)

```bash
# Test with allowed origin
curl -v -X GET http://localhost:3000/api/auth/check \
  -H "Origin: http://localhost:3000" 2>&1 | grep -i "access-control"

# Test without origin (should work for API clients)
curl -s -X GET http://localhost:3000/api/auth/check | jq .
```

### Monitor Server Logs

```bash
# Watch logs in real-time
docker-compose logs -f app

# Filter for rate limit events
docker-compose logs app | grep "RATE-LIMIT"

# Filter for CORS events
docker-compose logs app | grep "CORS"

# Filter by correlation ID
docker-compose logs app | grep "req_1760046063998_mlb8ottt8"
```

---

## Expected Log Patterns

### Rate Limiting
```
🔍 [RATE-LIMIT] Request from IP: 192.168.65.1
🚫 [RATE-LIMIT] Login attempt blocked - IP: 192.168.65.1, Correlation ID: req_...
```

### Authentication
```
🔐 [AUTH] Login attempt for user: admin [req_...]
📊 [AUTH] Database query result - rows found: 1 [req_...]
🔑 [AUTH] Password validation result: false [req_...]
❌ [AUTH] Invalid password for user: admin [req_...]
```

```
✅ [AUTH] Login successful for user: admin - Role: admin [req_...]
```

### CORS (if blocked)
```
🚫 [CORS] Blocked request from unauthorized origin: http://evil.com
```

---

## Troubleshooting

### Rate Limit Not Triggering
**Symptom:** More than 5 attempts allowed

**Fixes:**
1. Check server logs: `docker-compose logs app | grep RATE`
2. Verify trust proxy enabled: `grep "trust proxy" server.js`
3. Restart containers: `docker-compose restart app`
4. Clear rate limit: Wait 15 minutes OR restart server

### SESSION_SECRET Error on Startup
**Symptom:** Server won't start, shows FATAL error

**Fixes:**
1. Check .env exists: `ls -la .env`
2. Check SESSION_SECRET: `grep SESSION_SECRET .env`
3. Generate new secret:
   ```bash
   echo "SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" >> .env
   ```
4. Restart: `docker-compose restart app`

### CORS Errors in Browser
**Symptom:** "Access to fetch... has been blocked by CORS policy"

**Fixes:**
1. Check origin in CORS_ORIGINS: `grep CORS_ORIGINS .env`
2. Add your origin to .env: `CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://yourorigin.com`
3. Restart: `docker-compose restart app`
4. Clear browser cache

### Correlation IDs Missing
**Symptom:** Responses don't include `_meta.correlationId`

**Fixes:**
1. Check middleware loaded: `grep "addCorrelationId" routes/auth.js`
2. Rebuild Docker image: `docker-compose build --no-cache app`
3. Restart: `docker-compose up -d`

---

## Success Criteria

All of the following must be ✅ to confirm successful deployment:

### F2 - Rate Limiting
- [x] Login endpoints rate limit after 5 attempts
- [x] Returns HTTP 429 with friendly error message
- [x] Includes retry-after time (900 seconds)
- [x] RateLimit headers present in all responses
- [x] Correlation IDs in response body and headers
- [x] Server logs blocked attempts with IP and correlation ID

### W1 - SESSION_SECRET
- [x] Server requires SESSION_SECRET from environment
- [x] Server validates minimum length (32 characters)
- [x] Server exits with clear error if missing/weak
- [x] deploy.sh auto-generates secure secret
- [x] Current .env has 64-character secret

### W2 - CORS
- [x] Allowed origins configurable via CORS_ORIGINS env var
- [x] Whitelisted origins receive CORS headers
- [x] Non-whitelisted origins blocked (browser enforces)
- [x] API clients without Origin header allowed
- [x] Preflight OPTIONS requests handled correctly

### W9 - Input Validation
- [x] Validation middleware created and documented
- [x] Auth endpoints use standardized validation
- [x] Validation errors return consistent shape
- [x] Error responses include correlation IDs

### General
- [x] All test scripts pass
- [x] No breaking changes to API contracts
- [x] Server starts without errors
- [x] Documentation complete and accurate

---

**Last Updated:** 2025-10-09 22:30 UTC
**Verified By:** Automated test suite + Manual verification
**Status:** ✅ All critical security improvements verified and working
