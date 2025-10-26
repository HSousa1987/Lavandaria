#!/bin/bash

#######################################################################
# Route Availability Checklist for Lavandaria E2E Testing
#
# Tests all critical API routes with pre-auth and post-auth scenarios.
# Captures correlation IDs, response times, and status codes.
# Outputs results to preflight-results/route-checklist-{timestamp}.json
#
# Usage: ./scripts/route-availability-check.sh
#######################################################################

set -euo pipefail

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RESULTS_DIR="preflight-results"
RESULTS_FILE="${RESULTS_DIR}/route-checklist-${TIMESTAMP}.json"
TEMP_COOKIE_FILE=$(mktemp)

# Test credentials (from seed script)
WORKER_USERNAME="worker1"
WORKER_PASSWORD="worker123"
CLIENT_PHONE="911111111"
CLIENT_PASSWORD="lavandaria2025"

# Ensure results directory exists
mkdir -p "$RESULTS_DIR"

# Initialize results array
echo '{"timestamp": "'"$(date -u +"%Y-%m-%dT%H:%M:%SZ")"'", "baseUrl": "'"$BASE_URL"'", "routes": []}' > "$RESULTS_FILE"

# Function to add route result to JSON
add_result() {
    local route=$1
    local method=$2
    local auth_state=$3
    local status=$4
    local correlation_id=$5
    local response_time=$6
    local expected=$7
    local pass=$8

    # Read current JSON, add new result, write back
    local temp_file=$(mktemp)
    jq --arg route "$route" \
       --arg method "$method" \
       --arg auth "$auth_state" \
       --argjson status "$status" \
       --arg cid "$correlation_id" \
       --arg time "$response_time" \
       --arg exp "$expected" \
       --argjson pass "$pass" \
       '.routes += [{"route": $route, "method": $method, "authState": $auth, "statusCode": $status, "correlationId": $cid, "responseTimeMs": $time, "expectedStatus": $exp, "pass": $pass}]' \
       "$RESULTS_FILE" > "$temp_file"
    mv "$temp_file" "$RESULTS_FILE"
}

# Function to test route
test_route() {
    local route=$1
    local method=$2
    local auth_state=$3
    local expected_status=$4
    local cookie_flag=$5

    echo -e "${BLUE}Testing $method $route (${auth_state})...${NC}"

    local start_time=$(date +%s%3N)
    local response
    local status
    local correlation_id

    if [ "$cookie_flag" = "with_cookies" ]; then
        response=$(curl -s -X "$method" \
            -b "$TEMP_COOKIE_FILE" \
            -w "\n%{http_code}" \
            -H "Content-Type: application/json" \
            "${BASE_URL}${route}" 2>/dev/null || echo "0")
    else
        response=$(curl -s -X "$method" \
            -w "\n%{http_code}" \
            -H "Content-Type: application/json" \
            "${BASE_URL}${route}" 2>/dev/null || echo "0")
    fi

    local end_time=$(date +%s%3N)
    local response_time=$((end_time - start_time))

    # Extract status code (last line)
    status=$(echo "$response" | tail -n1)

    # Extract correlation ID from response body (if JSON)
    correlation_id=$(echo "$response" | head -n-1 | jq -r '._meta.correlationId // "N/A"' 2>/dev/null || echo "N/A")

    # Check if status matches expected
    local pass=false
    if [ "$status" = "$expected_status" ]; then
        pass=true
        echo -e "${GREEN}✓ PASS${NC} - Status: $status, Correlation ID: $correlation_id, Time: ${response_time}ms"
    else
        echo -e "${RED}✗ FAIL${NC} - Expected: $expected_status, Got: $status, Correlation ID: $correlation_id"
    fi

    # Add to results
    add_result "$route" "$method" "$auth_state" "$status" "$correlation_id" "$response_time" "$expected_status" "$pass"
}

# Function to login and store cookies
login_worker() {
    echo -e "\n${YELLOW}🔐 Logging in as Worker...${NC}"

    local response=$(curl -s -X POST \
        -c "$TEMP_COOKIE_FILE" \
        -H "Content-Type: application/json" \
        -d "{\"username\": \"$WORKER_USERNAME\", \"password\": \"$WORKER_PASSWORD\", \"userType\": \"staff\"}" \
        -w "\n%{http_code}" \
        "${BASE_URL}/api/auth/login" 2>/dev/null)

    local status=$(echo "$response" | tail -n1)

    if [ "$status" = "200" ]; then
        echo -e "${GREEN}✓ Worker login successful${NC}"
        return 0
    else
        echo -e "${RED}✗ Worker login failed (Status: $status)${NC}"
        return 1
    fi
}

login_client() {
    echo -e "\n${YELLOW}🔐 Logging in as Client...${NC}"

    local response=$(curl -s -X POST \
        -c "$TEMP_COOKIE_FILE" \
        -H "Content-Type: application/json" \
        -d "{\"phone\": \"$CLIENT_PHONE\", \"password\": \"$CLIENT_PASSWORD\", \"userType\": \"client\"}" \
        -w "\n%{http_code}" \
        "${BASE_URL}/api/auth/login" 2>/dev/null)

    local status=$(echo "$response" | tail -n1)

    if [ "$status" = "200" ]; then
        echo -e "${GREEN}✓ Client login successful${NC}"
        return 0
    else
        echo -e "${RED}✗ Client login failed (Status: $status)${NC}"
        return 1
    fi
}

# Function to logout
logout() {
    echo -e "\n${YELLOW}🚪 Logging out...${NC}"
    curl -s -X POST -b "$TEMP_COOKIE_FILE" "${BASE_URL}/api/auth/logout" > /dev/null
    rm -f "$TEMP_COOKIE_FILE"
    TEMP_COOKIE_FILE=$(mktemp)
}

#######################################################################
# Main Test Execution
#######################################################################

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Route Availability Checklist - Lavandaria E2E Testing  ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Base URL: $BASE_URL"
echo "Results will be saved to: $RESULTS_FILE"
echo ""

#######################################################################
# 1. Health & Readiness Endpoints (No Auth Required)
#######################################################################

echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  Section 1: Health & Readiness (Public)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

test_route "/api/healthz" "GET" "no_auth" "200" "no_cookies"
test_route "/api/readyz" "GET" "no_auth" "200" "no_cookies"

#######################################################################
# 2. Authentication Endpoints
#######################################################################

echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  Section 2: Authentication${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Session check without auth (should return 401)
test_route "/api/auth/session" "GET" "no_auth" "401" "no_cookies"

# Login as worker and test session
login_worker
test_route "/api/auth/session" "GET" "worker_auth" "200" "with_cookies"

# Logout
logout

#######################################################################
# 3. Protected Routes - Worker Authentication
#######################################################################

echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  Section 3: Worker Protected Routes${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

login_worker

# Cleaning jobs (worker should see assigned jobs)
test_route "/api/cleaning-jobs" "GET" "worker_auth" "200" "with_cookies"
test_route "/api/cleaning-jobs/100" "GET" "worker_auth" "200" "with_cookies"
test_route "/api/cleaning-jobs/100/photos" "GET" "worker_auth" "200" "with_cookies"

# Dashboard
test_route "/api/dashboard/worker" "GET" "worker_auth" "200" "with_cookies"

logout

#######################################################################
# 4. Protected Routes - Client Authentication
#######################################################################

echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  Section 4: Client Protected Routes${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

login_client

# Cleaning jobs (client should see own jobs)
test_route "/api/cleaning-jobs" "GET" "client_auth" "200" "with_cookies"
test_route "/api/cleaning-jobs/100/photos" "GET" "client_auth" "200" "with_cookies"

# Laundry orders
test_route "/api/laundry-orders" "GET" "client_auth" "200" "with_cookies"

# Dashboard
test_route "/api/dashboard/client" "GET" "client_auth" "200" "with_cookies"

logout

#######################################################################
# 5. Unauthenticated Access (Should Fail)
#######################################################################

echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  Section 5: Unauthenticated Access (Expect 401)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

test_route "/api/cleaning-jobs" "GET" "no_auth" "401" "no_cookies"
test_route "/api/laundry-orders" "GET" "no_auth" "401" "no_cookies"
test_route "/api/dashboard/worker" "GET" "no_auth" "401" "no_cookies"

#######################################################################
# Summary
#######################################################################

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Route Availability Checklist Complete${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Count passes and failures
TOTAL=$(jq '.routes | length' "$RESULTS_FILE")
PASSED=$(jq '[.routes[] | select(.pass == true)] | length' "$RESULTS_FILE")
FAILED=$((TOTAL - PASSED))

echo ""
echo "Results saved to: $RESULTS_FILE"
echo ""
echo -e "${GREEN}Passed: $PASSED / $TOTAL${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Failed: $FAILED / $TOTAL${NC}"
    echo ""
    echo "Failed routes:"
    jq -r '.routes[] | select(.pass == false) | "  - \(.method) \(.route) (Expected: \(.expectedStatus), Got: \(.statusCode))"' "$RESULTS_FILE"
fi

# Cleanup
rm -f "$TEMP_COOKIE_FILE"

# Exit with appropriate code
if [ $FAILED -gt 0 ]; then
    exit 1
else
    exit 0
fi
