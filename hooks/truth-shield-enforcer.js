#!/usr/bin/env node
// Truth Shield Enforcer — Claude Code Stop Hook (v4.0 — always-on)
//
// Fires on every Stop event. Checks whether Claude's response contains
// factual claims and whether verification tools were used during this turn.
//
// v4 changes:
//   - Always-on: no shield on/off toggle for enforcement. Every response
//     with factual claims is checked. (The skill's "shield on/off" still
//     controls inline markers — this hook is the safety net.)
//   - Hook-level MiniCheck: calls Ollama's bespoke-minicheck to verify
//     claims OUTSIDE Claude's context window (breaks confirmation bias).
//   - Hook-level multi-model: calls 9Router for cross-check with a
//     different model family.
//   - Graceful degradation: if external services are down, falls back to
//     blocking unverified responses (same as v3).
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
const http = require('http');

// ─── Paths ────────────────────────────────────────────────────────────
const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const LOCK_FILE = path.join(os.tmpdir(), '.truth-shield-lock.json');
const LOG_FILE = path.join(CLAUDE_DIR, '_logs', 'truth-shield-enforcer.log');

// ─── Configuration ───────────────────────────────────────────────────
const MINICHECK_URL = 'http://localhost:11434/api/generate';
const MINICHECK_MODEL = 'bespoke-minicheck';
const NROUTER_URL = 'http://localhost:20128/v1/chat/completions';
const NROUTER_TOKEN = '9router';
const HTTP_TIMEOUT_MS = 4000;  // per-call timeout for external services
const MAX_CLAIMS_TO_CHECK = 3; // limit external calls to top N claims

// ─── Logging ─────────────────────────────────────────────────────────

function log(msg) {
  try {
    const logDir = path.dirname(LOG_FILE);
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`);
  } catch { /* best-effort */ }
}

// ─── Anti-loop: track which sessions we've already blocked once ──────
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

  // Task confirmations: "Done.", "Created X.", "Updated Y.", file operation confirmations
  const actionPhrases = /^(Done|Created|Updated|Deleted|Installed|Removed|Fixed|Added|Committed|Pushed|Saved|Copied|Moved|Renamed)\b/i;
  const firstLine = text.split('\n')[0].trim();
  if (firstLine.length < 120 && actionPhrases.test(firstLine) && text.length < 300) return false;

  return true;
}

// ─── Claim extraction (simple heuristic) ──────────────────────────────

function extractClaims(output) {
  // Pull out sentences that look like factual assertions.
  // Skip questions, code blocks, and hedged language.
  if (!output) return [];

  // Strip code blocks
  const textOnly = output.replace(/```[\s\S]*?```/g, '').replace(/`[^`]+`/g, 'CODE');

  // Split into sentences
  const sentences = textOnly
    .split(/(?<=[.!])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 300);

  const claims = [];
  for (const s of sentences) {
    // Skip questions
    if (s.endsWith('?')) continue;
    // Skip hedged statements
    if (/\b(maybe|perhaps|might|could|I think|I believe|not sure|possibly)\b/i.test(s)) continue;
    // Skip meta-statements
    if (/\b(I'll|I will|Let me|Here's|Here is|I've|I have done|I created|I updated)\b/i.test(s)) continue;
    // Keep declarative factual statements
    claims.push(s);
  }

  // Return top N most checkable claims (longest = most specific)
  return claims
    .sort((a, b) => b.length - a.length)
    .slice(0, MAX_CLAIMS_TO_CHECK);
}

// ─── HTTP helper ──────────────────────────────────────────────────────

function httpPost(url, body, headers = {}, timeoutMs = HTTP_TIMEOUT_MS) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const options = {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        timeout: timeoutMs
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({ ok: true, data: JSON.parse(data) });
          } catch {
            resolve({ ok: false, error: 'invalid JSON response' });
          }
        });
      });

      req.on('error', (err) => {
        resolve({ ok: false, error: err.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ ok: false, error: 'timeout' });
      });

      req.write(JSON.stringify(body));
      req.end();
    } catch (err) {
      resolve({ ok: false, error: err.message });
    }
  });
}

// ─── Hook-level MiniCheck verification ────────────────────────────────
// Calls Ollama's bespoke-minicheck model to verify claims against the
// output as "evidence". MiniCheck was trained specifically for
// document→claim verification (EMNLP 2024).

async function verifyWithMiniCheck(claims, evidence) {
  // Returns: { available: bool, results: [{claim, supported: bool}] }
  const results = [];

  for (const claim of claims) {
    const prompt = `Document: ${evidence.substring(0, 2000)}\nClaim: ${claim}\nIs the claim supported by the document? Answer only "Yes" or "No".`;

    const res = await httpPost(MINICHECK_URL, {
      model: MINICHECK_MODEL,
      prompt,
      stream: false,
      options: { temperature: 0 }
    }, {}, HTTP_TIMEOUT_MS);

    if (!res.ok) {
      return { available: false, results: [] };
    }

    const answer = (res.data.response || '').trim().toLowerCase();
    results.push({
      claim,
      supported: answer.startsWith('yes')
    });
  }

  return { available: true, results };
}

// ─── Hook-level multi-model cross-check ───────────────────────────────
// Calls 9Router to ask a different model family whether the claims are
// accurate. Divergence from Claude's output signals hallucination.

async function verifyWithMultiModel(claims) {
  // Returns: { available: bool, results: [{claim, agrees: bool, response: string}] }
  const claimList = claims.map((c, i) => `${i + 1}. ${c}`).join('\n');

  const res = await httpPost(NROUTER_URL, {
    model: 'gpt-4o-mini',  // cheap, fast, different model family
    messages: [
      {
        role: 'system',
        content: 'You are a fact-checker. For each claim, respond with ONLY "AGREE" or "DISAGREE" followed by a one-sentence reason. Number your responses to match the claims.'
      },
      {
        role: 'user',
        content: `Check these claims for accuracy:\n${claimList}`
      }
    ],
    max_tokens: 500,
    temperature: 0
  }, {
    'Authorization': `Bearer ${NROUTER_TOKEN}`
  }, HTTP_TIMEOUT_MS);

  if (!res.ok) {
    return { available: false, results: [] };
  }

  const content = res.data?.choices?.[0]?.message?.content || '';
  const results = claims.map((claim, i) => {
    // Check if the response for this claim says DISAGREE
    const pattern = new RegExp(`${i + 1}\\.\\s*(DISAGREE|AGREE)`, 'i');
    const match = content.match(pattern);
    return {
      claim,
      agrees: match ? match[1].toUpperCase() === 'AGREE' : true, // benefit of the doubt
      response: content
    };
  });

  return { available: true, results };
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

    // ── Step 1: Anti-loop check ───────────────────────────────────────
    // If we already blocked this session once, allow through.
    // This prevents Claude from getting stuck in verify→block→verify loops.
    if (hasBlockedThisSession(sessionId)) {
      process.exit(0);
      return;
    }

    // ── Step 2: Check if response needs verification ──────────────────
    if (!responseHasFactualClaims(output)) {
      process.exit(0); // Nothing to verify
      return;
    }

    // ── Step 3: Check if verification already occurred ─────────────────
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

    // ── Step 4: Hook-level external verification ──────────────────────
    // Before blocking, try to verify claims ourselves using external
    // services. This catches cases where Claude's claims are actually
    // correct but verification wasn't explicitly invoked.

    const claims = extractClaims(output);

    if (claims.length > 0) {
      let externallyVerified = false;

      // Try MiniCheck first (purpose-built for this)
      const minicheck = await verifyWithMiniCheck(claims, output);
      if (minicheck.available) {
        const allSupported = minicheck.results.every(r => r.supported);
        if (allSupported) {
          log(`MiniCheck verified ${claims.length} claims — allowing`);
          externallyVerified = true;
        } else {
          const failed = minicheck.results.filter(r => !r.supported);
          log(`MiniCheck found ${failed.length} unsupported claims — will block`);
        }
      }

      // If MiniCheck not available, try multi-model cross-check
      if (!minicheck.available) {
        const multimodel = await verifyWithMultiModel(claims);
        if (multimodel.available) {
          const allAgree = multimodel.results.every(r => r.agrees);
          if (allAgree) {
            log(`Multi-model agreed on ${claims.length} claims — allowing`);
            externallyVerified = true;
          } else {
            const disagreed = multimodel.results.filter(r => !r.agrees);
            log(`Multi-model disagreed on ${disagreed.length} claims — will block`);
          }
        }
      }

      if (externallyVerified) {
        process.exit(0); // External verification passed — allow
        return;
      }
    }

    // ── Step 5: Block — tell Claude to verify ─────────────────────────
    markBlocked(sessionId);

    // Use proper JSON decision output (preferred over exit code 2)
    const decision = {
      decision: 'block',
      reason: [
        'Truth Shield enforcement: this response contains factual claims but',
        'no verification was detected. Please run the truth-shield skill to',
        'verify claims before presenting them. Use the verification tiers',
        'available (Grep/Read for code, WebSearch for facts, Context7 for',
        'library docs, etc.).'
      ].join(' ')
    };

    log(`Blocked session ${sessionId} — unverified factual claims`);
    process.stdout.write(JSON.stringify(decision));
    process.exit(0);

  } catch (err) {
    // Hook must NEVER crash Claude. Log and allow.
    try {
      log(`ERROR: ${err.stack || err.message || err}`);
    } catch { /* truly last resort */ }
    process.exit(0);
  }
}

main();
