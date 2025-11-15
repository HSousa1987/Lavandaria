# Work Order Summary: WO-20251108-pr-merge-audit

**Status:** 📋 READY FOR EXECUTION
**Created:** 2025-11-08 02:42 UTC
**Owner:** Maestro (Direct Execution)

---

## 🎯 Objective

Merge 9 of 10 open PRs in dependency-safe sequence to establish clean baseline before tackling remaining 6 E2E test failures.

---

## 📊 Current State Analysis

### PR Backlog (10 PRs)
```
✅ All 10 PRs are MERGEABLE (no conflicts)
✅ Oldest: Oct 22 (PR #1)
✅ Newest: Oct 28 (PR #10)
✅ Age: 17 days maximum
```

### E2E Test State
```
Current: 41/47 passing (87.2%) - from main branch
Target: 47/47 passing (100%)
Delta: 6 failing tests
```

### Branch Situation
```
13 feature branches exist
Main branch last updated: v1.1.0 (feat/e2e-seedless-redesign merge)
```

---

## 🗺️ Merge Sequence (Dependency Order)

**Foundation Layer (Documentation):**
1. **PR #2** - Purge legacy docs (chore, safe)
2. **PR #3** - Bootstrap canonical docs (depends on #2)

**Infrastructure Layer (Test Setup):**
3. **PR #6** - Deterministic seed data (enables reliable tests)

**UI Fixes (Authentication Flow):**
4. **PR #1** - Tab navigation ARIA fix
5. **PR #4** - Login form visibility fix
6. **PR #5** - E2E auth flow alignment (depends on #4)

**Feature/Fix Layer:**
7. **PR #7** - Photo endpoints (depends on #6 for seed data)
8. **PR #8** - Session/health/RBAC standardization
9. **PR #10** - Session persistence fix (depends on #8)

**Deferred (DRAFT/BLOCKED):**
10. **PR #9** - Worker media UI tests ⚠️ SKIP FOR NOW
    - Reason: Marked DRAFT/BLOCKED
    - Next: Needs WO-20251030-worker-ui-photo-consolidation first

---

## ⚡ Quick Start Commands

### Option A: Automated Sequence (Recommended)
```bash
cd /Applications/XAMPP/xamppfiles/htdocs/Lavandaria

# Create and execute merge script
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
./scripts/merge-pr-sequence.sh
```

**Time Estimate:** 2-3 hours (automated, supervised)

### Option B: Manual Merge (If Script Fails)
```bash
# For each PR in sequence: 2, 3, 6, 1, 4, 5, 7, 8, 10

PR_NUM=2  # Change for each iteration

gh pr checkout $PR_NUM
./scripts/preflight-health-check.sh
gh pr merge $PR_NUM --merge --delete-branch
git checkout main && git pull origin main
./scripts/preflight-health-check.sh
CI=true npm run test:e2e 2>&1 | tee /tmp/merge-pr-${PR_NUM}.log
```

---

## ✅ Post-Merge Checklist

After all 9 PRs merged:

```bash
# 1. Clean up branches
git branch --merged main | grep -v "main\|master" | xargs git branch -d
git fetch --prune

# 2. Final E2E baseline
CI=true npm run test:e2e 2>&1 | tee preflight-results/final-baseline-20251108.log
npm run test:e2e:report

# 3. Tag clean baseline
git tag -a v1.2.0-baseline -m "Clean baseline after 9 PR merges"
git push origin v1.2.0-baseline

# 4. Update documentation
# - docs/progress.md: Add merge activity entry
# - docs/decisions.md: Document merge sequence rationale

git add docs/
git commit -m "docs: record PR merge sequence and baseline establishment"
git push origin main

# 5. Create delivery record
# Copy content from WO-20251108-pr-merge-audit.md section (vi)
# Save to: handoff/DELIVERIES/DEL-WO-20251108-pr-merge-audit.md

git add handoff/DELIVERIES/
git commit -m "chore: create delivery record for WO-20251108-pr-merge-audit"
git push origin main
```

---

## 🎯 Success Criteria

- [x] Work Order created: `handoff/WO-20251108-pr-merge-audit.md`
- [ ] 9 PRs merged successfully
- [ ] No regressions (test pass rate ≥87.2%)
- [ ] v1.2.0-baseline tag created
- [ ] Documentation updated
- [ ] Delivery record created
- [ ] PR #9 remains open (to be handled separately)

---

## 🚨 Rollback Plan

If any PR causes regression:

```bash
# Immediate rollback
git revert -m 1 HEAD
git push origin main

# Create issue
gh issue create --title "ROLLBACK: PR #X caused regression" \
  --body "Test log: /tmp/merge-pr-X.log"

# Stop merge sequence
exit 1
```

---

## 📈 Expected Outcomes

**Best Case:**
- All 9 PRs merge cleanly
- E2E pass rate maintains or improves (≥87.2%)
- Clean baseline established for new work
- Next: WO-20251030 to fix 6 failing tests → 100% pass rate

**Realistic Case:**
- 8-9 PRs merge successfully
- 0-1 PRs need minor fixes before merge
- E2E pass rate stable (87-90%)
- Minor documentation adjustments needed

**Worst Case:**
- Multiple PRs cause conflicts (unlikely - all show MERGEABLE)
- Test pass rate drops below 80%
- Requires individual PR investigation
- Fallback: Cherry-pick safe PRs only (#2, #3, #6)

---

## 🔄 Next Steps After Completion

**Immediate (Same Session):**
1. Execute WO-20251030-worker-ui-photo-consolidation
   - Fix 6 failing tests
   - Target: 41/47 → 47/47 (100%)

**Short-term (Next Session):**
2. Merge PR #9 after WO-20251030 complete
3. Celebrate 100% E2E pass rate 🎉
4. Begin new feature development on clean baseline

**Long-term (Ongoing):**
- Establish weekly PR review/merge cadence
- Prevent PR backlog accumulation
- Maintain ≥95% E2E pass rate

---

## 📝 Completion Report Template

When done, report:

```markdown
## WO-20251108-pr-merge-audit COMPLETE

**Merged PRs:** #2, #3, #6, #1, #4, #5, #7, #8, #10 (9 total)

**Test Results:**
- Before: 41/47 passing (87.2%)
- After: X/47 passing (Y%)
- Delta: +/- N tests

**Regressions:** None / [List if any]

**Artifacts:**
- Baseline: preflight-results/final-baseline-20251108.log
- Merge logs: /tmp/merge-pr-*.log (9 files)
- HTML report: playwright-report/index.html
- Git tag: v1.2.0-baseline

**Delivery Record:** handoff/DELIVERIES/DEL-WO-20251108-pr-merge-audit.md

**Next Action:** Execute WO-20251030-worker-ui-photo-consolidation
```

---

**Full Work Order:** `handoff/WO-20251108-pr-merge-audit.md`
