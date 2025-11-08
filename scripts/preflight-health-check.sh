#!/bin/bash
# preflight-health-check.sh - Pre-flight health checks before E2E test runs
# Prevents test suite execution when app is unavailable (guards against P0 regressions)

set -e

# Configuration
APP_URL="${APP_URL:-http://localhost:3000}"
ARTIFACTS_DIR="${ARTIFACTS_DIR:-preflight-results}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULTS_FILE="$ARTIFACTS_DIR/preflight_$TIMESTAMP.json"

# Color codes for terminal output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create artifacts directory
mkdir -p "$ARTIFACTS_DIR"

echo -e "${BLUE}🚀 Preflight Health Check${NC}"
echo -e "${BLUE}=========================${NC}"
echo "App URL: $APP_URL"
echo "Timestamp: $(date -Iseconds)"
echo ""

# Initialize results JSON
cat > "$RESULTS_FILE" << JSON
{
  "timestamp": "$(date -Iseconds)",
  "appUrl": "$APP_URL",
  "checks": []
}
JSON

# Helper function to add check result to JSON
add_check_result() {
    local name="$1"
    local status="$2"
    local http_code="$3"
    local correlation_id="$4"
    local duration_ms="$5"
    local message="$6"
    
    # Read existing JSON, add new check, write back
    python3 << PYTHON
import json
with open("$RESULTS_FILE", "r") as f:
    data = json.load(f)
data["checks"].append({
    "name": "$name",
    "status": "$status",
    "httpCode": $http_code if "$http_code" else None,
    "correlationId": "$correlation_id" if "$correlation_id" else None,
    "durationMs": $duration_ms if "$duration_ms" else None,
    "message": "$message"
})
with open("$RESULTS_FILE", "w") as f:
    json.dump(data, f, indent=2)
PYTHON
}

# Check 1: Root page returns OK
echo -e "1️⃣  ${BLUE}Checking root page (/)...${NC}"
START_S=$(date +%s)
RESPONSE=$(curl -s -w "\n%{http_code}" "$APP_URL/" 2>&1 || echo -e "\nERROR")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
DURATION_MS=$(( ($(date +%s) - START_S) * 1000 ))

if [[ "$HTTP_CODE" == "200" ]] && echo "$BODY" | grep -q "<!doctype html"; then
    echo -e "   ${GREEN}✓${NC} Root page returned 200 OK with HTML (${DURATION_MS}ms)"
    add_check_result "root_page" "PASS" "$HTTP_CODE" "" "$DURATION_MS" "HTML page served successfully"
elif [[ "$HTTP_CODE" == "ERROR" ]]; then
    echo -e "   ${RED}✗${NC} Failed to connect to app at $APP_URL"
    add_check_result "root_page" "FAIL" "" "" "$DURATION_MS" "Connection failed"
    echo -e "\n${RED}❌ PREFLIGHT FAILED: App is not reachable${NC}"
    echo "Artifacts saved to: $RESULTS_FILE"
    exit 1
else
    echo -e "   ${RED}✗${NC} Root page returned $HTTP_CODE (expected 200 with HTML)"
    add_check_result "root_page" "FAIL" "$HTTP_CODE" "" "$DURATION_MS" "Non-200 response or missing HTML"
    echo -e "\n${RED}❌ PREFLIGHT FAILED: Root page not serving correctly${NC}"
    echo "Artifacts saved to: $RESULTS_FILE"
    exit 1
fi

echo ""

# Check 2: Health endpoint (liveness)
echo -e "2️⃣  ${BLUE}Checking liveness endpoint (/api/healthz)...${NC}"
START_S=$(date +%s)
RESPONSE=$(curl -s -w "\n%{http_code}" -H "Accept: application/json" "$APP_URL/api/healthz" 2>&1 || echo -e "\nERROR")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
CORRELATION_ID=$(echo "$BODY" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('_meta', {}).get('correlationId', ''))" 2>/dev/null || echo "")
DURATION_MS=$(( ($(date +%s) - START_S) * 1000 ))

if [[ "$HTTP_CODE" == "200" ]]; then
    echo -e "   ${GREEN}✓${NC} Health endpoint returned 200 OK (${DURATION_MS}ms)"
    if [[ -n "$CORRELATION_ID" ]]; then
        echo -e "   ${GREEN}✓${NC} Correlation ID: $CORRELATION_ID"
    fi
    add_check_result "health_endpoint" "PASS" "$HTTP_CODE" "$CORRELATION_ID" "$DURATION_MS" "Liveness check passed"
else
    echo -e "   ${RED}✗${NC} Health endpoint returned $HTTP_CODE (expected 200)"
    add_check_result "health_endpoint" "FAIL" "$HTTP_CODE" "$CORRELATION_ID" "$DURATION_MS" "Non-200 response"
    echo -e "\n${RED}❌ PREFLIGHT FAILED: Health endpoint not responding${NC}"
    echo "Artifacts saved to: $RESULTS_FILE"
    exit 1
fi

echo ""

# Check 3: Readiness endpoint (includes DB check)
echo -e "3️⃣  ${BLUE}Checking readiness endpoint (/api/readyz)...${NC}"
START_S=$(date +%s)
RESPONSE=$(curl -s -w "\n%{http_code}" -H "Accept: application/json" "$APP_URL/api/readyz" 2>&1 || echo -e "\nERROR")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
CORRELATION_ID=$(echo "$BODY" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('_meta', {}).get('correlationId', ''))" 2>/dev/null || echo "")
DB_STATUS=$(echo "$BODY" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('checks', {}).get('database', {}).get('status', ''))" 2>/dev/null || echo "")
DB_CONNECTED=$(echo "$BODY" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('database', {}).get('connected', ''))" 2>/dev/null || echo "")
DURATION_MS=$(( ($(date +%s) - START_S) * 1000 ))

# Support both old format (data.checks.database.status) and new format (database.connected)
if [[ "$HTTP_CODE" == "200" ]] && ( [[ "$DB_STATUS" == "ok" ]] || [[ "$DB_CONNECTED" == "True" ]] ); then
    echo -e "   ${GREEN}✓${NC} Readiness endpoint returned 200 OK (${DURATION_MS}ms)"
    if [[ -n "$DB_STATUS" ]]; then
        echo -e "   ${GREEN}✓${NC} Database status: $DB_STATUS"
    else
        echo -e "   ${GREEN}✓${NC} Database connected: $DB_CONNECTED"
    fi
    if [[ -n "$CORRELATION_ID" ]]; then
        echo -e "   ${GREEN}✓${NC} Correlation ID: $CORRELATION_ID"
    fi
    add_check_result "readiness_endpoint" "PASS" "$HTTP_CODE" "$CORRELATION_ID" "$DURATION_MS" "Readiness check passed, DB healthy"
else
    echo -e "   ${RED}✗${NC} Readiness endpoint returned $HTTP_CODE, DB status: $DB_STATUS"
    add_check_result "readiness_endpoint" "FAIL" "$HTTP_CODE" "$CORRELATION_ID" "$DURATION_MS" "Non-200 response or unhealthy DB"
    echo -e "\n${RED}❌ PREFLIGHT FAILED: App or database not ready${NC}"
    echo "Artifacts saved to: $RESULTS_FILE"
    exit 1
fi

echo ""

# All checks passed
echo -e "${GREEN}✅ ALL PREFLIGHT CHECKS PASSED${NC}"
echo ""
echo "Summary:"
echo "  ✓ Root page serving HTML"
echo "  ✓ Health endpoint responding"
echo "  ✓ Readiness endpoint confirming DB healthy"
echo ""
echo "Artifacts saved to: $RESULTS_FILE"
echo ""
echo -e "${GREEN}🎯 Ready to run E2E test suite${NC}"

exit 0
