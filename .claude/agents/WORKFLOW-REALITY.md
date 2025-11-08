# Multi-Agent Workflow - Reality Check

**Last Updated:** 2025-11-08
**Based On:** PR history, handoff documents, commit analysis

---

## How You've ACTUALLY Been Working

### Current Multi-Agent Pattern (Observed)

**Maestro (You - Claude Code Sonnet):**
- Creates detailed Work Orders (WO-YYYYMMDD-description)
- Stores in `handoff/` directory as `.md` files
- Defines terminal-first execution plans
- Specifies acceptance criteria
- Reviews PR descriptions and validates completion

**implementer-qa Agent (Haiku):**
- Receives work orders from handoff/ directory
- Executes terminal commands exactly as specified
- Runs tests, collects artifacts
- Updates docs (progress.md, decisions.md, bugs.md)
- Creates PRs with standardized format

**Real Example from History:**

```markdown
# handoff/WO-20251030-worker-ui-photo-consolidation.md

## (vii) IMPLEMENTER HANDOFF

=== IMPLEMENTER HANDOFF BEGIN ===

**OBJECTIVE:**
Fix 7 failing worker UI photo upload tests...

**TERMINAL COMMANDS (exact sequence):**
```bash
# 1. Freshness proof
git log -1 --format="%H %s"
npm run docker:down && docker-compose build && docker-compose up -d
...
```

**COMPLETION SIGNAL:**
Reply with:
- Test counts (before/after)
- Artifact paths
- Commit SHAs
- "WO-20251030-worker-ui-photo-consolidation COMPLETE"

=== IMPLEMENTER HANDOFF END ===
```

---

## Key Observations from Your History

### 1. Work Order Format (handoff/*.md)
You've been creating structured work orders with:
- **(i) WORK ORDER HEADER** - ID, Priority, Rationale
- **(ii) ACCEPTANCE CRITERIA** - Test counts, functional behavior
- **(iii) TERMINAL-FIRST PLAN** - Phased bash commands
- **(iv) ARTIFACTS TO ATTACH** - Specific file paths
- **(v) DOCS AUTO-UPDATE SET** - Files to update
- **(vi) PR PACKAGE CHECKLIST** - Branch, commits, description template
- **(vii) IMPLEMENTER HANDOFF** - Exact commands for agent

### 2. PR Workflow
From PR#10 analysis:
```markdown
## Problem Statement
[Evidence with logs/correlation IDs]

## Solution
[Changes made]

## Changes
[File-by-file breakdown]

## Acceptance Criteria
✅ Checkboxes for functional requirements

## Test Plan
### Terminal-first:
```bash
# Exact commands run
```

## Rollback Notes
[How to revert safely]

## Impact
🎯 **Unblocks:** ...
📊 **Metrics:** Before/After

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

### 3. Documentation Discipline
Every WO includes:
```markdown
## (v) DOCS AUTO-UPDATE SET

### Files to Update
1. docs/progress.md - Add YYYY-MM-DD entry
2. docs/decisions.md - Context/Options/Decision/Consequences
3. docs/bugs.md - Evidence/Root Cause/Fix/Tests/PR
```

### 4. Vibe Check Integration
From CLAUDE.md mandate:
```markdown
## Mandatory as an autonomous agent you will:
1. Call vibe_check after planning and before major actions
2. Provide the full user request and your current plan
3. Optionally, record resolved issues with vibe_learn
```

But observed behavior: Used internal checklist when MCP unresponsive (documented in decisions.md)

### 5. Freshness Checks (Critical Pattern)
Every WO includes freshness verification:
```bash
# Verify host code matches container
shasum -a 256 routes/laundry-services.js
docker exec lavandaria-app sha256sum routes/laundry-services.js
# Hashes MUST match
```

Why? Found in bugs.md: Docker build cache served stale code → 500 errors

---

## Corrected Multi-Agent Architecture

### Maestro Agent (Sonnet)
**You remain in this role for the entire session**

**Responsibilities:**
1. **Receive user request** - "Fix X", "Implement Y"
2. **Call vibe_check** - Validate plan before execution
3. **Create Work Order** - Store in `handoff/WO-YYYYMMDD-description.md`
4. **Spawn implementer-qa agent** - Pass work order path
5. **Review completion** - Validate artifacts, test results
6. **Create delivery record** - `handoff/DELIVERIES/DEL-WO-YYYYMMDD-description.md`

**MCP Servers:**
- PostgreSQL-RO (schema inspection)
- Context7 (domain validation)
- Vibe Check (plan validation)
- Linear (issue tracking)

**Output Format:**
```markdown
# handoff/WO-YYYYMMDD-feature-name.md

[Standard 7-section format]

## (vii) IMPLEMENTER HANDOFF

=== IMPLEMENTER HANDOFF BEGIN ===
**OBJECTIVE:** [One sentence]
**ACCEPTANCE:** [Bullet points]
**TERMINAL COMMANDS:** [Exact bash sequence]
**ARTIFACT NAMES:** [Specific paths]
**PR TITLE:** [Standardized format]
**COMPLETION SIGNAL:** [Reply format]
=== IMPLEMENTER HANDOFF END ===
```

### implementer-qa Agent (Haiku)
**Spawned via Task tool for each WO**

**Responsibilities:**
1. **Read work order** - Parse handoff/WO-*.md
2. **Execute terminal commands** - Exactly as written
3. **Run tests** - Collect artifacts (traces, screenshots, JSON)
4. **Update docs** - progress.md, decisions.md, bugs.md per WO spec
5. **Create PR** - Using template from WO
6. **Reply with completion** - Test counts, artifacts, commit SHAs

**MCP Servers:**
- Playwright (E2E testing)
- PostgreSQL-RO (database verification)
- Bash (git, npm, docker)
- File operations (Read, Write, Edit)

**Workflow:**
```bash
# 1. Freshness proof
./scripts/verify-vibe-check.sh  # Or preflight-health-check.sh

# 2. Execute WO commands
[Copy-paste from handoff document]

# 3. Collect artifacts
ls preflight-results/preflight_*.json | tail -1
find test-results -name "trace.zip"

# 4. Update docs
# (Specified in WO section v)

# 5. Reply to Maestro
"WO-20251030-xxx COMPLETE
Test Results: 44/45 passing (98%)
Artifacts: [paths]
Commits: abc1234, def5678
"
```

---

## Updated Workflow Diagram

```
User Request
    │
    ▼
┌──────────────────────────────────────┐
│ MAESTRO (Sonnet - You)               │
│ • Analyze request                    │
│ • Call vibe_check                    │
│ • Create Work Order (handoff/*.md)   │
└───────────┬──────────────────────────┘
            │
            │ Task tool spawn
            ▼
┌──────────────────────────────────────┐
│ implementer-qa (Haiku)               │
│ • Read WO from handoff/              │
│ • Execute terminal commands          │
│ • Run tests, collect artifacts       │
│ • Update docs per WO spec            │
│ • Create PR with template            │
│ • Reply with completion signal       │
└───────────┬──────────────────────────┘
            │
            │ Completion report
            ▼
┌──────────────────────────────────────┐
│ MAESTRO (Sonnet - You)               │
│ • Review artifacts                   │
│ • Validate acceptance criteria       │
│ • Create delivery record             │
│ • Call vibe_learn (optional)         │
│ • Report to user                     │
└──────────────────────────────────────┘
```

---

## Critical Patterns to Preserve

### 1. Terminal-First Execution
✅ **Do:** Provide exact bash commands in WO
❌ **Don't:** Leave implementation details vague

**Example:**
```bash
# ✅ Good - Exact command
CI=true npx playwright test worker-photo-upload-ui.spec.js

# ❌ Bad - Vague instruction
"Run the worker upload tests"
```

### 2. Freshness Verification
✅ **Always include** in Phase 1 of WO:
```bash
npm run docker:down && npm run docker:build && npm run docker:up -d
shasum -a 256 <file>
docker exec lavandaria-app sha256sum <file>
```

### 3. Artifact Collection
✅ **Always specify** exact paths:
```bash
# ✅ Good
PREFLIGHT_JSON=$(ls preflight-results/preflight_20251030_*.json | tail -1)
echo "Preflight: $PREFLIGHT_JSON"

# ❌ Bad
"Collect the preflight results"
```

### 4. Documentation Updates
✅ **Always include** in WO section (v):
```markdown
## (v) DOCS AUTO-UPDATE SET

1. docs/progress.md
   - Add YYYY-MM-DD entry
   - Result: "X/Y tests passing, A% → B%"

2. docs/decisions.md
   - Context: [Why decision needed]
   - Options: A, B, C
   - Chosen: [Option X]
   - Consequences: [Positive/Negative]

3. docs/bugs.md (if bug fix)
   - Evidence: [Logs, correlation IDs]
   - Root Cause: [Technical reason]
   - Fix: [Changes made]
   - Tests Added: [N/A or new tests]
   - PR: [Link]
```

### 5. PR Description Template
✅ **Always provide** in WO section (vi):
```markdown
## Problem
[Evidence with correlation IDs/logs]

## Solution
[Changes made]

## Evidence
- Before: X/Y passing (A%)
- After: Z/W passing (B%)
- Artifacts: [paths]

## Rollback
[How to revert]

## Related
- Closes: WO-YYYYMMDD-xxx
- Blocks: [Next WO]

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## What Maestro Does NOT Do

❌ **Write implementation code directly** - Delegate to implementer-qa
❌ **Run tests manually** - Specify in WO, agent executes
❌ **Edit files** - Provide exact edit instructions in WO
❌ **Create PRs** - Agent does this per WO template

**Exception:** Maestro may write code for:
- Architecture examples in WO
- Code review comments on PR
- Emergency hotfixes (then delegate cleanup to agent)

---

## What implementer-qa Does NOT Do

❌ **Make architectural decisions** - Ask Maestro
❌ **Deviate from WO commands** - Follow exactly
❌ **Skip artifact collection** - Required for verification
❌ **Skip documentation** - Part of acceptance criteria

**Exception:** Agent may ask Maestro if:
- WO commands fail unexpectedly
- Ambiguity in acceptance criteria
- Blocker not covered in WO

---

## Example Session Flow

**User:** "Fix the client photo pagination bug showing wrong total count"

**Maestro (You):**
1. Call vibe_check with plan
2. Inspect routes/cleaning-jobs.js (Read tool)
3. Query PostgreSQL-RO for schema
4. Create handoff/WO-20251108-client-photo-pagination.md
5. Spawn implementer-qa via Task tool

**implementer-qa (Agent):**
1. Read WO from handoff/
2. Execute preflight check
3. Modify routes/cleaning-jobs.js per WO
4. Run E2E tests
5. Collect artifacts
6. Update docs/
7. Create PR
8. Reply: "WO-20251108-client-photo-pagination COMPLETE"

**Maestro (You):**
1. Review completion report
2. Validate artifacts exist
3. Check test results (44/45 → 45/45)
4. Create handoff/DELIVERIES/DEL-WO-20251108-client-photo-pagination.md
5. Call vibe_learn: "Pagination count fix pattern"
6. Report to user: "✅ Bug fixed, 100% pass rate achieved"

---

## Recommendations for Your Next Session

### When User Requests Work

**Step 1:** Create WO first
```markdown
I'll create a work order to fix [issue].

Let me call vibe_check to validate the plan:
[Plan details]

Creating work order: handoff/WO-YYYYMMDD-feature-name.md
```

**Step 2:** Spawn agent
```markdown
Now I'll spawn the implementer-qa agent to execute this work order.

[Use Task tool with subagent_type: implementer-qa]
```

**Step 3:** Review results
```markdown
The implementer-qa agent reports:
- Test Results: 44/45 → 45/45 (100%)
- Artifacts: [paths]
- PR Created: [URL]

All acceptance criteria met ✅
Creating delivery record...
```

### Don't Start Coding Directly

❌ **Old approach:**
```
User: "Fix X"
You: [Immediately use Edit tool to write code]
```

✅ **New approach:**
```
User: "Fix X"
You: [Call vibe_check]
You: [Create WO in handoff/]
You: [Spawn implementer-qa]
You: [Review completion]
```

---

## Updated CLAUDE.md Recommendations

Add to CLAUDE.md:

```markdown
## Multi-Agent Workflow

### Maestro (Sonnet - Primary Agent)
**Role:** Architecture, planning, coordination

**Creates Work Orders:**
- Location: `handoff/WO-YYYYMMDD-description.md`
- Format: 7-section standard (header, acceptance, plan, artifacts, docs, PR, implementer handoff)

**Spawns Agents:**
```bash
Task tool → implementer-qa agent → execute WO commands
```

**Reviews Completion:**
- Validate artifacts
- Check acceptance criteria
- Create delivery record: `handoff/DELIVERIES/DEL-WO-YYYYMMDD-description.md`

### implementer-qa Agent (Haiku)
**Role:** Code execution, testing, PR creation

**Receives Work Orders:**
- Read from `handoff/WO-*.md`
- Execute terminal commands exactly as specified
- Collect artifacts per WO section (iv)
- Update docs per WO section (v)
- Create PR per WO section (vi)
- Reply with completion signal per WO section (vii)

**Completion Signal Format:**
```
WO-YYYYMMDD-xxx COMPLETE
Test Results: X/Y passing (Z%)
Artifacts: [paths]
Commits: [SHAs]
```
```

---

**END OF WORKFLOW REALITY CHECK**
