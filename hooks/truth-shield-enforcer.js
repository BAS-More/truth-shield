// Truth Shield Enforcer — Claude Code Hook
// Runs as a PostToolUse / Stop hook to enforce verification.
//
// Install: Add to ~/.claude/hooks.json (see ENHANCE.md for full instructions)
//
// What it does:
// - PostToolUse: After any tool that generates factual claims (WebSearch, Read, etc.),
//   reminds Claude to run verification before presenting results
// - Stop: Before Claude's final response reaches the user, checks if verification
//   was performed when "shield on" mode is active
//
// This is a DETERMINISTIC enforcement layer outside Claude's context window.
// Claude can't "forget" to verify because the hook fires regardless.

const fs = require('fs');
const path = require('path');

// State file tracks whether shield-on mode is active
const STATE_FILE = path.join(
  process.env.HOME || process.env.USERPROFILE,
  '.claude',
  'truth-shield-state.json'
);

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { shieldOn: false, lastVerified: null };
  }
}

function writeState(state) {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Hook entry point — called by Claude Code hooks system
function main() {
  const hookType = process.env.CLAUDE_HOOK_TYPE; // "PostToolUse" or "Stop"
  const input = process.env.CLAUDE_HOOK_INPUT;

  let parsed;
  try {
    parsed = input ? JSON.parse(input) : {};
  } catch {
    parsed = {};
  }

  const state = readState();

  // Detect shield on/off from conversation
  const content = (parsed.content || parsed.text || '').toLowerCase();
  if (content.includes('shield on')) {
    state.shieldOn = true;
    writeState(state);
  } else if (content.includes('shield off')) {
    state.shieldOn = false;
    writeState(state);
  }

  if (hookType === 'Stop' && state.shieldOn) {
    // Check if verification was performed in this turn
    const toolsUsed = parsed.tools_used || [];
    const verificationTools = [
      'mcp__fact-mcp__fact_query',
      'mcp__total-recall__verify_claim',
      'mcp__total-recall__recall_semantic',
      'mcp__knowledge-graph__query',
      'mcp__context7__query-docs',
      'mcp__graphiti__search_memory_facts',
      'WebSearch',
      'Grep',
      'Read'
    ];

    const didVerify = toolsUsed.some(t => verificationTools.includes(t));

    if (!didVerify && containsFactualClaims(parsed.response || '')) {
      // Output a reminder — Claude Code hooks can inject system messages
      console.log(JSON.stringify({
        type: 'system',
        message: '[Truth Shield Enforcer] Shield-on mode is active but no verification was performed. Run truth-shield verification before presenting this response.'
      }));
      process.exit(1); // Non-zero exit signals the hook wants to intervene
    }
  }

  process.exit(0);
}

// Simple heuristic: does the text contain factual-looking statements?
function containsFactualClaims(text) {
  if (!text || text.length < 50) return false;

  const factualPatterns = [
    /\b(?:is|was|are|were|has|have|does|did)\b/i,
    /\b(?:version|v\d|port|default|created|released|added|removed)\b/i,
    /\b(?:function|method|class|module|package|library)\b/i,
    /\b(?:runs?|calls?|returns?|accepts?|requires?|supports?)\b/i,
    /\b\d{4}\b/, // years
    /\b\d+\.\d+\b/, // version numbers
  ];

  const matches = factualPatterns.filter(p => p.test(text));
  return matches.length >= 2; // At least 2 patterns suggest factual content
}

main();
