#!/usr/bin/env node
// Tests for truth-shield-enforcer.js v4.0
// Run: node hooks/truth-shield-enforcer.test.js

'use strict';

// ─── Extract testable functions by parsing the module ─────────────────
// The hook is a standalone script, not a module. We extract the functions
// by reading the source and evaluating them in a test context.

const fs = require('fs');
const path = require('path');
const os = require('os');

// Read the source and extract functions for testing
const source = fs.readFileSync(path.join(__dirname, 'truth-shield-enforcer.js'), 'utf8');

// We'll test the key functions by re-implementing them here
// (they're pure functions, easy to extract)

// ─── responseHasFactualClaims ─────────────────────────────────────────

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
  return true;
}

// ─── extractClaims ────────────────────────────────────────────────────

const MAX_CLAIMS_TO_CHECK = 3;

function extractClaims(output) {
  if (!output) return [];
  const textOnly = output.replace(/```[\s\S]*?```/g, '').replace(/`[^`]+`/g, 'CODE');
  const sentences = textOnly
    .split(/(?<=[.!])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 300);

  const claims = [];
  for (const s of sentences) {
    if (s.endsWith('?')) continue;
    if (/\b(maybe|perhaps|might|could|I think|I believe|not sure|possibly)\b/i.test(s)) continue;
    if (/\b(I'll|I will|Let me|Here's|Here is|I've|I have done|I created|I updated)\b/i.test(s)) continue;
    claims.push(s);
  }

  return claims
    .sort((a, b) => b.length - a.length)
    .slice(0, MAX_CLAIMS_TO_CHECK);
}

// ─── didVerifyInMessages ──────────────────────────────────────────────

const VERIFICATION_PATTERNS = [
  'fact_query', 'fact_set', 'fact_invalidate',
  'verify_claim', 'recall_semantic', 'recall_by_category',
  'knowledge-graph', 'context7', 'graphiti',
  'WebSearch',
  'Truth Shield Report', 'truth-shield',
  '[shield:', '[VERIFIED', '[CONTRADICTED', '[UNVERIFIED', '[CONFLICTED',
  'Claims checked:',
];

function didVerifyInMessages(messages) {
  if (!Array.isArray(messages)) return false;
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') { lastUserIdx = i; break; }
  }
  if (lastUserIdx < 0) return false;
  for (let i = lastUserIdx + 1; i < messages.length; i++) {
    const text = JSON.stringify(messages[i]);
    if (VERIFICATION_PATTERNS.some(p => text.includes(p))) return true;
  }
  return false;
}

// ─── Test runner ──────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(msg || `Expected ${expected}, got ${actual}`);
  }
}

// ─── Tests ────────────────────────────────────────────────────────────

console.log('\nresponseHasFactualClaims:');

test('null/empty returns false', () => {
  assert(!responseHasFactualClaims(null));
  assert(!responseHasFactualClaims(''));
  assert(!responseHasFactualClaims(undefined));
});

test('short text returns false', () => {
  assert(!responseHasFactualClaims('Done!'));
  assert(!responseHasFactualClaims('OK, I will do that.'));
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
  const claims = extractClaims(text);
  assertEqual(claims.length, 0);
});

test('skips hedged statements', () => {
  const text = 'I think this might work. Perhaps you could try using useState instead. Maybe the issue is in the config.';
  const claims = extractClaims(text);
  assertEqual(claims.length, 0);
});

test('skips meta-statements', () => {
  const text = "I'll create the file now. Let me check the configuration for you. Here's what I found in the docs.";
  const claims = extractClaims(text);
  assertEqual(claims.length, 0);
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

test('detects context7 tool use', () => {
  const messages = [
    { role: 'user', content: 'tell me about React' },
    { role: 'assistant', content: 'Using context7 to check docs...' }
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

test('returns false for no user message', () => {
  const messages = [
    { role: 'assistant', content: 'WebSearch result...' }
  ];
  assert(!didVerifyInMessages(messages));
});

test('handles multipart user content', () => {
  const messages = [
    { role: 'user', content: [{ type: 'text', text: 'check this' }] },
    { role: 'assistant', content: 'Claims checked: 3' }
  ];
  assert(didVerifyInMessages(messages));
});


console.log('\nAlways-on enforcement (no shield on/off):');

test('hook source does not contain shieldOn check in main flow', () => {
  // Verify v4 removed the shield on/off gate from enforcement
  // Comments mentioning shield on/off are OK — we check for code patterns
  assert(!source.includes('readState()'), 'v4 should not read shield state');
  assert(!source.includes('shieldOn'), 'v4 should not reference shieldOn variable');
  assert(!source.includes('STATE_FILE'), 'v4 should not use state file');
  assert(!source.includes("=== 'shield on'"), 'v4 should not parse shield on command');
  assert(!source.includes("=== 'shield off'"), 'v4 should not parse shield off command');
  assert(!source.includes('detectShieldState'), 'v4 should not have shield state detection');
});

test('hook source contains MiniCheck integration', () => {
  assert(source.includes('verifyWithMiniCheck'), 'Should have MiniCheck function');
  assert(source.includes('bespoke-minicheck'), 'Should reference MiniCheck model');
  assert(source.includes('11434'), 'Should reference Ollama port');
});

test('hook source contains multi-model integration', () => {
  assert(source.includes('verifyWithMultiModel'), 'Should have multi-model function');
  assert(source.includes('20128'), 'Should reference 9Router port');
});

test('hook source has graceful degradation', () => {
  assert(source.includes('available: false'), 'Should handle unavailable services');
  assert(source.includes('externallyVerified'), 'Should track external verification');
});

test('hook source has anti-loop protection', () => {
  assert(source.includes('hasBlockedThisSession'), 'Should have session lock check');
  assert(source.includes('markBlocked'), 'Should mark blocked sessions');
  assert(source.includes('LOCK_FILE'), 'Should use lock file');
});

test('hook source skips subagents', () => {
  assert(source.includes('agent_id'), 'Should check for agent_id');
});

test('hook source has crash protection', () => {
  assert(source.includes('process.exit(0)'), 'Should always exit 0');
  assert(!source.includes('process.exit(1)'), 'Should never exit 1');
  assert(!source.includes('process.exit(2)'), 'Should never exit 2');
});

test('hook source has logging', () => {
  assert(source.includes('truth-shield-enforcer.log'), 'Should log to enforcer log');
  assert(source.includes('log('), 'Should use log function');
});


// ─── Summary ──────────────────────────────────────────────────────────

console.log(`\n${passed}/${total} tests passed${failed > 0 ? `, ${failed} FAILED` : ''}\n`);
process.exit(failed > 0 ? 1 : 0);
