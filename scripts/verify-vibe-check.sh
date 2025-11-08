#!/bin/bash
# verify-vibe-check.sh - Verify Vibe Check MCP installation and configuration

set -e

echo "🔍 Verifying Vibe Check MCP Installation..."
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Check global npm installation
echo "1️⃣  Checking global npm installation..."
if npm list -g @pv-bhat/vibe-check-mcp &> /dev/null; then
    VERSION=$(npm list -g @pv-bhat/vibe-check-mcp 2>&1 | grep vibe-check-mcp | sed 's/.*@//' | sed 's/ .*//')
    echo -e "${GREEN}✓${NC} Vibe Check MCP is installed globally (version: $VERSION)"
else
    echo -e "${RED}✗${NC} Vibe Check MCP is NOT installed globally"
    echo -e "${YELLOW}→${NC} Run: npm install -g @pv-bhat/vibe-check-mcp"
    exit 1
fi

echo ""

# 2. Check Claude Code MCP settings
echo "2️⃣  Checking Claude Code MCP configuration..."
MCP_SETTINGS="$HOME/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json"

if [ -f "$MCP_SETTINGS" ]; then
    if grep -q "vibe-check" "$MCP_SETTINGS"; then
        echo -e "${GREEN}✓${NC} Vibe Check MCP is configured in Claude Code"
        echo -e "${YELLOW}→${NC} Configuration location: $MCP_SETTINGS"
    else
        echo -e "${RED}✗${NC} Vibe Check MCP is NOT configured in Claude Code"
        echo -e "${YELLOW}→${NC} Add configuration to: $MCP_SETTINGS"
        exit 1
    fi
else
    echo -e "${RED}✗${NC} Claude Code MCP settings file not found"
    echo -e "${YELLOW}→${NC} Expected location: $MCP_SETTINGS"
    exit 1
fi

echo ""

# 3. Check if vibe-check can be executed
echo "3️⃣  Testing Vibe Check MCP execution..."
if npx -y @pv-bhat/vibe-check-mcp --help &> /dev/null; then
    echo -e "${GREEN}✓${NC} Vibe Check MCP can be executed via npx"
else
    echo -e "${YELLOW}⚠${NC}  Could not execute vibe-check via npx (this may be normal)"
fi

echo ""

# 4. Check CLAUDE.md mentions vibe-check
echo "4️⃣  Checking CLAUDE.md documentation..."
if grep -q "Vibe Check MCP" CLAUDE.md; then
    echo -e "${GREEN}✓${NC} Vibe Check MCP is documented in CLAUDE.md"
else
    echo -e "${YELLOW}⚠${NC}  Vibe Check MCP not mentioned in CLAUDE.md"
fi

echo ""
echo -e "${GREEN}✅ Vibe Check MCP verification complete!${NC}"
echo ""
echo "📝 Next steps:"
echo "   1. Restart Claude Code (VS Code extension) to load the MCP server"
echo "   2. Use /mcp command in Claude Code to verify connection"
echo "   3. Test with: vibe_check --userRequest \"test\" --plan \"test plan\""
echo ""
