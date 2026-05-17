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

  // Single-pass transcript scan: detect shield state AND verification in one read
  let didVerify = false;
  if (input.transcript_path) {
    try {
      const transcript = fs.readFileSync(input.transcript_path, 'utf8');
      const lines = transcript.trim().split('\n');

      // Find the last user message index and scan for shield on/off commands
      let lastUserIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        try {
          const entry = JSON.parse(lines[i]);
          // Claude Code transcript format: type === 'user' for user messages,
          // content at entry.message.content
          if (entry.type === 'user') {
            lastUserIdx = i;
            const content = entry.message?.content;
            const text = (typeof content === 'string' ? content : '').toLowerCase().trim();
            if (text === 'shield on') {
              state.shieldOn = true;
            } else if (text === 'shield off') {
              state.shieldOn = false;
            }
          }
        } catch {
          // Skip malformed transcript lines
        }
      }

      writeState(state);

      // Check for verification tool usage after the last user message
      if (state.shieldOn && lastUserIdx >= 0) {
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

  // If shield is off, allow everything
  if (!state.shieldOn) {
    process.exit(0);
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
