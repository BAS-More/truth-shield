#!/bin/bash
# Truth Shield installer for Mac/Linux
# Usage: curl -sL https://raw.githubusercontent.com/BAS-More/truth-shield/master/install.sh | bash

set -e

SKILL_DIR="$HOME/.claude/skills"
SKILL_FILE="$SKILL_DIR/truth-shield.md"
REPO_URL="https://raw.githubusercontent.com/BAS-More/truth-shield/master/SKILL.md"

echo ""
echo "  Truth Shield Installer"
echo "  ======================"
echo ""

# Create skills directory if it doesn't exist
if [ ! -d "$SKILL_DIR" ]; then
    echo "  Creating $SKILL_DIR ..."
    mkdir -p "$SKILL_DIR"
fi

# Download or copy SKILL.md
if [ -f "SKILL.md" ]; then
    echo "  Installing from local SKILL.md ..."
    cp SKILL.md "$SKILL_FILE"
else
    echo "  Downloading from GitHub ..."
    if command -v curl &> /dev/null; then
        curl -sL "$REPO_URL" -o "$SKILL_FILE"
    elif command -v wget &> /dev/null; then
        wget -q "$REPO_URL" -O "$SKILL_FILE"
    else
        echo "  Error: curl or wget required"
        exit 1
    fi
fi

echo "  Installed to: $SKILL_FILE"
echo ""
echo "  Done! Open Claude Code and type:"
echo ""
echo "    verify this"
echo ""
echo "  after any response to fact-check it."
echo ""
echo "  Or type 'shield on' for continuous verification."
echo ""
