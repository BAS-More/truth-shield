#!/usr/bin/env node
// Truth Shield Enforcer — Claude Code Stop Hook
//
// Fires on every Stop event. If shield-on mode is active and Claude's
// response contains factual claims, checks whether verification tools
// were used during this turn by reading the transcript.
//
// Exit 0 = allow (response passes through)
// Exit 2 = block (stderr message tells Claude to verify first)
//
// Install: Add to ~/.claude/settings.json (see ENHANCE.md)

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(
  process.env.HOME || process.env.USERPROFILE || '',
  '.claude',
  'truth-shield-state.json'
);

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { shieldOn: false };
  }
}

function writeState(state) {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
  } catch {
    // State persistence is best-effort
  }
}

function main() {
  // Read hook input from stdin (Claude Code passes JSON via stdin)
  let raw = '';
  try {
    raw = fs.readFileSync(0, 'utf8'); // fd 0 = stdin
  } catch {
    process.exit(0); // No input = allow
  }

  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0); // Malformed input = allow
  }

  const state = readState();

  // If this is a re-entry (hook already triggered continuation), allow stop
  // to prevent infinite loops
  if (input.stop_hook_active) {
    process.exit(0);
  }

  // Detect shield on/off by reading the transcript for recent user messages
  if (input.transcript_path) {
    try {
      const transcript = fs.readFileSync(input.transcript_path, 'utf8');
      const lines = transcript.trim().split('\n');
      // Check last 20 lines for shield on/off commands
      const recent = lines.slice(-20);
      for (const line of recent) {
        try {
          const entry = JSON.parse(line);
          if (entry.type === 'human' || entry.role === 'user') {
            const text = (typeof entry.content === 'string' ? entry.content : '').toLowerCase().trim();
            if (text === 'shield on') {
              state.shieldOn = true;
              writeState(state);
            } else if (text === 'shield off') {
              state.shieldOn = false;
              writeState(state);
            }
          }
        } catch {
          // Skip malformed transcript lines
        }
      }
    } catch {
      // Transcript unreadable — use cached state
    }
  }

  // If shield is off, allow everything
  if (!state.shieldOn) {
    process.exit(0);
  }

  // Shield is on — check if verification tools were used in this turn.
  // Look for truth-shield-related tool calls in the transcript.
  let didVerify = false;
  if (input.transcript_path) {
    try {
      const transcript = fs.readFileSync(input.transcript_path, 'utf8');
      const lines = transcript.trim().split('\n');

      // Find the last user message, then check tool uses after it
      let lastUserIdx = -1;
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const entry = JSON.parse(lines[i]);
          if (entry.type === 'human' || entry.role === 'user') {
            lastUserIdx = i;
            break;
          }
        } catch { /* skip */ }
      }

      if (lastUserIdx >= 0) {
        const verificationPatterns = [
          'fact_query', 'fact_set',
          'verify_claim', 'recall_semantic', 'recall_by_category',
          'knowledge-graph', 'context7', 'graphiti',
          'WebSearch', 'truth-shield', 'Truth Shield'
        ];

        for (let i = lastUserIdx + 1; i < lines.length; i++) {
          const lineText = lines[i];
          if (verificationPatterns.some(p => lineText.includes(p))) {
            didVerify = true;
            break;
          }
        }
      }
    } catch {
      // Can't read transcript — give benefit of the doubt
      didVerify = true;
    }
  }

  if (!didVerify) {
    // Block: tell Claude to run verification
    process.stderr.write(
      'Truth Shield enforcement: shield-on mode is active but no verification ' +
      'was detected in this turn. Please verify factual claims using the ' +
      'truth-shield skill before responding.'
    );
    process.exit(2); // Exit 2 = block
  }

  process.exit(0); // Verification detected — allow
}

main();
