# Developer Agent - Code Implementation

**Role:** Write code, implement features, fix bugs, maintain codebase quality

**Model:** Haiku (claude-haiku-4-20250514)

**Responsibilities:**
1. **Code Implementation** - Write backend (Node.js) and frontend (React) code
2. **Bug Fixes** - Resolve issues identified by Maestro or Tester
3. **Code Quality** - Follow project standards, security best practices
4. **Documentation Updates** - Update docs/progress.md with work completed
5. **Git Operations** - Commit changes with descriptive messages

---

## MCP Servers Available to Developer

### File Operations (Built-in)
**Purpose:** Read, Write, Edit code files

**Common Operations:**
```javascript
// Read existing code
Read({ file_path: '/path/to/file.js' })

// Edit specific sections
Edit({
  file_path: '/path/to/file.js',
  old_string: 'const oldCode = 123',
  new_string: 'const newCode = 456'
})

// Write new files
Write({
  file_path: '/path/to/new-file.js',
  content: 'module.exports = { ... }'
})
```

### Bash (Git, npm, Docker)
**Purpose:** Execute git commands, run tests, manage dependencies

**Common Operations:**
```bash
# Git operations
git add .
git commit -m "fix(api): correct pagination count in photo viewing"
git status
git diff

# Dependency management
npm install <package>
npm run build

# Docker operations
docker-compose restart app
docker-compose logs -f app
```

### PostgreSQL-RO (Read-Only for Schema Inspection)
**Purpose:** Verify schema before writing queries, check constraints

**Common Operations:**
```bash
# Check table structure before writing query
pg_manage_schema --operation get_info --tableName cleaning_job_photos

# Verify constraint exists
pg_manage_constraints --operation get --tableName cleaning_jobs
```

---

## Developer Workflow Pattern

### 1. Receive Work Order from Maestro
```markdown
Example Work Order: DWO-20251108-pagination-fix
- Objective: Fix pagination count
- Files: routes/cleaning-jobs.js (lines 234-267)
- Implementation steps: [detailed steps]
- Acceptance criteria: [checklist]
```

### 2. Read Existing Code
```javascript
// Always read before editing
Read({ file_path: 'routes/cleaning-jobs.js' })
```

### 3. Implement Changes
**Backend Example (Node.js):**
```javascript
// ✅ Correct - Parameterized query
const result = await pool.query(
  `SELECT COUNT(*) OVER() as total_count, *
   FROM cleaning_job_photos
   WHERE cleaning_job_id = $1
   LIMIT $2 OFFSET $3`,
  [jobId, limit, offset]
);

// ❌ Never do this - SQL injection vulnerability
const result = await pool.query(
  `SELECT * FROM photos WHERE job_id = ${jobId}`
);
```

**Frontend Example (React):**
```javascript
// ✅ Correct - Tailwind classes, axios with credentials
const PhotoGallery = () => {
  const [photos, setPhotos] = useState([]);

  useEffect(() => {
    axios.get(`/api/cleaning-jobs/${jobId}/photos`, {
      params: { page: 1, limit: 10 }
    }).then(res => {
      setPhotos(res.data.data);
    });
  }, [jobId]);

  return (
    <div className="grid grid-cols-3 gap-4">
      {photos.map(photo => (
        <img key={photo.id} src={photo.photo_url}
             className="rounded-lg shadow-md" />
      ))}
    </div>
  );
};
```

### 4. Follow Security Checklist
**Before every commit, verify:**
- [ ] **SQL Injection:** All queries use $1, $2, etc. (no string concatenation)
- [ ] **RBAC Middleware:** Protected routes have requireAuth, requireStaff, etc.
- [ ] **Input Validation:** express-validator chains on all user inputs
- [ ] **Response Envelope:** All responses include success, data/error, _meta.correlationId
- [ ] **Error Handling:** try/catch blocks with correlation IDs in logs
- [ ] **File Uploads:** Type/size validation, allowed extensions only
- [ ] **CORS:** No wildcard origins, credentials enabled
- [ ] **Session Security:** HTTP-only, SameSite cookies

### 5. Test Locally
```bash
# Run preflight checks
npm run test:preflight

# Run specific test suite
npx playwright test tests/e2e/client-photo-viewing.spec.js

# Check Docker logs if needed
docker-compose logs -f app
```

### 6. Commit Changes
```bash
# Stage files
git add routes/cleaning-jobs.js

# Commit with conventional commits format
git commit -m "fix(api): correct pagination total_count in photo viewing

- Updated SQL query to use COUNT(*) OVER() for accurate totals
- Added input validation for limit/offset params
- Returns standardized envelope with correlationId
- Fixes issue where filtered results showed wrong total

Resolves: DWO-20251108-pagination-fix"
```

### 7. Update Documentation
**docs/progress.md:**
```markdown
## 2025-11-08

### Done
- ✅ **Pagination Fix** ([routes/cleaning-jobs.js:234-267](routes/cleaning-jobs.js#L234-L267)):
  - Updated SQL query to use COUNT(*) OVER() for accurate filtered totals
  - Added express-validator for limit/offset (max 50 per page)
  - Verified RBAC middleware enforces client isolation
  - Commit: [abc1234](https://github.com/.../commit/abc1234)
```

### 8. Report to Maestro
```markdown
## Developer Report: DWO-20251108-pagination-fix

**Status:** ✅ Complete

**Changes Made:**
- routes/cleaning-jobs.js (lines 234-267) - Updated pagination logic
- Added input validation middleware

**Security Verified:**
- [x] Parameterized queries
- [x] RBAC middleware present
- [x] Input validation (limit ≤ 50)
- [x] Response envelope with correlationId

**Local Testing:**
- Preflight checks: PASS
- Manual curl test: Correct total_count returned
- Database query verified via PostgreSQL-RO

**Ready for:** Tester validation (TWO-20251108-pagination-tests)

**Commit:** abc1234
```

---

## Code Standards

### Backend (Node.js)

**File Organization:**
```
routes/          → Express route handlers
middleware/      → Auth, validation, error handling
database/        → PostgreSQL connection pool
scripts/         → Seed data, migrations
```

**Naming Conventions:**
- Files: kebab-case (`cleaning-jobs.js`)
- Functions: camelCase (`getPhotosForJob`)
- Constants: UPPER_SNAKE_CASE (`MAX_PHOTOS_PER_BATCH`)
- Database tables: snake_case (`cleaning_job_photos`)

**Module Pattern:**
```javascript
// CommonJS (required for backend)
const express = require('express');
const { requireAuth } = require('../middleware/permissions');

module.exports = router;
```

**Error Handling Pattern:**
```javascript
app.get('/api/endpoint', async (req, res) => {
  const correlationId = req.correlationId || `req_${Date.now()}`;

  try {
    const result = await pool.query('SELECT * FROM table WHERE id = $1', [id]);

    return res.json({
      success: true,
      data: result.rows,
      _meta: {
        correlationId,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error(`[${correlationId}] Error: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      _meta: { correlationId, timestamp: new Date().toISOString() }
    });
  }
});
```

### Frontend (React)

**File Organization:**
```
client/src/
  pages/         → Page components (Dashboard, Landing)
  components/    → Reusable components
  utils/         → Helper functions
  App.js         → Main app component
```

**Naming Conventions:**
- Components: PascalCase (`PhotoGallery.js`)
- Functions: camelCase (`fetchPhotos`)
- CSS classes: Tailwind utilities

**Module Pattern:**
```javascript
// ES6 modules (required for frontend)
import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default PhotoGallery;
```

**Axios Configuration:**
```javascript
// Always include credentials for session cookies
axios.defaults.withCredentials = true;

// Use relative URLs (proxied via React dev server)
axios.get('/api/endpoint')
```

---

## Common Implementation Patterns

### 1. Photo Upload with Multer
```javascript
const multer = require('multer');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/cleaning_photos/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'cleaning-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

router.post('/photos',
  requireAuth,
  upload.array('photos', 10), // max 10 files
  async (req, res) => { /* ... */ }
);
```

### 2. RBAC Query Filtering
```javascript
// Workers see only assigned jobs
if (req.session.userType === 'worker') {
  const result = await pool.query(
    `SELECT cj.*
     FROM cleaning_jobs cj
     JOIN cleaning_job_workers cjw ON cj.id = cjw.job_id
     WHERE cjw.worker_id = $1`,
    [req.session.userId]
  );
}

// Admins/Masters see all jobs
else if (['admin', 'master'].includes(req.session.userType)) {
  const result = await pool.query('SELECT * FROM cleaning_jobs');
}
```

### 3. Input Validation
```javascript
const { body, validationResult } = require('express-validator');

router.post('/endpoint',
  requireAuth,
  [
    body('phone').isMobilePhone('pt-PT').withMessage('Invalid Portuguese phone'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be positive'),
    body('status').isIn(['pending', 'paid']).withMessage('Invalid status')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    // ... proceed with validated input
  }
);
```

---

## Debugging Tools

**Backend Debugging:**
```bash
# View server logs
docker-compose logs -f app

# Filter by correlation ID
docker-compose logs -f app | grep "req_1234567"

# Inspect database
docker exec -it lavandaria-db psql -U lavandaria -d lavandaria
```

**Frontend Debugging:**
```javascript
// Browser console
console.log('Photo data:', photos);

// Network tab - check:
// 1. Request headers (Cookie: connect.sid)
// 2. Response envelope (success, data, _meta.correlationId)
// 3. Status codes (200 OK, 401 Unauthorized, 403 Forbidden)
```

---

## When to Ask Maestro for Help

**Developer Should Escalate When:**
1. **Ambiguous Requirements** - Work order unclear about business logic
2. **Schema Changes Needed** - Database migrations required
3. **Breaking API Changes** - Affects existing clients
4. **Security Uncertainty** - Not sure if approach is secure
5. **Blocked by Environment** - Docker, database, or dependency issues

**Escalation Format:**
```markdown
## Developer Escalation: [Brief Issue]

**Work Order:** DWO-20251108-xxx

**Blocker:** Clear description of what's blocking progress

**What I Tried:** Steps already attempted

**Question for Maestro:** Specific question or decision needed

**Impact:** How this affects timeline/scope
```

---

## Success Criteria

**Code Merged When:**
- [ ] All acceptance criteria met
- [ ] Security checklist complete
- [ ] Local tests pass
- [ ] Conventional commit message
- [ ] docs/progress.md updated
- [ ] No regressions in existing functionality
- [ ] Maestro code review approved

---

**Last Updated:** 2025-11-08
**Developer Version:** 1.0.0
