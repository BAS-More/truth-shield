#!/usr/bin/env node
// Detroit-style containment tests for truth-shield-enforcer.js
// Run: node hooks/truth-shield-containment.test.js
//
// WHY THIS EXISTS
// ---------------
// The enforcer's MiniCheck path sent the fact-checker the literal string
// "Document: No reference document available. Use your training knowledge."
// It never retrieved a source, so it graded claims against the checker's own
// priors and then logged "ALLOW: MiniCheck verified N/N claims". A confident
// hallucination sailed straight through with a verified stamp.
//
// Consensus (gpt-5.6-sol + claude-fable-5) ruled: do NOT bolt retrieval into
// the hook. Fail closed instead. A claim with no retrieved source must never
// be marked verified. Absence of a verifier is safer than a verifier that
// returns confident garbage.
//
// These are Detroit (classicist) tests on purpose: they spawn the REAL hook
// process and stub only the outermost network boundary. Mockist tests are what
// let this bug ship in the first place - the unit tests mocked the very call
// whose absence was the defect.

'use strict';

const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');

const HOOK = path.join(__dirname, 'truth-shield-enforcer.js');

let passed = 0, failed = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; failures.push(name); console.log(`  ✗ ${name}${detail ? '\n      ' + detail : ''}`); }
}

// A stub Ollama that is ALWAYS available and ALWAYS says the claim is true.
// This is the adversarial case: a maximally agreeable checker with no source.
function startStubOllama() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', c => { body += c; });
      req.on('end', () => {
        res.setHeader('content-type', 'application/json');
        if (req.url.includes('/api/show')) {
          res.statusCode = 200;
          res.end(JSON.stringify({ model: 'bespoke-minicheck' }));
        } else if (req.url.includes('/api/generate')) {
          res.statusCode = 200;
          res.end(JSON.stringify({ response: 'Yes' }));
        } else {
          res.statusCode = 404;
          res.end('{}');
        }
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function runHook(payload, env) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [HOOK], {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('close', code => resolve({ code, stdout, stderr }));
    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

// Unique session per run: the enforcer short-circuits a session it already
// blocked, which would mask a regression.
const freshSession = () => 'containment-' + crypto.randomBytes(6).toString('hex');

const FACTUAL_OUTPUT = [
  'The Eiffel Tower is 330 metres tall and was completed in 1889.',
  'PostgreSQL 16 shipped logical replication from standby servers.',
  'The Node.js event loop processes microtasks before the next timer phase.'
].join(' ');

async function main() {
  console.log('\nTruth Shield containment tests (Detroit)\n');
  const server = await startStubOllama();
  const port = server.address().port;
  const stubHost = `http://127.0.0.1:${port}`;

  try {
    // ── The core containment assertion ────────────────────────────────
    // A maximally agreeable checker says "Yes" to everything, but no source
    // was ever retrieved. The hook MUST still block.
    const r1 = await runHook({
      hook_event_name: 'Stop',
      session_id: freshSession(),
      output: FACTUAL_OUTPUT
    }, { OLLAMA_HOST: stubHost });

    let decision = null;
    try { decision = JSON.parse(r1.stdout || '{}'); } catch { /* not JSON */ }

    check(
      'sourceless "Yes" from checker does NOT grant verified - hook blocks',
      decision && decision.decision === 'block',
      `stdout was: ${JSON.stringify(r1.stdout).slice(0, 200)}`
    );

    check(
      'block reason names the missing source, not just "no verification"',
      decision && typeof decision.reason === 'string' &&
        /no (reference )?source|unverifiable|not retriev/i.test(decision.reason),
      `reason was: ${decision && decision.reason ? decision.reason.slice(0, 160) : '(none)'}`
    );

    // ── The enforcer must not claim verification it did not perform ───
    check(
      'source no longer tells the checker to use its training knowledge',
      !require('fs').readFileSync(HOOK, 'utf8').includes('Use your training knowledge'),
      'the sourceless prompt string is still present in the enforcer'
    );

    // ── Non-regression: genuinely non-factual output still passes ─────
    const r2 = await runHook({
      hook_event_name: 'Stop',
      session_id: freshSession(),
      output: 'OK, I will do that.'
    }, { OLLAMA_HOST: stubHost });
    check(
      'non-factual output still passes through (no false positives)',
      (r2.stdout || '').trim() === '',
      `stdout was: ${JSON.stringify(r2.stdout).slice(0, 200)}`
    );

    // ── Non-regression: non-Stop events are ignored ───────────────────
    const r3 = await runHook({
      hook_event_name: 'PreToolUse',
      session_id: freshSession(),
      output: FACTUAL_OUTPUT
    }, { OLLAMA_HOST: stubHost });
    check(
      'non-Stop events ignored',
      (r3.stdout || '').trim() === '',
      `stdout was: ${JSON.stringify(r3.stdout).slice(0, 200)}`
    );

    // ── Hook must never crash Claude ──────────────────────────────────
    check('hook exits 0 on the blocking path', r1.code === 0, `exit=${r1.code}`);
    check('hook exits 0 on the passthrough path', r2.code === 0, `exit=${r2.code}`);

  } finally {
    server.close();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) { console.log(`FAILING: ${failures.join('; ')}`); process.exit(1); }
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
