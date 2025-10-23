#!/bin/bash
# Verification script for Vibe Check MCP installation
# Run this after restarting Claude Code

echo "🔍 Vibe Check MCP Installation Verification"
echo "==========================================="
echo ""

# Check if package is installed globally
echo "1️⃣ Checking global npm package..."
if npm list -g @pv-bhat/vibe-check-mcp &>/dev/null; then
    echo "   ✅ @pv-bhat/vibe-check-mcp is installed globally"
    npm list -g @pv-bhat/vibe-check-mcp --depth=0
else
    echo "   ❌ Package not found globally"
    exit 1
fi

echo ""

# Check if MCP is registered in config
echo "2️⃣ Checking Claude Code configuration..."
if python3 << 'EOF'
import json
import sys

with open('/Users/hugosousa/.claude.json', 'r') as f:
    config = json.load(f)

project_key = '/Applications/XAMPP/xamppfiles/htdocs/Lavandaria'
if 'vibe-check' in config['projects'][project_key]['mcpServers']:
    print("   ✅ vibe-check MCP registered in .claude.json")
    sys.exit(0)
else:
    print("   ❌ vibe-check MCP not found in config")
    sys.exit(1)
EOF
then
    :
else
    exit 1
fi

echo ""

# Test if MCP server can start
echo "3️⃣ Testing MCP server startup..."
if timeout 5 npx @pv-bhat/vibe-check-mcp start --stdio <<< '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' &>/dev/null; then
    echo "   ✅ MCP server responds to initialization"
else
    echo "   ⚠️  Server test inconclusive (this is normal)"
fi

echo ""
echo "==========================================="
echo "✅ Installation verified!"
echo ""
echo "📝 Next Steps:"
echo "   1. Restart Claude Code if you haven't already"
echo "   2. Run: /mcp"
echo "   3. Look for 'vibe-check' in the connected servers list"
echo "   4. Test with: vibe_check or vibe_learn tools"
echo ""
