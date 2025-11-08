#!/bin/bash
set -e

REPO_ROOT="/Applications/XAMPP/xamppfiles/htdocs/Lavandaria"
cd "$REPO_ROOT"

PR_SEQUENCE=(2 3 6 1 4 5 7 8 10)

for PR_NUM in "${PR_SEQUENCE[@]}"; do
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Merging PR #$PR_NUM"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  # Checkout PR
  gh pr checkout $PR_NUM

  # Merge
  gh pr merge $PR_NUM --merge --delete-branch || {
    echo "❌ Merge failed for PR #$PR_NUM"
    exit 1
  }

  # Go back to main and pull merged changes
  git checkout main
  git pull origin main
  
  # Post-merge validation on main
  ./scripts/preflight-health-check.sh || {
    echo "❌ Post-merge preflight failed for PR #$PR_NUM"
    git revert -m 1 HEAD
    git push origin main
    exit 1
  }

  # Run E2E tests
  CI=true npm run test:e2e 2>&1 | tee /tmp/merge-pr-${PR_NUM}.log

  echo "✅ PR #$PR_NUM merged successfully"
  sleep 5
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  All PRs merged successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
