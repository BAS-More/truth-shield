#!/bin/bash
# Truth Shield v3 installer for Mac/Linux
# Usage: curl -sfL https://raw.githubusercontent.com/BAS-More/truth-shield/master/install.sh | bash

set -e

SKILL_DIR="$HOME/.claude/skills"
SKILL_FILE="$SKILL_DIR/truth-shield.md"
HOOK_DIR="$HOME/.claude/hooks"
HOOK_FILE="$HOOK_DIR/truth-shield-enforcer.js"
REPO_URL="https://raw.githubusercontent.com/BAS-More/truth-shield/master"

echo ""
echo "  Truth Shield v3 Installer"
echo "  ========================="
echo ""

# Create skills directory if it doesn't exist
if [ ! -d "$SKILL_DIR" ]; then
    echo "  Creating $SKILL_DIR ..."
    mkdir -p "$SKILL_DIR"
fi

# Download or copy SKILL.md
if [ -f "SKILL.md" ]; then
    echo "  Installing skill from local SKILL.md ..."
    cp SKILL.md "$SKILL_FILE"
else
    echo "  Downloading skill from GitHub ..."
    if command -v curl &> /dev/null; then
        curl -sfL "$REPO_URL/SKILL.md" -o "$SKILL_FILE"
    elif command -v wget &> /dev/null; then
        wget -q "$REPO_URL/SKILL.md" -O "$SKILL_FILE"
    else
        echo "  Error: curl or wget required"
        exit 1
    fi
fi

echo "  Skill installed to: $SKILL_FILE"

# Optional: install enforcement hook
echo ""
echo "  Install enforcement hook? (recommended for shield-on mode)"
echo "  The hook ensures verification runs even if Claude forgets."
echo ""

INSTALL_HOOK="${TRUTH_SHIELD_HOOK:-ask}"

if [ "$INSTALL_HOOK" = "ask" ] && [ -t 0 ]; then
    read -p "  Install hook? [Y/n] " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        INSTALL_HOOK="yes"
    else
        INSTALL_HOOK="no"
    fi
elif [ "$INSTALL_HOOK" = "ask" ]; then
    # Non-interactive (piped) — skip hook by default
    INSTALL_HOOK="no"
    echo "  Skipping hook (non-interactive). Set TRUTH_SHIELD_HOOK=yes to install."
fi

if [ "$INSTALL_HOOK" = "yes" ]; then
    mkdir -p "$HOOK_DIR"
    if [ -f "hooks/truth-shield-enforcer.js" ]; then
        cp hooks/truth-shield-enforcer.js "$HOOK_FILE"
    else
        if command -v curl &> /dev/null; then
            curl -sfL "$REPO_URL/hooks/truth-shield-enforcer.js" -o "$HOOK_FILE"
        elif command -v wget &> /dev/null; then
            wget -q "$REPO_URL/hooks/truth-shield-enforcer.js" -O "$HOOK_FILE"
        fi
    fi
    echo "  Hook installed to: $HOOK_FILE"
    echo "  NOTE: Add the hook to ~/.claude/hooks.json — see ENHANCE.md for config."
fi

echo ""
echo "  Done! Open Claude Code and type:"
echo ""
echo "    verify this"
echo ""
echo "  after any response to fact-check it."
echo ""
echo "  Or type 'shield on' for continuous verification."
echo ""
