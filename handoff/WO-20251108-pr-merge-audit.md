# WORK ORDER: WO-20251108-pr-merge-audit

## (i) WORK ORDER HEADER

**ID:** WO-20251108-pr-merge-audit
**Title:** Audit & Merge Open PRs - Establish Clean Baseline
**Priority:** P0 (Critical - Blocks New Development)
**Created:** 2025-11-08
**Type:** Technical Debt Reduction
**Owner:** Maestro (Direct Execution - No Agent Spawn)

### Rationale
- **Blocks:** New feature development (10 PRs = 10 divergent branches)
- **Impact:** Clean baseline enables confident new work, reduces merge conflicts
- **Root Cause:** PRs created but not merged over 17-day period (Oct 22 - Nov 8)
- **Strategic Value:** Establishes single source of truth in main branch, reduces cognitive overhead

### Current State
```
PR Backlog:
  10 open PRs (all MERGEABLE, no conflicts)
  Oldest: Oct 22 (PR #1 - Tab Navigation)
  Newest: Oct 28 (PR #10 - Session Persistence)

E2E Test State:
  Current: 41/47 passing (87.2%)
  Target: 47/47 passing (100%)
  Delta: 6 failing tests

Branch Divergence:
  13 feature branches (some merged to main already via feat/e2e-seedless-redesign)
  Main branch: Last merge was feat/e2e-seedless-redesign (v1.1.0)
```

---

## (ii) ACCEPTANCE CRITERIA

### PR Merge Completion
- [ ] All 10 PRs reviewed and categorized
- [ ] Merge sequence defined (dependencies identified)
- [ ] Each PR merged with E2E validation
- [ ] No regressions introduced (maintain ≥87.2% pass rate)
- [ ] Stale branches deleted after merge

### Code Quality
- [ ] No merge conflicts
- [ ] All commits have conventional format
- [ ] Documentation updated per PR
- [ ] Correlation IDs present in all new code

### Testing
- [ ] E2E baseline established: X/47 passing after all merges
- [ ] No new test failures introduced
- [ ] Playwright artifacts collected for each merge
- [ ] Preflight checks pass after each merge

### Documentation
- [ ] docs/progress.md updated with merge activity
- [ ] docs/decisions.md captures any architectural choices
- [ ] README.md reflects current state (if changed)

---

## (iii) TERMINAL-FIRST PLAN

### Phase 1: PR Audit & Categorization (30 min)

**Objective:** Understand each PR's purpose, dependencies, and merge safety

```bash
# 1. Detailed PR analysis
for pr_num in 1 2 3 4 5 6 7 8 9 10; do
  echo "=== PR #$pr_num ==="
  gh pr view $pr_num --json title,body,headRefName,baseRefName,files,reviewDecision,mergeable
  echo ""
done > /tmp/pr-audit.json

# 2. Check for inter-PR dependencies
git log --oneline --graph --all --decorate | head -50

# 3. Identify which branches are already in main
git branch --merged main

# 4. Check current E2E baseline
npm run test:preflight
CI=true npm run test:e2e 2>&1 | tee /tmp/e2e-baseline.log
# Record: X/47 passing before any merges
```

**Categorization Criteria:**

**Category A: SAFE TO MERGE (Low Risk)**
- Documentation-only changes
- Test infrastructure (no production code)
- Bug fixes with test coverage

**Category B: REQUIRES TESTING (Medium Risk)**
- Feature additions
- Refactors with behavioral changes
- RBAC/security changes

**Category C: BLOCKED/DRAFT (High Risk)**
- Marked as DRAFT
- Missing tests
- Known failures
- Depends on other PRs

---

### Phase 2: Merge Sequence Definition (15 min)

**Dependency Analysis:**

Based on PR titles and dates:

```
Foundation Layer (merge first):
  PR #2: Purge legacy docs (chore, safe)
  PR #3: Bootstrap new docs (depends on #2)

Infrastructure Layer:
  PR #1: Tab navigation fix (UI, independent)
  PR #4: Login form visibility (UI, independent)
  PR #5: E2E auth flows (depends on #4)
  PR #6: Deterministic seed (test infra, independent)

Feature/Fix Layer:
  PR #7: Photo endpoints (feature, depends on #6 for tests)
  PR #8: Session/health/RBAC (feature, may depend on #7)
  PR #10: Session persistence (bug fix, depends on #8)

Investigation/Draft:
  PR #9: Worker media UI tests (DRAFT/BLOCKED - skip for now)
```

**Proposed Merge Sequence:**
```
1. PR #2 → Purge docs (safe, no conflicts)
2. PR #3 → Bootstrap docs (depends on #2)
3. PR #6 → Deterministic seed (test infra)
4. PR #1 → Tab navigation (UI fix)
5. PR #4 → Login visibility (UI fix)
6. PR #5 → E2E auth flows (depends on #4)
7. PR #7 → Photo endpoints (depends on #6 for tests)
8. PR #8 → Session/health/RBAC (feature)
9. PR #10 → Session persistence (bug fix)
10. PR #9 → DEFER (DRAFT/BLOCKED - needs WO resolution first)
```

---

### Phase 3: Execute Merges with Validation (2-3 hours)

**Pattern for Each PR:**

```bash
# Template (repeat for each PR in sequence)
PR_NUM=2
BRANCH=$(gh pr view $PR_NUM --json headRefName -q .headRefName)

# 1. Checkout and verify
git checkout main
git pull origin main
gh pr checkout $PR_NUM

# 2. Preflight check
./scripts/preflight-health-check.sh

# 3. Run E2E tests (baseline for this branch)
CI=true npm run test:e2e 2>&1 | tee /tmp/pr-${PR_NUM}-tests.log
# Record: X/47 passing

# 4. Review changes one last time
git diff main..HEAD --stat
gh pr view $PR_NUM --json files -q '.files[].path'

# 5. Merge via GitHub CLI (creates merge commit)
gh pr merge $PR_NUM --merge --delete-branch

# 6. Pull merged changes
git checkout main
git pull origin main

# 7. Post-merge validation
./scripts/preflight-health-check.sh
CI=true npm run test:e2e 2>&1 | tee /tmp/post-merge-pr-${PR_NUM}.log
# Verify: No regressions (X/47 should not decrease)

# 8. If regression detected:
if [ $? -ne 0 ]; then
  echo "⚠️  REGRESSION DETECTED - Reverting PR #$PR_NUM"
  git revert -m 1 HEAD
  git push origin main
  # Create rollback issue
  gh issue create --title "ROLLBACK: PR #$PR_NUM caused regression" \
    --body "Test log: /tmp/post-merge-pr-${PR_NUM}.log"
  exit 1
fi

# 9. Collect artifacts
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
cp /tmp/post-merge-pr-${PR_NUM}.log preflight-results/merge-pr-${PR_NUM}-${TIMESTAMP}.log
```

**Batch Execution Script:**

```bash
#!/bin/bash
# scripts/merge-pr-sequence.sh

set -e  # Exit on first failure

PR_SEQUENCE=(2 3 6 1 4 5 7 8 10)

for PR_NUM in "${PR_SEQUENCE[@]}"; do
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Merging PR #$PR_NUM"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  # Checkout PR
  gh pr checkout $PR_NUM

  # Preflight
  ./scripts/preflight-health-check.sh || {
    echo "❌ Preflight failed for PR #$PR_NUM"
    exit 1
  }

  # Test
  CI=true npm run test:e2e || {
    echo "⚠️  Tests failing on PR #$PR_NUM branch (may be expected)"
  }

  # Merge
  gh pr merge $PR_NUM --merge --delete-branch || {
    echo "❌ Merge failed for PR #$PR_NUM"
    exit 1
  }

  # Post-merge validation
  git checkout main
  git pull origin main
  ./scripts/preflight-health-check.sh || {
    echo "❌ Post-merge preflight failed for PR #$PR_NUM"
    git revert -m 1 HEAD
    git push origin main
    exit 1
  }

  CI=true npm run test:e2e 2>&1 | tee /tmp/merge-pr-${PR_NUM}.log

  echo "✅ PR #$PR_NUM merged successfully"
  sleep 5  # Cooldown
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  All PRs merged successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

---

### Phase 4: Post-Merge Cleanup (15 min)

```bash
# 1. Delete merged branches (if not auto-deleted)
git branch --merged main | grep -v "main\|master" | xargs git branch -d

# 2. Verify remote branches cleaned
git fetch --prune

# 3. Final E2E baseline
CI=true npm run test:e2e 2>&1 | tee preflight-results/final-baseline-20251108.log

# 4. Generate HTML report
npm run test:e2e:report

# 5. Tag the clean baseline
git tag -a v1.2.0-baseline -m "Clean baseline after PR merge sequence (9 PRs merged, 1 deferred)"
git push origin v1.2.0-baseline

# 6. Update docs
# docs/progress.md: Add entry for merge activity
# docs/decisions.md: Document merge sequence and rationale
```

---

## (iv) ARTIFACTS TO ATTACH

### Required Artifacts
1. **PR Audit JSON**: `/tmp/pr-audit.json` - Full details of all 10 PRs
2. **E2E Baseline Log**: `/tmp/e2e-baseline.log` - Test state before merges
3. **Merge Logs**: `/tmp/merge-pr-{2,3,6,1,4,5,7,8,10}.log` - Post-merge test results for each
4. **Final Baseline**: `preflight-results/final-baseline-20251108.log` - Final test state
5. **HTML Report**: `playwright-report/index.html` - Visual test report
6. **Git Log**: `git log --oneline --graph -20` - Merge commit history

### Artifact Verification Commands
```bash
# Ensure all artifacts present
ls -lh /tmp/pr-audit.json
ls -lh /tmp/e2e-baseline.log
ls -lh /tmp/merge-pr-*.log | wc -l  # Should be 9 files
ls -lh preflight-results/final-baseline-20251108.log
ls -lh playwright-report/index.html
```

---

## (v) DOCS AUTO-UPDATE SET

### Files to Update

**1. docs/progress.md**
```markdown
## 2025-11-08

### Planned
- [x] Audit 10 open PRs
- [x] Merge PR sequence (9 PRs, defer 1 DRAFT)
- [x] Establish clean baseline for new development

### Done
- ✅ **PR Merge Sequence Completed**:
  - Merged: PR #2, #3, #6, #1, #4, #5, #7, #8, #10 (9 total)
  - Deferred: PR #9 (DRAFT/BLOCKED - needs WO-20251030-worker-ui-photo-consolidation)
  - E2E Baseline: X/47 passing (Y%)
  - No regressions introduced
  - Commits: [list merge commit SHAs]
  - Tag: v1.2.0-baseline

### Pass Rate Progress
- Before merges: 41/47 (87.2%)
- After merges: X/47 (Y%)
- Delta: +/- N tests
```

**2. docs/decisions.md**
```markdown
## 2025-11-08 - PR Merge Sequence Strategy

### Context
10 open PRs accumulated over 17 days (Oct 22 - Nov 8), creating technical debt and context overhead. Needed to establish clean baseline before new development.

### Options Considered

**Option 1: Merge all PRs at once** ❌
- Pro: Fast
- Con: High regression risk, hard to identify culprit if tests break

**Option 2: Cherry-pick commits to main** ❌
- Pro: Fine-grained control
- Con: Loses PR metadata, breaks GitHub history

**Option 3: Sequential merge with validation** ✅ (chosen)
- Pro: E2E tests after each merge catch regressions early
- Pro: Can revert individual PR if needed
- Pro: Maintains GitHub PR history
- Con: Slower (2-3 hours total)

### Decision
✅ Sequential merge in dependency order with E2E validation after each

**Merge Sequence:**
1. Documentation (PR #2, #3) - Foundation
2. Test infra (PR #6) - Enables feature tests
3. UI fixes (PR #1, #4, #5) - Authentication flow
4. Features (PR #7, #8, #10) - Photo endpoints, RBAC, session persistence
5. Deferred (PR #9) - DRAFT/BLOCKED, needs separate WO

### Consequences

**Positive:**
- ✅ Clean baseline established (v1.2.0-baseline tag)
- ✅ 9 PRs merged without regressions
- ✅ Test state: X/47 passing (Y%)
- ✅ Reduced branch divergence (13 → 4 active branches)

**Negative:**
- ⚠️ 2-3 hour investment for merge sequence
- ⚠️ PR #9 still open (requires separate work)

**Mitigation:**
- Automated merge script for future batches
- Establish PR merge cadence (weekly review)
```

**3. README.md** (if needed)
```markdown
## Recent Updates

**2025-11-08:** Merged 9 PRs establishing clean baseline (v1.2.0-baseline)
- Documentation overhaul (canonical docs in `docs/`)
- E2E test infrastructure (deterministic seed, preflight checks)
- UI fixes (tab navigation, login visibility, auth flows)
- Features (photo endpoints, session persistence, RBAC normalization)
- Current E2E pass rate: X/47 (Y%)
```

---

## (vi) PR PACKAGE CHECKLIST

**N/A** - This WO does not create a new PR; it merges existing PRs.

### Post-Completion Deliverable

**Delivery Record:** `handoff/DELIVERIES/DEL-WO-20251108-pr-merge-audit.md`

```markdown
# DELIVERY: WO-20251108-pr-merge-audit

## Summary
Merged 9 of 10 open PRs in dependency order with E2E validation after each merge.

## Merged PRs
1. PR #2 - Purge legacy docs ✅
2. PR #3 - Bootstrap canonical docs ✅
3. PR #6 - Deterministic seed ✅
4. PR #1 - Tab navigation ✅
5. PR #4 - Login visibility ✅
6. PR #5 - E2E auth flows ✅
7. PR #7 - Photo endpoints ✅
8. PR #8 - Session/health/RBAC ✅
9. PR #10 - Session persistence ✅

## Deferred PRs
1. PR #9 - Worker media UI tests (DRAFT/BLOCKED)
   - Reason: Requires WO-20251030-worker-ui-photo-consolidation completion
   - Next Action: Execute WO-20251030, then merge PR #9

## Test Results
- Before: 41/47 passing (87.2%)
- After: X/47 passing (Y%)
- Regressions: None/[List if any]

## Artifacts
- Baseline: preflight-results/final-baseline-20251108.log
- Merge logs: /tmp/merge-pr-*.log (9 files)
- HTML report: playwright-report/index.html
- Git tag: v1.2.0-baseline

## Next Steps
1. Execute WO-20251030-worker-ui-photo-consolidation (fix 6 failing tests)
2. Merge PR #9 after WO-20251030 complete
3. Target: 47/47 tests passing (100%)
```

---

## (vii) IMPLEMENTER HANDOFF

=== MAESTRO DIRECT EXECUTION (NO AGENT SPAWN) ===

**OBJECTIVE:**
Merge 9 of 10 open PRs in dependency-safe sequence with E2E validation after each merge.

**ACCEPTANCE:**
- 9 PRs merged successfully
- No regressions introduced (maintain ≥87.2% pass rate)
- Clean baseline established with v1.2.0-baseline tag
- Documentation updated (progress.md, decisions.md)

**TERMINAL COMMANDS (exact sequence):**

```bash
# Phase 1: Audit (10 min)
cd /Applications/XAMPP/xamppfiles/htdocs/Lavandaria

# Baseline test state
npm run test:preflight
CI=true npm run test:e2e 2>&1 | tee /tmp/e2e-baseline.log
grep "passing" /tmp/e2e-baseline.log | tail -1
# Record: X/47 passing

# Phase 2: Create merge script (5 min)
cat > scripts/merge-pr-sequence.sh << 'EOF'
#!/bin/bash
set -e
PR_SEQUENCE=(2 3 6 1 4 5 7 8 10)
for PR_NUM in "${PR_SEQUENCE[@]}"; do
  echo "━━━ Merging PR #$PR_NUM ━━━"
  gh pr checkout $PR_NUM
  ./scripts/preflight-health-check.sh || exit 1
  gh pr merge $PR_NUM --merge --delete-branch || exit 1
  git checkout main && git pull origin main
  ./scripts/preflight-health-check.sh || { git revert -m 1 HEAD && git push origin main && exit 1; }
  CI=true npm run test:e2e 2>&1 | tee /tmp/merge-pr-${PR_NUM}.log
  echo "✅ PR #$PR_NUM merged"
  sleep 5
done
EOF

chmod +x scripts/merge-pr-sequence.sh

# Phase 3: Execute merges (2-3 hours)
./scripts/merge-pr-sequence.sh

# Phase 4: Post-merge cleanup (15 min)
git branch --merged main | grep -v "main\|master" | xargs git branch -d
git fetch --prune
CI=true npm run test:e2e 2>&1 | tee preflight-results/final-baseline-20251108.log
npm run test:e2e:report
git tag -a v1.2.0-baseline -m "Clean baseline after 9 PR merges"
git push origin v1.2.0-baseline

# Phase 5: Document (10 min)
# Update docs/progress.md with merge activity
# Update docs/decisions.md with merge sequence rationale
git add docs/
git commit -m "docs: record PR merge sequence and baseline establishment"
git push origin main

# Create delivery record
mkdir -p handoff/DELIVERIES
cat > handoff/DELIVERIES/DEL-WO-20251108-pr-merge-audit.md << 'DELEOF'
[Paste content from section (vi) above]
DELEOF

git add handoff/DELIVERIES/
git commit -m "chore: create delivery record for WO-20251108-pr-merge-audit"
git push origin main
```

**ARTIFACT NAMES:**
- E2E Baseline: `/tmp/e2e-baseline.log`
- Merge Logs: `/tmp/merge-pr-{2,3,6,1,4,5,7,8,10}.log` (9 files)
- Final Baseline: `preflight-results/final-baseline-20251108.log`
- HTML Report: `playwright-report/index.html`
- Delivery Record: `handoff/DELIVERIES/DEL-WO-20251108-pr-merge-audit.md`

**COMPLETION SIGNAL:**
Reply with:
- Merged PRs: [list 9 PRs merged]
- Test Results: Before/After (X/47 → Y/47)
- Regressions: None/[List]
- Tag Created: v1.2.0-baseline
- Delivery Record: [path]
- "WO-20251108-pr-merge-audit COMPLETE"

=== MAESTRO DIRECT EXECUTION END ===

---

## MAESTRO NOTES

### Execution Mode
This WO is **Maestro Direct Execution** (not delegated to implementer-qa) because:
1. Requires judgment calls during merge (revert if regression)
2. Interactive GitHub CLI operations
3. High-stakes operation (affects main branch)
4. Merge script execution needs real-time monitoring

### Risk Assessment
- **Regression Risk:** MEDIUM (9 PRs merging, but sequential validation mitigates)
- **Rollback Complexity:** LOW (each PR can be reverted individually)
- **Deployment Impact:** NONE (merging to main, not deploying)

### Success Criteria
- [ ] 9 PRs merged
- [ ] Test pass rate ≥87.2% (no decrease)
- [ ] v1.2.0-baseline tag created
- [ ] Documentation updated
- [ ] Delivery record created

### Next Work Order Priority
After this WO completes:
1. **WO-20251030-worker-ui-photo-consolidation** (P1) - Fix 6 failing tests
   - Impact: 41/47 → 47/47 (87.2% → 100%)
   - Then merge PR #9
2. **WO-NEXT-new-feature** (P2) - New development on clean baseline

---

**END OF WORK ORDER**
