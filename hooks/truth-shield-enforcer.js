#!/usr/bin/env node
// Truth Shield Enforcer — Claude Code Stop Hook (v4.1 — bulletproof)
//
// Always-on enforcement: every response with factual claims is checked.
// If verification wasn't done, tries hook-level MiniCheck/multi-model
// before blocking. Gracefully degrades when external services are down.
//
// Hardening (v4.1):
//   - Atomic lock file writes (write-to-temp, rename)
//   - Cold-start aware MiniCheck (8s first call, 4s subsequent)
//   - Stdin race-condition fix (resolved-once flag)
//   - stdout drain before exit (never lose block decision)
//   - HTTP response size cap (1MB) + socket cleanup
//   - Output truncation before claim extraction (32KB)
//   - Log rotation (cap at 256KB)
//   - Abbreviation-aware sentence splitting
//   - OLLAMA_HOST env var support
//   - Global safety timeout (25s hard ceiling)
//   - Circular-ref-safe JSON.stringify
//
// Anti-loop: tracks enforcement per session. After one block, allows through.
//
// Install: Add to ~/.claude/settings.json under hooks.Stop (timeout: 30)
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
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const MINICHECK_URL = `${OLLAMA_HOST}/api/generate`;
const MINICHECK_MODEL = 'bespoke-minicheck';
const NROUTER_URL = 'http://localhost:20128/v1/chat/completions';
const NROUTER_TOKEN = '9router';
const HTTP_TIMEOUT_COLD_MS = 8000;  // first MiniCheck call (model loading)
const HTTP_TIMEOUT_WARM_MS = 4000;  // subsequent calls
const MAX_CLAIMS_TO_CHECK = 3;
const MAX_OUTPUT_BYTES = 32768;     // truncate output before processing
const MAX_HTTP_RESPONSE = 1048576;  // 1MB cap on HTTP responses
const MAX_LOG_BYTES = 262144;       // 256KB log rotation threshold
const GLOBAL_TIMEOUT_MS = 25000;    // hard ceiling — exit before hook timeout

// ─── Global safety timeout ───────────────────────────────────────────
// Ensures we ALWAYS exit before the 30s hook timeout, no matter what.
const globalTimer = setTimeout(() => {
  try { log('SAFETY: global 25s timeout hit — allowing through'); } catch {}
  process.exit(0);
}, GLOBAL_TIMEOUT_MS);
// Don't let this timer keep the process alive if main() finishes first
globalTimer.unref();

// ─── Safe exit ───────────────────────────────────────────────────────
// Ensures stdout is flushed before exiting (prevents lost block decisions).

function safeExit(code = 0) {
  clearTimeout(globalTimer);
  if (process.stdout.writableEnded || !process.stdout.writable) {
    process.exit(code);
  } else {
    // Wait for stdout to drain, but don't wait forever
    const drainTimer = setTimeout(() => process.exit(code), 500);
    drainTimer.unref();
    process.stdout.end(() => {
      clearTimeout(drainTimer);
      process.exit(code);
    });
  }
}

// ─── Logging with rotation ───────────────────────────────────────────

function log(msg) {
  try {
    const logDir = path.dirname(LOG_FILE);
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

    // Rotate if too large
    try {
      const stat = fs.statSync(LOG_FILE);
      if (stat.size > MAX_LOG_BYTES) {
        const rotated = LOG_FILE + '.old';
        try { fs.unlinkSync(rotated); } catch {}
        fs.renameSync(LOG_FILE, rotated);
      }
    } catch { /* file doesn't exist yet — fine */ }

    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`);
  } catch { /* best-effort */ }
}

// ─── Safe JSON.stringify ─────────────────────────────────────────────
// Handles circular references without throwing.

function safeStringify(obj) {
  try {
    return JSON.stringify(obj);
  } catch {
    try {
      const seen = new WeakSet();
      return JSON.stringify(obj, (_, v) => {
        if (typeof v === 'object' && v !== null) {
          if (seen.has(v)) return '[Circular]';
          seen.add(v);
        }
        return v;
      });
    } catch {
      return String(obj);
    }
  }
}

// ─── Anti-loop: atomic lock file operations ──────────────────────────
// Write-to-temp-then-rename prevents partial writes on crash.

function hasBlockedThisSession(sessionId) {
  try {
    const raw = fs.readFileSync(LOCK_FILE, 'utf8');
    if (!raw || !raw.trim()) return false;
    const lock = JSON.parse(raw);
    // Stale lock (>10 min) = ignore
    if (Date.now() - (lock.timestamp || 0) > 600000) return false;
    return lock.sessionId === sessionId;
  } catch {
    return false;
  }
}

function markBlocked(sessionId) {
  try {
    const data = JSON.stringify({ sessionId, timestamp: Date.now() });
    const tmp = LOCK_FILE + '.tmp';
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, LOCK_FILE);
  } catch {
    // Fallback: direct write (rename may fail cross-device)
    try {
      fs.writeFileSync(LOCK_FILE, JSON.stringify({ sessionId, timestamp: Date.now() }));
    } catch { /* best-effort */ }
  }
}

// ─── Stdin reader (race-safe) ────────────────────────────────────────
// Uses a resolved-once flag so both 'end' and setTimeout don't fight.

function readStdin() {
  return new Promise((resolve) => {
    let buf = '';
    let resolved = false;
    const done = () => {
      if (resolved) return;
      resolved = true;
      resolve(buf);
    };
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { buf += chunk; });
    process.stdin.on('end', done);
    process.stdin.on('error', done);
    // Safety timeout: if stdin never closes, don't hang forever
    setTimeout(done, 2000);
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
    const text = safeStringify(messages[i]);
    if (VERIFICATION_PATTERNS.some(p => text.includes(p))) return true;
  }
  return false;
}

function didVerifyInTranscript(transcriptPath) {
  try {
    const stat = fs.statSync(transcriptPath);
    // Don't try to read enormous transcripts — benefit of the doubt
    if (stat.size > 10 * 1024 * 1024) return true;

    const data = fs.readFileSync(transcriptPath, 'utf8');
    const lines = data.trim().split('\n');

    // Only scan last 200 lines for performance
    const startIdx = Math.max(0, lines.length - 200);
    let lastUserIdx = -1;
    for (let i = lines.length - 1; i >= startIdx; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        if (entry.type === 'user') { lastUserIdx = i; break; }
      } catch { /* skip malformed */ }
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

  // Task confirmations: "Done.", "Created X.", etc.
  const actionPhrases = /^(Done|Created|Updated|Deleted|Installed|Removed|Fixed|Added|Committed|Pushed|Saved|Copied|Moved|Renamed)\b/i;
  const firstLine = text.split('\n')[0].trim();
  if (firstLine.length < 120 && actionPhrases.test(firstLine) && text.length < 300) return false;

  // Error reports / stack traces (not factual claims)
  if (/^(Error|TypeError|ReferenceError|SyntaxError|ENOENT|EACCES|EPERM)\b/.test(firstLine)) return false;

  // Git output, file listings, command output
  if (/^(commit [a-f0-9]{7,}|diff --git|On branch |Your branch |Changes |Untracked )/m.test(text) && text.length < 500) return false;

  // Code-specific diagnostic/debugging analysis (about the user's code, not world-facts).
  // These reference specific functions, line numbers, and suggest fixes — not factual claims.
  const diagPhrases = (text.match(/\b(the issue is|the problem is|the error is|the bug is|should fix|to fix this|to resolve|looking at the error|looking at the trace|looking at the stack|looking at the log)\b/gi) || []).length;
  const codeRefs = (text.match(/\b(line \d+|on line|function `|method `|variable `|in `[^`]+`|file `[^`]+`)\b/gi) || []).length;
  if (diagPhrases >= 1 && codeRefs >= 1 && text.length < 500) return false;

  return true;
}

// ─── Claim extraction (abbreviation-aware) ───────────────────────────

// Common abbreviations that end with periods but aren't sentence endings
const ABBREVIATIONS = /\b(Dr|Mr|Mrs|Ms|Prof|Sr|Jr|Inc|Ltd|Corp|etc|vs|i\.e|e\.g|U\.S|U\.K|a\.m|p\.m)\.\s/g;

function extractClaims(output) {
  if (!output) return [];

  // Truncate to prevent processing enormous outputs
  const truncated = output.length > MAX_OUTPUT_BYTES
    ? output.substring(0, MAX_OUTPUT_BYTES)
    : output;

  // Strip code blocks and inline code
  const textOnly = truncated
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, 'CODE');

  // Protect abbreviations from sentence splitting
  let protected_ = textOnly.replace(ABBREVIATIONS, (match) =>
    match.replace(/\.\s/, '·ABBR·')
  );

  // Protect numbered list prefixes ("1. ", "2. ") from sentence splitting
  protected_ = protected_.replace(/^(\d+)\.\s/gm, '$1·NUM·');

  // Split on newlines first, then on sentence boundaries
  const lines = protected_.split(/\n/).map(l => l.trim()).filter(Boolean);
  const sentences = [];
  for (const line of lines) {
    // Further split lines on sentence boundaries (period/exclamation followed by space+capital)
    const parts = line
      .split(/(?<=[.!])\s+(?=[A-Z])/)
      .map(s => s.replace(/·ABBR·/g, '. ').replace(/·NUM·/g, '. ').trim())
      .filter(s => s.length > 20 && s.length < 300);
    sentences.push(...parts);
  }

  const claims = [];
  for (const s of sentences) {
    // Skip questions
    if (s.endsWith('?')) continue;
    // Skip hedged statements
    if (/\b(maybe|perhaps|might|could|I think|I believe|not sure|possibly|probably)\b/i.test(s)) continue;
    // Skip pure meta-statements (Claude describing its own actions, with no factual payload).
    // "I'll create the file" → skip. But "I'll note that React 18 uses concurrent rendering" → keep
    // because the factual claim ("React 18 uses concurrent rendering") is the point.
    if (/^(I'll|I will|Let me|Here's|Here is|I've done|I have done|I created|I updated|I deleted|I installed|I removed|I fixed|I added)\b/i.test(s)) {
      // Check if there's a factual payload after a colon, "that", or dash
      const payloadMatch = s.match(/(?::|—|–|-\s|that\s)(.{20,})/);
      if (payloadMatch) {
        // The payload itself might be factual — extract and re-check it
        const payload = payloadMatch[1].trim();
        if (!/\b(maybe|perhaps|might|could|I think|I believe|not sure)\b/i.test(payload)) {
          claims.push(payload);
        }
      }
      continue;
    }
    // Skip bullet-point action items ("- Fix the bug", "* Update docs") but NOT factual bullets
    // ("- Express defaults to port 3000"). Action items start with a verb.
    if (/^[-*•]\s/.test(s)) {
      const bulletContent = s.replace(/^[-*•]\s+/, '');
      // Action-item verbs → skip the bullet entirely
      if (/^(Fix|Update|Add|Remove|Delete|Install|Create|Set up|Configure|Check|Test|Run|Build|Deploy|Refactor|Move|Rename|Merge|Push|Pull|Revert|Review|Implement|Migrate|Clean|Write)\b/i.test(bulletContent)) continue;
      // Otherwise treat bullet content as potential claim
      claims.push(bulletContent);
      continue;
    }
    // Same for numbered list items ("1. Create the schema", "2) Deploy to staging")
    if (/^\d+[.)]\s/.test(s)) {
      const numberedContent = s.replace(/^\d+[.)]\s+/, '');
      if (/^(Fix|Update|Add|Remove|Delete|Install|Create|Set up|Configure|Check|Test|Run|Build|Deploy|Refactor|Move|Rename|Merge|Push|Pull|Revert|Review|Implement|Migrate|Clean|Write)\b/i.test(numberedContent)) continue;
      // Otherwise treat as potential claim
      claims.push(numberedContent);
      continue;
    }
    // Skip table rows (lines starting and ending with pipes)
    if (/^\|.*\|$/.test(s)) continue;
    // Skip markdown headers
    if (/^#{1,6}\s/.test(s)) continue;
    claims.push(s);
  }

  // Return top N most checkable claims (longest = most specific = most verifiable)
  return claims
    .sort((a, b) => b.length - a.length)
    .slice(0, MAX_CLAIMS_TO_CHECK);
}

// ─── HTTP helper (hardened) ──────────────────────────────────────────
// - Response size cap prevents memory bombs
// - Proper socket cleanup on timeout/error
// - Never rejects — always resolves with {ok, data/error}

function httpPost(url, body, headers = {}, timeoutMs = HTTP_TIMEOUT_WARM_MS) {
  return new Promise((resolve) => {
    let resolved = false;
    const done = (result) => {
      if (resolved) return;
      resolved = true;
      resolve(result);
    };

    try {
      const parsed = new URL(url);
      const payload = JSON.stringify(body);

      const options = {
        hostname: parsed.hostname,
        port: parsed.port || 80,
        path: parsed.pathname + (parsed.search || ''),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...headers
        },
        timeout: timeoutMs
      };

      const req = http.request(options, (res) => {
        let data = '';
        let bytes = 0;

        res.on('data', (chunk) => {
          bytes += chunk.length;
          if (bytes > MAX_HTTP_RESPONSE) {
            // Response too large — abort
            req.destroy();
            done({ ok: false, error: 'response too large' });
            return;
          }
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            done({ ok: false, error: `HTTP ${res.statusCode}` });
            return;
          }
          try {
            done({ ok: true, data: JSON.parse(data) });
          } catch {
            done({ ok: false, error: 'invalid JSON response' });
          }
        });

        res.on('error', (err) => {
          done({ ok: false, error: `response error: ${err.message}` });
        });
      });

      req.on('error', (err) => {
        done({ ok: false, error: err.message });
      });

      req.on('timeout', () => {
        req.destroy();
        done({ ok: false, error: 'timeout' });
      });

      req.write(payload);
      req.end();
    } catch (err) {
      done({ ok: false, error: err.message });
    }
  });
}

// ─── MiniCheck warm-check ────────────────────────────────────────────
// Quick check if Ollama is up and MiniCheck model is loaded.
// Returns false if service is down (avoids wasting time on cold start).

let miniCheckWarm = false;

async function isMiniCheckAvailable() {
  const res = await httpPost(
    `${OLLAMA_HOST}/api/show`,
    { model: MINICHECK_MODEL },
    {},
    2000  // fast check
  );
  if (res.ok) {
    miniCheckWarm = true;
    return true;
  }
  return false;
}

// ─── Hook-level MiniCheck verification ────────────────────────────────

async function verifyWithMiniCheck(claims) {
  // Quick availability check first
  const available = await isMiniCheckAvailable();
  if (!available) {
    return { available: false, results: [] };
  }

  const results = [];
  // Use cold timeout for first call if model wasn't recently used
  const timeout = miniCheckWarm ? HTTP_TIMEOUT_WARM_MS : HTTP_TIMEOUT_COLD_MS;

  for (const claim of claims) {
    // IMPORTANT: Do NOT use the output as the "document" — that's circular
    // (the output contains the claim, so MiniCheck would always say "Yes").
    // Instead, ask MiniCheck to judge factual accuracy independently.
    const prompt = `Document: No reference document available. Use your training knowledge.\nClaim: ${claim}\nIs this claim factually accurate? Answer only "Yes" or "No".`;

    const res = await httpPost(MINICHECK_URL, {
      model: MINICHECK_MODEL,
      prompt,
      stream: false,
      options: { temperature: 0, num_predict: 5 }  // limit output to ~5 tokens
    }, {}, timeout);

    if (!res.ok) {
      log(`MiniCheck call failed: ${res.error}`);
      return { available: false, results: [] };
    }

    const answer = (res.data.response || '').trim().toLowerCase();
    // Flexible parsing: "yes", "Yes.", "Yes, the claim is supported"
    const supported = /^yes\b/i.test(answer.trim());
    results.push({ claim, supported });

    // After first successful call, model is warm
    miniCheckWarm = true;
  }

  return { available: true, results };
}

// ─── Hook-level multi-model cross-check ───────────────────────────────

async function verifyWithMultiModel(claims) {
  const claimList = claims.map((c, i) => `${i + 1}. ${c}`).join('\n');

  const res = await httpPost(NROUTER_URL, {
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a fact-checker. For each numbered claim, respond with ONLY "AGREE" or "DISAGREE" followed by a one-sentence reason. Number your responses to match.'
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
  }, HTTP_TIMEOUT_WARM_MS);

  if (!res.ok) {
    return { available: false, results: [] };
  }

  const content = res.data?.choices?.[0]?.message?.content || '';
  if (!content.trim()) {
    return { available: false, results: [] };
  }

  const results = claims.map((claim, i) => {
    const num = i + 1;
    // Flexible parsing: "1. AGREE", "1) DISAGREE", "1: AGREE"
    const pattern = new RegExp(`${num}[.):}\\s]+\\s*(DISAGREE|AGREE)`, 'i');
    const match = content.match(pattern);
    return {
      claim,
      agrees: match ? match[1].toUpperCase() === 'AGREE' : true,  // benefit of the doubt
    };
  });

  return { available: true, results };
}

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  try {
    const raw = await readStdin();
    if (!raw.trim()) { safeExit(0); return; }

    let input;
    try { input = JSON.parse(raw); } catch { safeExit(0); return; }

    // Only run on Stop events
    if ((input.hook_event_name || '') !== 'Stop') { safeExit(0); return; }

    // Don't enforce inside subagents — they're tool executions, not user-facing
    if (input.agent_id) { safeExit(0); return; }

    const sessionId = input.session_id || 'unknown';
    const output = typeof input.output === 'string' ? input.output : '';
    const messages = input.messages;
    const transcriptPath = input.transcript_path;

    // ── Step 1: Anti-loop ─────────────────────────────────────────────
    if (hasBlockedThisSession(sessionId)) {
      safeExit(0);
      return;
    }

    // ── Step 2: Response classification ───────────────────────────────
    if (!responseHasFactualClaims(output)) {
      safeExit(0);
      return;
    }

    // ── Step 3: Verification detection ────────────────────────────────
    let verified = false;
    if (Array.isArray(messages) && messages.length > 0) {
      verified = didVerifyInMessages(messages);
    }
    if (!verified && transcriptPath) {
      verified = didVerifyInTranscript(transcriptPath);
    }
    if (verified) {
      safeExit(0);
      return;
    }

    // ── Step 4: Hook-level external verification ──────────────────────
    const claims = extractClaims(output);

    // If no extractable claims survived filtering (all hedged, meta, etc.),
    // there's nothing factual to verify — allow through.
    if (claims.length === 0) {
      log(`ALLOW: no extractable claims after filtering [session=${sessionId}]`);
      safeExit(0);
      return;
    }

    if (claims.length > 0) {
      let externallyVerified = false;

      // Try MiniCheck first (purpose-built for fact-checking)
      const minicheck = await verifyWithMiniCheck(claims);
      if (minicheck.available) {
        const allSupported = minicheck.results.every(r => r.supported);
        if (allSupported) {
          log(`ALLOW: MiniCheck verified ${claims.length}/${claims.length} claims [session=${sessionId}]`);
          externallyVerified = true;
        } else {
          const failed = minicheck.results.filter(r => !r.supported);
          log(`BLOCK: MiniCheck rejected ${failed.length}/${claims.length} claims [session=${sessionId}]: ${failed.map(f => f.claim.substring(0, 60)).join(' | ')}`);
        }
      } else {
        log(`MiniCheck unavailable, trying multi-model [session=${sessionId}]`);
      }

      // Fallback: multi-model cross-check via 9Router
      if (!minicheck.available) {
        const multimodel = await verifyWithMultiModel(claims);
        if (multimodel.available) {
          const allAgree = multimodel.results.every(r => r.agrees);
          if (allAgree) {
            log(`ALLOW: multi-model agreed on ${claims.length}/${claims.length} claims [session=${sessionId}]`);
            externallyVerified = true;
          } else {
            const disagreed = multimodel.results.filter(r => !r.agrees);
            log(`BLOCK: multi-model disagreed on ${disagreed.length}/${claims.length} claims [session=${sessionId}]`);
          }
        } else {
          log(`Both MiniCheck and multi-model unavailable [session=${sessionId}]`);
        }
      }

      if (externallyVerified) {
        safeExit(0);
        return;
      }
    }

    // ── Step 5: Block ─────────────────────────────────────────────────
    markBlocked(sessionId);

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

    log(`BLOCK: unverified factual claims [session=${sessionId}] [claims=${claims.length}]`);
    process.stdout.write(JSON.stringify(decision), () => {
      // Callback ensures the write is flushed before we exit
      safeExit(0);
    });

  } catch (err) {
    // Hook must NEVER crash Claude. Log and allow.
    try {
      log(`ERROR: ${err.stack || err.message || err}`);
    } catch { /* truly last resort */ }
    safeExit(0);
  }
}

main();
