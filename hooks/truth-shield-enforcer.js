#!/usr/bin/env node
// Truth Shield Enforcer — Claude Code Stop Hook (v3.1)
//
// Fires on every Stop event. If shield-on mode is active and Claude's
// response contains factual claims, checks whether verification tools
// were used during this turn.
//
// Anti-loop: tracks enforcement per session. After one block per session,
// allows through to prevent infinite loops.
//
// Install: Add to ~/.claude/settings.json under hooks.Stop
//          See ENHANCE.md for full configuration.

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── Paths ────────────────────────────────────────────────────────────
const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const STATE_FILE = path.join(CLAUDE_DIR, 'truth-shield-state.json');
const LOCK_FILE = path.join(os.tmpdir(), '.truth-shield-lock.json');

// ─── State management ─────────────────────────────────────────────────

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { shieldOn: false };
  }
}

function writeState(state) {
  try {
    if (!fs.existsSync(CLAUDE_DIR)) fs.mkdirSync(CLAUDE_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch {
    // best-effort
  }
}

// Anti-loop: track which sessions we've already blocked once.
// After one block, subsequent stops in the same session pass through.
function hasBlockedThisSession(sessionId) {
  try {
    const lock = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
    // Stale lock (>10 min) = ignore
    if (Date.now() - (lock.timestamp || 0) > 600000) return false;
    return lock.sessionId === sessionId;
  } catch {
    return false;
  }
}

function markBlocked(sessionId) {
  try {
    fs.writeFileSync(LOCK_FILE, JSON.stringify({
      sessionId,
      timestamp: Date.now()
    }));
  } catch {
    // best-effort
  }
}

function clearLock() {
  try { fs.unlinkSync(LOCK_FILE); } catch { /* ok */ }
}

// ─── Stdin reader (async, with timeout — matches other hooks) ─────────

function readStdin() {
  return new Promise((resolve) => {
    let buf = '';
    process.stdin.on('data', (chunk) => { buf += chunk; });
    process.stdin.on('end', () => resolve(buf));
    // Safety timeout: if stdin never closes, don't hang forever
    setTimeout(() => resolve(buf), 2000);
  });
}

// ─── Shield state detection ───────────────────────────────────────────

function detectShieldState(messages, currentState) {
  // Scan messages array (from stdin input) for shield on/off commands.
  // Messages are in chronological order. Last command wins.
  if (!Array.isArray(messages)) return currentState;

  let state = currentState;
  for (const msg of messages) {
    if (msg.role !== 'user') continue;
    const content = typeof msg.content === 'string'
      ? msg.content
      : Array.isArray(msg.content)
        ? msg.content.filter(b => b.type === 'text').map(b => b.text).join(' ')
        : '';
    const text = content.toLowerCase().trim();
    if (text === 'shield on') state = true;
    else if (text === 'shield off') state = false;
  }
  return state;
}

function detectShieldStateFromTranscript(transcriptPath, currentState) {
  // Fallback: read transcript JSONL if messages array isn't available.
  try {
    const data = fs.readFileSync(transcriptPath, 'utf8');
    const lines = data.trim().split('\n');
    let state = currentState;
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type !== 'user') continue;
        const content = entry.message?.content;
        const text = (typeof content === 'string' ? content : '').toLowerCase().trim();
        if (text === 'shield on') state = true;
        else if (text === 'shield off') state = false;
      } catch { /* skip malformed lines */ }
    }
    return state;
  } catch {
    return currentState;
  }
}

// ─── Verification detection ───────────────────────────────────────────

const VERIFICATION_PATTERNS = [
  // MCP tools used by truth-shield
  'fact_query', 'fact_set', 'fact_invalidate',
  'verify_claim', 'recall_semantic', 'recall_by_category',
  'knowledge-graph', 'context7', 'graphiti',
  // Built-in verification tools
  'WebSearch',
  // Truth Shield markers in output
  'Truth Shield Report', 'truth-shield',
  '[shield:', '[VERIFIED', '[CONTRADICTED', '[UNVERIFIED', '[CONFLICTED',
  'Claims checked:',
];

function didVerifyInMessages(messages) {
  // Check assistant messages after last user message for verification patterns.
  if (!Array.isArray(messages)) return false;

  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      lastUserIdx = i;
      break;
    }
  }
  if (lastUserIdx < 0) return false;

  for (let i = lastUserIdx + 1; i < messages.length; i++) {
    const msg = messages[i];
    const text = JSON.stringify(msg);
    if (VERIFICATION_PATTERNS.some(p => text.includes(p))) return true;
  }
  return false;
}

function didVerifyInTranscript(transcriptPath) {
  // Fallback: scan transcript JSONL for verification after last user message.
  try {
    const data = fs.readFileSync(transcriptPath, 'utf8');
    const lines = data.trim().split('\n');

    let lastUserIdx = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        if (entry.type === 'user') { lastUserIdx = i; break; }
      } catch { /* skip */ }
    }
    if (lastUserIdx < 0) return false;

    for (let i = lastUserIdx + 1; i < lines.length; i++) {
      if (VERIFICATION_PATTERNS.some(p => lines[i].includes(p))) return true;
    }
    return false;
  } catch {
    return true; // Can't read = benefit of the doubt
  }
}

// ─── Response classification ──────────────────────────────────────────

function responseHasFactualClaims(output) {
  // Quick heuristic: skip responses that clearly don't need verification.
  if (!output || typeof output !== 'string') return false;

  const text = output.trim();

  // Too short to contain factual claims
  if (text.length < 60) return false;

  // Already verified (shield ran inline)
  if (text.includes('[shield:') || text.includes('Truth Shield Report')) return false;

  // Pure questions back to user (no assertions)
  const sentences = text.split(/[.!]\s/);
  const questionRatio = sentences.filter(s => s.trim().endsWith('?')).length / Math.max(sentences.length, 1);
  if (questionRatio > 0.7) return false;

  // Pure code output (mostly backticks/indented)
  const codeBlockCount = (text.match(/```/g) || []).length;
  const nonCodeLength = text.replace(/```[\s\S]*?```/g, '').trim().length;
  if (codeBlockCount >= 2 && nonCodeLength < 100) return false;

  return true;
}

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  try {
    const raw = await readStdin();
    if (!raw.trim()) { process.exit(0); return; }

    let input;
    try { input = JSON.parse(raw); } catch { process.exit(0); return; }

    // Only run on Stop events
    const event = input.hook_event_name || '';
    if (event !== 'Stop') { process.exit(0); return; }

    // Don't enforce inside subagents — they're tool executions, not user-facing
    if (input.agent_id) { process.exit(0); return; }

    const sessionId = input.session_id || 'unknown';
    const output = input.output || '';
    const messages = input.messages;
    const transcriptPath = input.transcript_path;

    // ── Step 1: Detect shield on/off state ────────────────────────────
    const savedState = readState();
    let shieldOn;
    if (Array.isArray(messages) && messages.length > 0) {
      shieldOn = detectShieldState(messages, savedState.shieldOn);
    } else if (transcriptPath) {
      shieldOn = detectShieldStateFromTranscript(transcriptPath, savedState.shieldOn);
    } else {
      shieldOn = savedState.shieldOn;
    }

    // Persist if changed
    if (shieldOn !== savedState.shieldOn) {
      writeState({ ...savedState, shieldOn });
      if (!shieldOn) clearLock(); // Shield turned off — clear any enforcement lock
    }

    // Shield off → allow everything
    if (!shieldOn) { process.exit(0); return; }

    // ── Step 2: Anti-loop check ───────────────────────────────────────
    // If we already blocked this session once, allow through.
    // This prevents Claude from getting stuck in verify→block→verify loops.
    if (hasBlockedThisSession(sessionId)) {
      process.exit(0);
      return;
    }

    // ── Step 3: Check if response needs verification ──────────────────
    if (!responseHasFactualClaims(output)) {
      process.exit(0); // Nothing to verify
      return;
    }

    // ── Step 4: Check if verification occurred ────────────────────────
    let verified = false;
    if (Array.isArray(messages) && messages.length > 0) {
      verified = didVerifyInMessages(messages);
    }
    if (!verified && transcriptPath) {
      verified = didVerifyInTranscript(transcriptPath);
    }

    if (verified) {
      process.exit(0); // Verification detected — allow
      return;
    }

    // ── Step 5: Block — tell Claude to verify ─────────────────────────
    markBlocked(sessionId);

    // Use proper JSON decision output (preferred over exit code 2)
    const decision = {
      decision: 'block',
      reason: [
        'Truth Shield enforcement: shield-on mode is active but no verification',
        'was detected in this response. The response contains factual claims that',
        'need checking. Please run the truth-shield skill to verify claims before',
        'presenting them. Use the verification tiers available (Grep/Read for code,',
        'WebSearch for facts, Context7 for library docs, etc.).'
      ].join(' ')
    };

    process.stdout.write(JSON.stringify(decision));
    process.exit(0);

  } catch (err) {
    // Hook must NEVER crash Claude. Log and allow.
    try {
      const logDir = path.join(CLAUDE_DIR, '_logs');
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      fs.appendFileSync(
        path.join(logDir, 'truth-shield-errors.log'),
        `[${new Date().toISOString()}] ${err.stack || err.message || err}\n`
      );
    } catch { /* truly last resort */ }
    process.exit(0);
  }
}

main();
