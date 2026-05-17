#!/usr/bin/env node
// Tests for truth-shield-enforcer.js v4.1 (bulletproof)
// Run: node hooks/truth-shield-enforcer.test.js

'use strict';

const fs = require('fs');
const path = require('path');

// Read the source for structural tests
const source = fs.readFileSync(path.join(__dirname, 'truth-shield-enforcer.js'), 'utf8');

// ─── Re-implement testable pure functions ─────────────────────────────

const ABBREVIATIONS = /\b(Dr|Mr|Mrs|Ms|Prof|Sr|Jr|Inc|Ltd|Corp|etc|vs|i\.e|e\.g|U\.S|U\.K|a\.m|p\.m)\.\s/g;
const MAX_CLAIMS_TO_CHECK = 3;
const MAX_OUTPUT_BYTES = 32768;

function responseHasFactualClaims(output) {
  if (!output || typeof output !== 'string') return false;
  const text = output.trim();
  if (text.length < 60) return false;
  if (text.includes('[shield:') || text.includes('Truth Shield Report')) return false;
  const sentences = text.split(/[.!]\s/);
  const questionRatio = sentences.filter(s => s.trim().endsWith('?')).length / Math.max(sentences.length, 1);
  if (questionRatio > 0.7) return false;
  const codeBlockCount = (text.match(/```/g) || []).length;
  const nonCodeLength = text.replace(/```[\s\S]*?```/g, '').trim().length;
  if (codeBlockCount >= 2 && nonCodeLength < 100) return false;
  const actionPhrases = /^(Done|Created|Updated|Deleted|Installed|Removed|Fixed|Added|Committed|Pushed|Saved|Copied|Moved|Renamed)\b/i;
  const firstLine = text.split('\n')[0].trim();
  if (firstLine.length < 120 && actionPhrases.test(firstLine) && text.length < 300) return false;
  if (/^(Error|TypeError|ReferenceError|SyntaxError|ENOENT|EACCES|EPERM)\b/.test(firstLine)) return false;
  if (/^(commit [a-f0-9]{7,}|diff --git|On branch |Your branch |Changes |Untracked )/m.test(text) && text.length < 500) return false;
  return true;
}

function extractClaims(output) {
  if (!output) return [];
  const truncated = output.length > MAX_OUTPUT_BYTES ? output.substring(0, MAX_OUTPUT_BYTES) : output;
  const textOnly = truncated.replace(/```[\s\S]*?```/g, '').replace(/`[^`]+`/g, 'CODE');
  const protected_ = textOnly.replace(ABBREVIATIONS, (match) => match.replace(/\.\s/, '·ABBR·'));
  const lines = protected_.split(/\n/).map(l => l.trim()).filter(Boolean);
  const sentences = [];
  for (const line of lines) {
    const parts = line.split(/(?<=[.!])\s+(?=[A-Z])/).map(s => s.replace(/·ABBR·/g, '. ').trim()).filter(s => s.length > 20 && s.length < 300);
    sentences.push(...parts);
  }
  const claims = [];
  for (const s of sentences) {
    if (s.endsWith('?')) continue;
    if (/\b(maybe|perhaps|might|could|I think|I believe|not sure|possibly|probably)\b/i.test(s)) continue;
    if (/\b(I'll|I will|Let me|Here's|Here is|I've done|I have done|I created|I updated|I deleted|I installed|I removed|I fixed|I added)\b/i.test(s)) continue;
    if (/^[-*•]\s/.test(s)) continue;
    if (/^\|.*\|$/.test(s)) continue;
    if (/^#{1,6}\s/.test(s)) continue;
    claims.push(s);
  }
  return claims.sort((a, b) => b.length - a.length).slice(0, MAX_CLAIMS_TO_CHECK);
}

const VERIFICATION_PATTERNS = [
  'fact_query', 'fact_set', 'fact_invalidate',
  'verify_claim', 'recall_semantic', 'recall_by_category',
  'knowledge-graph', 'context7', 'graphiti',
  'WebSearch',
  'Truth Shield Report', 'truth-shield',
  '[shield:', '[VERIFIED', '[CONTRADICTED', '[UNVERIFIED', '[CONFLICTED',
  'Claims checked:',
];

function safeStringify(obj) {
  try { return JSON.stringify(obj); }
  catch {
    try {
      const seen = new WeakSet();
      return JSON.stringify(obj, (_, v) => {
        if (typeof v === 'object' && v !== null) { if (seen.has(v)) return '[Circular]'; seen.add(v); }
        return v;
      });
    } catch { return String(obj); }
  }
}

function didVerifyInMessages(messages) {
  if (!Array.isArray(messages)) return false;
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') { lastUserIdx = i; break; }
  }
  if (lastUserIdx < 0) return false;
  for (let i = lastUserIdx + 1; i < messages.length; i++) {
    const text = safeStringify(messages[i]);
    if (VERIFICATION_PATTERNS.some(p => text.includes(p))) return true;
  }
  return false;
}

// ─── Test runner ──────────────────────────────────────────────────────

let passed = 0, failed = 0, total = 0;
function test(name, fn) {
  total++;
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (err) { failed++; console.log(`  ✗ ${name}\n    ${err.message}`); }
}
function assert(condition, msg) { if (!condition) throw new Error(msg || 'Assertion failed'); }
function assertEqual(actual, expected, msg) {
  if (actual !== expected) throw new Error(msg || `Expected ${expected}, got ${actual}`);
}

// ═══════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════

console.log('\nresponseHasFactualClaims:');

test('null/empty/undefined returns false', () => {
  assert(!responseHasFactualClaims(null));
  assert(!responseHasFactualClaims(''));
  assert(!responseHasFactualClaims(undefined));
});

test('short text returns false', () => {
  assert(!responseHasFactualClaims('Done!'));
  assert(!responseHasFactualClaims('OK, I will do that.'));
  assert(!responseHasFactualClaims('Sure thing.'));
});

test('already verified returns false', () => {
  assert(!responseHasFactualClaims('React uses virtual DOM. [shield: 1/1 verified]'));
  assert(!responseHasFactualClaims('Truth Shield Report\nClaims checked: 2'));
});

test('pure questions return false', () => {
  assert(!responseHasFactualClaims('What framework are you using? Which version? Do you have the config?'));
});

test('pure code blocks return false', () => {
  const code = '```js\nconst x = 1;\nconsole.log(x);\n```\n\n```bash\nnpm install\n```\nShort.';
  assert(!responseHasFactualClaims(code));
});

test('action confirmations return false', () => {
  assert(!responseHasFactualClaims('Done. I updated the file with the new configuration settings.'));
  assert(!responseHasFactualClaims('Created the new component file at src/components/Button.tsx.'));
  assert(!responseHasFactualClaims('Fixed the typo in the README file and updated the version number.'));
});

test('error messages return false', () => {
  assert(!responseHasFactualClaims('Error: Cannot find module "react-query-utils" in the current project dependencies.'));
  assert(!responseHasFactualClaims('TypeError: Cannot read properties of undefined (reading "map"). This happens when data is null.'));
});

test('git output returns false', () => {
  assert(!responseHasFactualClaims('On branch main\nYour branch is up to date with origin/main.\n\nChanges not staged for commit:\n  modified: README.md'));
  assert(!responseHasFactualClaims('commit ab56dcb refactor: rewrite hook from scratch\ncommit 1b2b13a fix: resolve issues'));
});

test('long action confirmation with facts returns true', () => {
  const text = 'Created the component. React hooks were introduced in React 16.8 and they allow you to use state without writing a class component. The useEffect hook runs after every render by default.';
  assert(responseHasFactualClaims(text));
});

test('factual claims return true', () => {
  const text = 'Express.js defaults to port 3000. The app.listen() method was added in Express 3.0 and accepts a callback as its second argument.';
  assert(responseHasFactualClaims(text));
});

test('medium-length factual text returns true', () => {
  const text = 'React uses a virtual DOM to minimize direct DOM manipulations. This approach was pioneered by React in 2013 and has since been adopted by many frameworks.';
  assert(responseHasFactualClaims(text));
});


console.log('\nextractClaims:');

test('extracts factual sentences', () => {
  const text = 'Express defaults to port 3000. The app.listen method was added in Express 3.0. How does this help?';
  const claims = extractClaims(text);
  assert(claims.length === 2, `Expected 2 claims, got ${claims.length}`);
});

test('skips questions', () => {
  const text = 'What framework are you using? Which version do you need?';
  assertEqual(extractClaims(text).length, 0);
});

test('skips hedged statements', () => {
  const text = 'I think this might work. Perhaps you could try using useState instead. Maybe the issue is in the config.';
  assertEqual(extractClaims(text).length, 0);
});

test('skips meta-statements', () => {
  const text = "I'll create the file now. Let me check the configuration for you. Here's what I found in the docs.";
  assertEqual(extractClaims(text).length, 0);
});

test('limits to MAX_CLAIMS_TO_CHECK', () => {
  const text = 'React was created by Facebook. Vue was created by Evan You. Angular was created by Google. Svelte was created by Rich Harris. Solid was created by Ryan Carniato.';
  const claims = extractClaims(text);
  assert(claims.length <= MAX_CLAIMS_TO_CHECK, `Expected <= ${MAX_CLAIMS_TO_CHECK}, got ${claims.length}`);
});

test('strips code blocks before extracting', () => {
  const text = '```js\nconst x = 1;\n```\nReact uses a virtual DOM for efficient rendering across all platforms.';
  const claims = extractClaims(text);
  assert(claims.length >= 1, 'Should find claim outside code block');
  assert(!claims.some(c => c.includes('const x')), 'Should not include code');
});

test('returns empty for null/empty', () => {
  assertEqual(extractClaims(null).length, 0);
  assertEqual(extractClaims('').length, 0);
});

test('handles abbreviations without splitting', () => {
  const text = 'Dr. Smith published the study in the U.S. Journal of Medicine. The results showed a significant improvement over baseline.';
  const claims = extractClaims(text);
  // Should NOT split "Dr. Smith" or "U.S. Journal" into separate sentences
  assert(claims.some(c => c.includes('Dr.') || c.includes('U.S.')), 'Should keep abbreviations intact');
});

test('skips bullet points', () => {
  const text = '- Fix the authentication bug in the login module.\n- Update the API documentation with new endpoints.\n* Add unit tests for the payment service.';
  assertEqual(extractClaims(text).length, 0);
});

test('skips table rows', () => {
  const text = '| Framework | Version | Creator | Release Year |\n| React | 18.2 | Facebook | 2013 |\n| Vue | 3.3 | Evan You | 2014 |';
  const claims = extractClaims(text);
  assertEqual(claims.length, 0, 'Should not extract table rows as claims');
});

test('truncates enormous output', () => {
  const huge = 'React was created by Facebook. '.repeat(5000); // ~150KB
  const claims = extractClaims(huge);
  // Should not crash, should return some claims
  assert(claims.length > 0 && claims.length <= MAX_CLAIMS_TO_CHECK);
});


console.log('\ndidVerifyInMessages:');

test('detects WebSearch in assistant message after user', () => {
  const messages = [
    { role: 'user', content: 'What is React?' },
    { role: 'assistant', content: 'Let me check via WebSearch...' }
  ];
  assert(didVerifyInMessages(messages));
});

test('detects truth-shield markers', () => {
  const messages = [
    { role: 'user', content: 'verify this' },
    { role: 'assistant', content: 'Truth Shield Report\nClaims checked: 2' }
  ];
  assert(didVerifyInMessages(messages));
});

test('detects [VERIFIED] marker', () => {
  const messages = [
    { role: 'user', content: 'check this' },
    { role: 'assistant', content: 'Port 3000 [VERIFIED — Express docs]' }
  ];
  assert(didVerifyInMessages(messages));
});

test('ignores verification before last user message', () => {
  const messages = [
    { role: 'user', content: 'old question' },
    { role: 'assistant', content: 'WebSearch result...' },
    { role: 'user', content: 'new unrelated question' },
    { role: 'assistant', content: 'Here is my answer without verification.' }
  ];
  assert(!didVerifyInMessages(messages));
});

test('returns false for no messages', () => {
  assert(!didVerifyInMessages(null));
  assert(!didVerifyInMessages([]));
});

test('handles multipart user content', () => {
  const messages = [
    { role: 'user', content: [{ type: 'text', text: 'check this' }] },
    { role: 'assistant', content: 'Claims checked: 3' }
  ];
  assert(didVerifyInMessages(messages));
});

test('handles circular references in messages', () => {
  const obj = { role: 'assistant', content: 'WebSearch result' };
  obj.self = obj;  // circular!
  const messages = [
    { role: 'user', content: 'check this' },
    obj
  ];
  // Should not throw
  assert(didVerifyInMessages(messages));
});


console.log('\nsafeStringify:');

test('handles normal objects', () => {
  const result = safeStringify({ a: 1, b: 'test' });
  assert(result.includes('"a":1'));
});

test('handles circular references', () => {
  const obj = { a: 1 };
  obj.self = obj;
  const result = safeStringify(obj);
  assert(result.includes('[Circular]'));
  assert(!result.includes('undefined'));
});

test('handles null and primitives', () => {
  assertEqual(safeStringify(null), 'null');
  assertEqual(safeStringify(42), '42');
  assertEqual(safeStringify('hello'), '"hello"');
});


console.log('\nStructural hardening checks:');

test('always-on: no shield state logic', () => {
  assert(!source.includes('readState()'), 'Should not read shield state');
  assert(!source.includes('shieldOn'), 'Should not reference shieldOn');
  assert(!source.includes('STATE_FILE'), 'Should not use state file');
  assert(!source.includes("=== 'shield on'"), 'Should not parse shield on');
  assert(!source.includes("=== 'shield off'"), 'Should not parse shield off');
  assert(!source.includes('detectShieldState'), 'Should not detect shield state');
});

test('has global safety timeout', () => {
  assert(source.includes('GLOBAL_TIMEOUT_MS'), 'Should have global timeout constant');
  assert(source.includes('globalTimer'), 'Should set global timer');
  assert(source.includes('25000'), 'Should be 25s (under 30s hook timeout)');
});

test('has safe exit with stdout drain', () => {
  assert(source.includes('safeExit'), 'Should have safeExit function');
  assert(source.includes('stdout.end'), 'Should drain stdout before exit');
  assert(source.includes('writableEnded'), 'Should check if stdout already ended');
});

test('has atomic lock file writes', () => {
  assert(source.includes('.tmp'), 'Should write to temp file first');
  assert(source.includes('renameSync'), 'Should rename atomically');
});

test('stdin reader is race-safe', () => {
  assert(source.includes('resolved = false'), 'Should have resolved flag');
  assert(source.includes('if (resolved) return'), 'Should check flag before resolving');
  assert(source.includes('setEncoding'), 'Should set encoding on stdin');
});

test('has MiniCheck warm-check', () => {
  assert(source.includes('isMiniCheckAvailable'), 'Should pre-check MiniCheck');
  assert(source.includes('/api/show'), 'Should use show endpoint for warm check');
  assert(source.includes('miniCheckWarm'), 'Should track warm state');
});

test('has cold-start timeout', () => {
  assert(source.includes('HTTP_TIMEOUT_COLD_MS'), 'Should have cold timeout');
  assert(source.includes('HTTP_TIMEOUT_WARM_MS'), 'Should have warm timeout');
  assert(source.includes('8000'), 'Cold timeout should be 8s');
  assert(source.includes('4000'), 'Warm timeout should be 4s');
});

test('has HTTP response size cap', () => {
  assert(source.includes('MAX_HTTP_RESPONSE'), 'Should cap HTTP responses');
  assert(source.includes('1048576'), 'Should be 1MB cap');
  assert(source.includes('response too large'), 'Should abort oversized responses');
});

test('has output truncation', () => {
  assert(source.includes('MAX_OUTPUT_BYTES'), 'Should cap output processing');
  assert(source.includes('32768'), 'Should be 32KB cap');
  assert(source.includes('truncated'), 'Should truncate before processing');
});

test('has log rotation', () => {
  assert(source.includes('MAX_LOG_BYTES'), 'Should have log size limit');
  assert(source.includes('262144'), 'Should be 256KB limit');
  assert(source.includes('.old'), 'Should rotate to .old');
});

test('has abbreviation-aware splitting', () => {
  assert(source.includes('ABBREVIATIONS'), 'Should define abbreviation patterns');
  assert(source.includes('ABBR'), 'Should use abbreviation placeholder');
  assert(source.includes('Dr|Mr'), 'Should include common abbreviations');
});

test('OLLAMA_HOST env var support', () => {
  assert(source.includes('OLLAMA_HOST'), 'Should read OLLAMA_HOST env var');
  assert(source.includes('process.env.OLLAMA_HOST'), 'Should use env var');
});

test('has Content-Length header', () => {
  assert(source.includes('Content-Length'), 'Should set Content-Length for HTTP requests');
});

test('HTTP status code checking', () => {
  assert(source.includes('statusCode'), 'Should check HTTP status codes');
  assert(source.includes('res.statusCode < 200'), 'Should reject non-2xx');
});

test('num_predict limit on MiniCheck', () => {
  assert(source.includes('num_predict'), 'Should limit MiniCheck output tokens');
});

test('skips error messages and git output', () => {
  assert(source.includes('TypeError'), 'Should skip error messages');
  assert(source.includes('diff --git'), 'Should skip git output');
});

test('no process.exit(1) or process.exit(2)', () => {
  // Only safeExit(0) and process.exit(0) should appear
  const exitCalls = source.match(/process\.exit\(\d+\)/g) || [];
  const nonZero = exitCalls.filter(e => !e.includes('(0)'));
  assert(nonZero.length === 0, `Found non-zero exits: ${nonZero.join(', ')}`);
});

test('never throws unhandled — main wrapped in try/catch', () => {
  assert(source.includes('} catch (err) {'), 'Should have top-level catch');
  assert(source.includes('truly last resort') || source.includes('NEVER crash'), 'Should document crash protection');
});


// ─── Summary ──────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(50)}`);
console.log(`${passed}/${total} tests passed${failed > 0 ? `, ${failed} FAILED` : ' ✓'}`);
console.log(`${'═'.repeat(50)}\n`);
process.exit(failed > 0 ? 1 : 0);
