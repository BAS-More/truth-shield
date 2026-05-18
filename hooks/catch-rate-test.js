#!/usr/bin/env node
// Truth Shield Enforcer — Catch Rate Test
//
// Feeds the hook realistic scenarios via stdin and measures:
//   - True Positives:  correctly blocks unverified factual claims
//   - True Negatives:  correctly allows non-factual or verified responses
//   - False Positives: incorrectly blocks (annoyance)
//   - False Negatives: incorrectly allows unverified factual claims
//
// Run: node hooks/catch-rate-test.js

'use strict';

const { execFile } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const HOOK_PATH = path.join(__dirname, 'truth-shield-enforcer.js');

// Clean lock file before testing (anti-loop would interfere)
const LOCK_FILE = path.join(os.tmpdir(), '.truth-shield-lock.json');
function clearLock() {
  try { fs.unlinkSync(LOCK_FILE); } catch {}
}

// ─── Test scenarios ───────────────────────────────────────────────────
// Each scenario: { name, shouldBlock, input }
// shouldBlock = true means hook SHOULD output a block decision
// shouldBlock = false means hook should exit silently (allow)

const scenarios = [

  // ═══════════════════════════════════════════════════════════════
  // TRUE POSITIVES — unverified factual claims that SHOULD be blocked
  // ═══════════════════════════════════════════════════════════════

  {
    name: 'TP-01: Wrong API fact (Express port)',
    shouldBlock: true,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tp01',
      output: 'Express.js defaults to port 3000. The app.listen() method was added in Express 3.0 and accepts a callback as its second argument. Express 3.0 also removed bundled middleware like bodyParser.',
      messages: [
        { role: 'user', content: 'Tell me about Express.js' },
        { role: 'assistant', content: 'Express.js defaults to port 3000. The app.listen() method was added in Express 3.0.' }
      ]
    }
  },

  {
    name: 'TP-02: Wrong React version claim',
    shouldBlock: true,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tp02',
      output: 'React hooks were introduced in React 16.0 and completely replaced class components. The useEffect hook runs before the first render, making it ideal for data fetching.',
      messages: [
        { role: 'user', content: 'When were React hooks introduced?' },
        { role: 'assistant', content: 'React hooks were introduced in React 16.0 and completely replaced class components.' }
      ]
    }
  },

  {
    name: 'TP-03: Hallucinated package name',
    shouldBlock: true,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tp03',
      output: 'You should install react-query-utils for managing server state. It provides automatic caching and background refetching of data.',
      messages: [
        { role: 'user', content: 'What package should I use for server state in React?' },
        { role: 'assistant', content: 'You should install react-query-utils for managing server state.' }
      ]
    }
  },

  {
    name: 'TP-04: Wrong historical fact',
    shouldBlock: true,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tp04',
      output: 'TypeScript was created by Google in 2010 as a typed superset of JavaScript. It was originally designed for the Angular framework and later adopted by other projects.',
      messages: [
        { role: 'user', content: 'Who created TypeScript?' },
        { role: 'assistant', content: 'TypeScript was created by Google in 2010 as a typed superset of JavaScript.' }
      ]
    }
  },

  {
    name: 'TP-05: Wrong function behavior',
    shouldBlock: true,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tp05',
      output: 'The Array.prototype.map() method modifies the original array in place and returns undefined. It was added in ES5 and is supported by all modern browsers.',
      messages: [
        { role: 'user', content: 'How does Array.map work?' },
        { role: 'assistant', content: 'The Array.prototype.map() method modifies the original array in place and returns undefined.' }
      ]
    }
  },

  {
    name: 'TP-06: Mixed correct/incorrect claims',
    shouldBlock: true,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tp06',
      output: 'Node.js uses the V8 JavaScript engine, originally developed for Google Chrome. Node.js was created by Ryan Dahl in 2009. It uses a multi-threaded architecture with one thread per request for maximum performance.',
      messages: [
        { role: 'user', content: 'Tell me about Node.js architecture' },
        { role: 'assistant', content: 'Node.js uses the V8 JavaScript engine. It uses a multi-threaded architecture.' }
      ]
    }
  },

  {
    name: 'TP-07: Outdated version info',
    shouldBlock: true,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tp07',
      output: 'The latest version of Python is 3.9, released in October 2020. Python 4.0 is expected to be released in 2023 with major breaking changes.',
      messages: [
        { role: 'user', content: 'What is the latest Python version?' },
        { role: 'assistant', content: 'The latest version of Python is 3.9, released in October 2020.' }
      ]
    }
  },

  {
    name: 'TP-08: Wrong CSS claim',
    shouldBlock: true,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tp08',
      output: 'CSS Grid was first supported in Chrome 29 back in 2013. Flexbox was introduced later in 2016 as a simpler alternative for one-dimensional layouts.',
      messages: [
        { role: 'user', content: 'When was CSS Grid introduced?' },
        { role: 'assistant', content: 'CSS Grid was first supported in Chrome 29 back in 2013.' }
      ]
    }
  },

  {
    name: 'TP-09: Wrong database claim',
    shouldBlock: true,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tp09',
      output: 'PostgreSQL uses MVCC (Multi-Version Concurrency Control) for transaction isolation. By default, PostgreSQL uses the SERIALIZABLE isolation level, which prevents all concurrency anomalies but reduces throughput significantly.',
      messages: [
        { role: 'user', content: 'What isolation level does PostgreSQL use by default?' },
        { role: 'assistant', content: 'PostgreSQL uses the SERIALIZABLE isolation level by default.' }
      ]
    }
  },

  {
    name: 'TP-10: Confident but wrong API claim',
    shouldBlock: true,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tp10',
      output: 'The fetch API returns a Promise that resolves to a string containing the response body. You can directly access the JSON data from the response object without calling any additional methods.',
      messages: [
        { role: 'user', content: 'How does the fetch API work?' },
        { role: 'assistant', content: 'The fetch API returns a Promise that resolves to a string containing the response body.' }
      ]
    }
  },

  {
    name: 'TP-11: Subtle architecture claim',
    shouldBlock: true,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tp11',
      output: 'Docker containers share the host kernel but each container runs its own complete operating system. This is what makes containers heavier than virtual machines but more secure due to full OS isolation.',
      messages: [
        { role: 'user', content: 'How do Docker containers work?' },
        { role: 'assistant', content: 'Docker containers share the host kernel but each container runs its own complete operating system.' }
      ]
    }
  },

  {
    name: 'TP-12: Wrong git claim',
    shouldBlock: true,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tp12',
      output: 'Git rebase replays commits from the current branch onto the target branch. Unlike merge, rebase permanently deletes the original commits and creates new ones with different hashes and different content.',
      messages: [
        { role: 'user', content: 'How does git rebase work?' },
        { role: 'assistant', content: 'Git rebase permanently deletes the original commits.' }
      ]
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // TRUE NEGATIVES — should NOT be blocked
  // ═══════════════════════════════════════════════════════════════

  {
    name: 'TN-01: Short confirmation',
    shouldBlock: false,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tn01',
      output: 'Done!',
      messages: [
        { role: 'user', content: 'Fix the typo' },
        { role: 'assistant', content: 'Done!' }
      ]
    }
  },

  {
    name: 'TN-02: Pure code block',
    shouldBlock: false,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tn02',
      output: '```js\nconst express = require("express");\nconst app = express();\napp.listen(3000);\n```\n\n```bash\nnpm start\n```\nDone.',
      messages: [
        { role: 'user', content: 'Write an Express server' },
        { role: 'assistant', content: '```js\nconst express = require("express");\n```' }
      ]
    }
  },

  {
    name: 'TN-03: Questions back to user',
    shouldBlock: false,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tn03',
      output: 'What framework are you using? Which version of Node.js do you have installed? Do you have a package.json already?',
      messages: [
        { role: 'user', content: 'Help me set up my project' },
        { role: 'assistant', content: 'What framework are you using?' }
      ]
    }
  },

  {
    name: 'TN-04: Already verified response',
    shouldBlock: false,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tn04',
      output: 'Express defaults to port 3000. [shield: 1/1 verified | v3]',
      messages: [
        { role: 'user', content: 'What port does Express use?' },
        { role: 'assistant', content: 'Express defaults to port 3000. [shield: 1/1 verified | v3]' }
      ]
    }
  },

  {
    name: 'TN-05: Verification was done (WebSearch)',
    shouldBlock: false,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tn05',
      output: 'TypeScript was created by Microsoft. Anders Hejlsberg led the development team. The first public version was released in October 2012.',
      messages: [
        { role: 'user', content: 'Who created TypeScript?' },
        { role: 'assistant', content: 'Let me check... [WebSearch: "TypeScript creator"]' },
        { role: 'assistant', content: 'TypeScript was created by Microsoft.' }
      ]
    }
  },

  {
    name: 'TN-06: Verification was done (Truth Shield Report)',
    shouldBlock: false,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tn06',
      output: 'React uses a virtual DOM. This was introduced in React 0.4.',
      messages: [
        { role: 'user', content: 'verify this' },
        { role: 'assistant', content: 'Truth Shield Report\nClaims checked: 2\n[VERIFIED] React uses virtual DOM\n[VERIFIED] Introduced in React 0.4' }
      ]
    }
  },

  {
    name: 'TN-07: Action confirmation (short)',
    shouldBlock: false,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tn07',
      output: 'Created the new component file at src/components/Button.tsx.',
      messages: [
        { role: 'user', content: 'Create a Button component' },
        { role: 'assistant', content: 'Created the new component file at src/components/Button.tsx.' }
      ]
    }
  },

  {
    name: 'TN-08: Subagent execution',
    shouldBlock: false,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tn08',
      agent_id: 'subagent-123',
      output: 'PostgreSQL uses READ COMMITTED by default. This is a factual claim that would normally be blocked.',
      messages: [
        { role: 'user', content: 'Check the database' },
        { role: 'assistant', content: 'PostgreSQL uses READ COMMITTED by default.' }
      ]
    }
  },

  {
    name: 'TN-09: Error message output',
    shouldBlock: false,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tn09',
      output: 'Error: Cannot find module "react-query-utils" in the current project dependencies. Please check the package name.',
      messages: [
        { role: 'user', content: 'Install the package' },
        { role: 'assistant', content: 'Error: Cannot find module "react-query-utils"' }
      ]
    }
  },

  {
    name: 'TN-10: Git status output',
    shouldBlock: false,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tn10',
      output: 'On branch main\nYour branch is up to date with origin/main.\n\nChanges not staged for commit:\n  modified: README.md\n  modified: src/index.ts',
      messages: [
        { role: 'user', content: 'What is the git status?' },
        { role: 'assistant', content: 'On branch main\nYour branch is up to date.' }
      ]
    }
  },

  {
    name: 'TN-11: Non-Stop hook event',
    shouldBlock: false,
    input: {
      hook_event_name: 'PreToolUse',
      session_id: 'test-tn11',
      output: 'PostgreSQL uses READ COMMITTED by default.',
      messages: []
    }
  },

  {
    name: 'TN-12: Hedged response',
    shouldBlock: false,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tn12',
      output: 'I think React hooks might have been introduced around version 16.8, but I am not sure about the exact version. Perhaps you should check the official documentation.',
      messages: [
        { role: 'user', content: 'When were hooks added?' },
        { role: 'assistant', content: 'I think React hooks might have been introduced around version 16.8.' }
      ]
    }
  },

  {
    name: 'TN-13: Verification via context7',
    shouldBlock: false,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tn13',
      output: 'According to the Express.js documentation, the default port is 3000 when using app.listen().',
      messages: [
        { role: 'user', content: 'What port does Express use?' },
        { role: 'assistant', content: 'Let me check context7 for the Express docs...' },
        { role: 'assistant', content: 'According to the Express.js documentation, the default port is 3000.' }
      ]
    }
  },

  {
    name: 'TN-14: Meta-statement only',
    shouldBlock: false,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tn14',
      output: "I'll create the configuration file for you now. Let me check the existing setup first and then update the dependencies.",
      messages: [
        { role: 'user', content: 'Set up the config' },
        { role: 'assistant', content: "I'll create the configuration file for you now." }
      ]
    }
  },

  {
    name: 'TN-15: Empty/malformed stdin',
    shouldBlock: false,
    input: null  // will send empty string
  },

  {
    name: 'TN-16: Fixed/Updated confirmation with details',
    shouldBlock: false,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tn16',
      output: 'Fixed the import statement and updated the test file to match the new API.',
      messages: [
        { role: 'user', content: 'Fix the failing test' },
        { role: 'assistant', content: 'Fixed the import statement.' }
      ]
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // EDGE CASES — tricky scenarios
  // ═══════════════════════════════════════════════════════════════

  {
    name: 'EDGE-01: Long action confirmation WITH factual claims',
    shouldBlock: true,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-edge01',
      output: 'Updated the configuration. By the way, PostgreSQL supports up to 1600 columns per table, and the maximum row size is 1.6 TB. These limits were established in PostgreSQL 8.0 and have remained unchanged since then.',
      messages: [
        { role: 'user', content: 'Update the DB config' },
        { role: 'assistant', content: 'Updated the configuration. PostgreSQL supports up to 1600 columns.' }
      ]
    }
  },

  {
    name: 'EDGE-02: Factual claims disguised as casual',
    shouldBlock: true,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-edge02',
      output: 'Sure thing! The webpack config looks fine. Webpack 5 dropped support for Node.js polyfills entirely, which is why the crypto module is not available in the browser bundle anymore. You need to install the polyfill manually.',
      messages: [
        { role: 'user', content: 'Why is crypto not working in my webpack build?' },
        { role: 'assistant', content: 'Webpack 5 dropped support for Node.js polyfills entirely.' }
      ]
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // ADVERSARIAL: Bullet-point blind spots
  // ═══════════════════════════════════════════════════════════════

  {
    name: 'TP-13: Bullet list of factual claims',
    shouldBlock: true,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tp13',
      output: 'Key differences between React and Vue:\n- React was created by Facebook and released in 2013\n- Vue was created by Evan You and released in 2014\n- React uses JSX while Vue uses HTML-based templates\n- React has a larger community with over 200k GitHub stars',
      messages: [
        { role: 'user', content: 'Compare React and Vue' },
        { role: 'assistant', content: 'Key differences between React and Vue...' }
      ]
    }
  },

  {
    name: 'TN-17: Bullet list of action items (no facts)',
    shouldBlock: false,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tn17',
      output: 'Here is what I recommend:\n- Fix the failing import in utils.ts\n- Update the test file to match the new API\n- Run the test suite to verify\n- Deploy to staging first',
      messages: [
        { role: 'user', content: 'What should I do next?' },
        { role: 'assistant', content: 'Here is what I recommend...' }
      ]
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // ADVERSARIAL: Meta-statement with factual payload
  // ═══════════════════════════════════════════════════════════════

  {
    name: 'TP-14: "Here\'s" with factual claim after colon',
    shouldBlock: true,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tp14',
      output: "Here's how it works: Express listens on port 3000 by default and uses the Connect middleware framework internally. The routing engine was completely rewritten in Express 4.0 to use a radix tree algorithm for faster route matching.",
      messages: [
        { role: 'user', content: 'How does Express routing work?' },
        { role: 'assistant', content: "Here's how it works: Express listens on port 3000 by default." }
      ]
    }
  },

  {
    name: 'TP-15: "I\'ll note that" with factual claim',
    shouldBlock: true,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tp15',
      output: "I'll note that React 18 introduced concurrent rendering as a default feature. The Suspense component was completely rewritten to support this, and the old synchronous rendering mode was deprecated in favor of createRoot.",
      messages: [
        { role: 'user', content: 'What changed in React 18?' },
        { role: 'assistant', content: "I'll note that React 18 introduced concurrent rendering." }
      ]
    }
  },

  {
    name: 'TN-18: Pure meta-statement "I\'ll set up the project"',
    shouldBlock: false,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tn18',
      output: "I'll set up the project structure for you now. Let me create the directory layout and initialize the package.",
      messages: [
        { role: 'user', content: 'Set up the project' },
        { role: 'assistant', content: "I'll set up the project structure." }
      ]
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // ADVERSARIAL: Numbered lists
  // ═══════════════════════════════════════════════════════════════

  {
    name: 'TP-16: Numbered list of factual claims',
    shouldBlock: true,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tp16',
      output: 'The evolution of JavaScript modules:\n1. CommonJS was introduced in 2009 and became the standard for Node.js\n2. AMD (Asynchronous Module Definition) was created by James Burke in 2011\n3. ES Modules were standardized in ECMAScript 2015 (ES6)\n4. Node.js added native ESM support in version 12.0.0',
      messages: [
        { role: 'user', content: 'How did JS modules evolve?' },
        { role: 'assistant', content: 'The evolution of JavaScript modules...' }
      ]
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // ADVERSARIAL: Subtle false negatives
  // ═══════════════════════════════════════════════════════════════

  {
    name: 'TP-17: Parenthetical facts embedded in narrative',
    shouldBlock: true,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tp17',
      output: 'TypeScript (originally released in 2012 by Microsoft) compiles to plain JavaScript. The compiler was written by Anders Hejlsberg, who also created C# and Delphi. TypeScript 5.0 introduced decorators as a stable feature and removed the need for the experimentalDecorators flag.',
      messages: [
        { role: 'user', content: 'Tell me about TypeScript' },
        { role: 'assistant', content: 'TypeScript was released in 2012 by Microsoft.' }
      ]
    }
  },

  {
    name: 'TP-18: Factual claims with confident tone',
    shouldBlock: true,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tp18',
      output: 'Absolutely! The Node.js event loop has exactly 6 phases: timers, pending callbacks, idle/prepare, poll, check, and close callbacks. Each phase has a FIFO queue of callbacks to execute. The event loop was redesigned in Node.js 10 to use libuv 1.20 which added significant performance improvements.',
      messages: [
        { role: 'user', content: 'How does the Node event loop work?' },
        { role: 'assistant', content: 'The Node.js event loop has exactly 6 phases.' }
      ]
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // ADVERSARIAL: True negatives that look like facts
  // ═══════════════════════════════════════════════════════════════

  {
    name: 'TN-19: Hedged with numbers (looks factual but uncertain)',
    shouldBlock: false,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tn19',
      output: 'I believe the default timeout might be around 30 seconds, but I am not sure about the exact value. You could check the documentation to confirm this setting.',
      messages: [
        { role: 'user', content: 'What is the default timeout?' },
        { role: 'assistant', content: 'I believe the default timeout might be around 30 seconds.' }
      ]
    }
  },

  {
    name: 'TN-20: Multiple questions with some factual framing',
    shouldBlock: false,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tn20',
      output: 'A few things to clarify before I proceed:\n- Are you using the latest version of the library?\n- Which database backend are you targeting?\n- Do you need support for transactions?\n- Should I include migration scripts?',
      messages: [
        { role: 'user', content: 'Set up the ORM' },
        { role: 'assistant', content: 'A few things to clarify...' }
      ]
    }
  },

  {
    name: 'TN-21: Code explanation with inline code only',
    shouldBlock: false,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tn21',
      output: '```javascript\nconst express = require("express");\nconst app = express();\n\napp.get("/", (req, res) => {\n  res.send("Hello World");\n});\n\napp.listen(3000, () => {\n  console.log("Server running");\n});\n```\n\nThis creates a basic server.',
      messages: [
        { role: 'user', content: 'Show me a basic Express server' },
        { role: 'assistant', content: 'Here is a basic Express server...' }
      ]
    }
  },

  {
    name: 'TN-22: Listing file changes (action report)',
    shouldBlock: false,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tn22',
      output: 'Updated the following files:\n- Added error handling to `src/api/handler.ts`\n- Fixed the type annotation in `src/models/user.ts`\n- Removed unused imports from `src/utils/helpers.ts`',
      messages: [
        { role: 'user', content: 'Fix the type errors' },
        { role: 'assistant', content: 'Updated the following files...' }
      ]
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // ADVERSARIAL: Edge cases for robustness
  // ═══════════════════════════════════════════════════════════════

  {
    name: 'EDGE-03: Facts wrapped in "I\'ve confirmed that"',
    shouldBlock: true,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-edge03',
      output: "I've confirmed that PostgreSQL 15 introduced the MERGE command, which combines INSERT, UPDATE, and DELETE operations into a single statement. This is similar to the SQL:2003 standard MERGE and was one of the most requested features.",
      messages: [
        { role: 'user', content: 'What is new in PostgreSQL 15?' },
        { role: 'assistant', content: "I've confirmed that PostgreSQL 15 introduced MERGE." }
      ]
    }
  },

  {
    name: 'EDGE-04: Mixed bullets — some action, some facts',
    shouldBlock: true,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-edge04',
      output: 'To resolve the issue:\n- Update your Node.js version to at least 18.0\n- The current LTS version is 20.11.0, released in January 2024\n- Remove the deprecated `fs.exists` calls which were removed in Node 16\n- Install the `node-fetch` polyfill since native fetch was added in Node 18',
      messages: [
        { role: 'user', content: 'Fix the Node compatibility issue' },
        { role: 'assistant', content: 'To resolve the issue...' }
      ]
    }
  },

  {
    name: 'EDGE-05: Very long response with claims buried deep',
    shouldBlock: true,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-edge05',
      output: 'Let me walk through this step by step.\n\nFirst, looking at your configuration, everything seems correct.\n\nHowever, there is an important consideration. The V8 engine uses a generational garbage collector with a default heap size limit of 1.7 GB on 64-bit systems. This limit was increased from 1.5 GB in Node.js 14. When your application exceeds this limit, V8 will throw an out-of-memory error rather than trying to reclaim memory aggressively.',
      messages: [
        { role: 'user', content: 'Why am I getting OOM errors?' },
        { role: 'assistant', content: 'Let me walk through this step by step.' }
      ]
    }
  },

  {
    name: 'TN-23: Response that is entirely a plan/roadmap',
    shouldBlock: false,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tn23',
      output: "Here is my plan:\n1. Create the database schema\n2. Set up the API routes\n3. Add authentication middleware\n4. Write integration tests\n5. Deploy to the staging environment\n\nI'll start with step 1 now.",
      messages: [
        { role: 'user', content: 'Build the backend' },
        { role: 'assistant', content: 'Here is my plan...' }
      ]
    }
  },

  {
    name: 'TN-24: Debug output analysis (no factual claims)',
    shouldBlock: false,
    input: {
      hook_event_name: 'Stop',
      session_id: 'test-tn24',
      output: 'Looking at the error trace, the issue is in the `handleRequest` function on line 42. The `req.body` is undefined because the JSON middleware is not registered before this route. Moving the `app.use(express.json())` call above the route definition should fix it.',
      messages: [
        { role: 'user', content: 'Why is req.body undefined?' },
        { role: 'assistant', content: 'The issue is in the handleRequest function.' }
      ]
    }
  },
];


// ─── Test runner ──────────────────────────────────────────────────────

function runHook(inputData) {
  return new Promise((resolve) => {
    const child = execFile('node', [HOOK_PATH], {
      timeout: 15000,
      env: { ...process.env, OLLAMA_HOST: 'http://localhost:11434' }
    }, (err, stdout, stderr) => {
      resolve({
        exitCode: err ? err.code || 1 : 0,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });

    const payload = inputData === null ? '' : JSON.stringify(inputData);
    child.stdin.write(payload);
    child.stdin.end();
  });
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  Truth Shield Enforcer — Catch Rate Test                ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  let tp = 0, tn = 0, fp = 0, fn = 0;
  const failures = [];

  for (const scenario of scenarios) {
    // Clear lock between tests (anti-loop would block second test with same session)
    clearLock();

    const result = await runHook(scenario.input);
    const blocked = result.stdout.includes('"decision":"block"') ||
                    result.stdout.includes('"decision": "block"');

    let status;
    if (scenario.shouldBlock && blocked) {
      tp++;
      status = '✓ TP';
    } else if (!scenario.shouldBlock && !blocked) {
      tn++;
      status = '✓ TN';
    } else if (!scenario.shouldBlock && blocked) {
      fp++;
      status = '✗ FP';
      failures.push({ ...scenario, got: 'blocked', expected: 'allowed' });
    } else {
      fn++;
      status = '✗ FN';
      failures.push({ ...scenario, got: 'allowed', expected: 'blocked' });
    }

    const tag = status.startsWith('✓') ? status : `\x1b[31m${status}\x1b[0m`;
    console.log(`  ${tag}  ${scenario.name}`);
  }

  // ─── Results ────────────────────────────────────────────────────

  const total = tp + tn + fp + fn;
  const accuracy = ((tp + tn) / total * 100).toFixed(1);
  const precision = tp + fp > 0 ? (tp / (tp + fp) * 100).toFixed(1) : 'N/A';
  const recall = tp + fn > 0 ? (tp / (tp + fn) * 100).toFixed(1) : 'N/A';
  const f1 = precision !== 'N/A' && recall !== 'N/A'
    ? (2 * (parseFloat(precision) * parseFloat(recall)) / (parseFloat(precision) + parseFloat(recall))).toFixed(1)
    : 'N/A';

  console.log('\n' + '═'.repeat(58));
  console.log('\n  CONFUSION MATRIX');
  console.log('  ┌──────────────────┬────────────┬────────────┐');
  console.log('  │                  │ Should     │ Should     │');
  console.log('  │                  │ Block      │ Allow      │');
  console.log('  ├──────────────────┼────────────┼────────────┤');
  console.log(`  │ Actually Blocked │ TP = ${String(tp).padStart(4)} │ FP = ${String(fp).padStart(4)} │`);
  console.log(`  │ Actually Allowed │ FN = ${String(fn).padStart(4)} │ TN = ${String(tn).padStart(4)} │`);
  console.log('  └──────────────────┴────────────┴────────────┘');

  console.log('\n  METRICS');
  console.log(`  Accuracy:   ${accuracy}%  (${tp + tn}/${total} correct)`);
  console.log(`  Precision:  ${precision}%  (of blocked, how many deserved it)`);
  console.log(`  Recall:     ${recall}%  (of should-block, how many caught)`);
  console.log(`  F1 Score:   ${f1}%`);
  console.log(`  FP Rate:    ${(fp / (fp + tn) * 100).toFixed(1)}%  (annoyance rate)`);
  console.log(`  FN Rate:    ${(fn / (fn + tp) * 100).toFixed(1)}%  (miss rate)`);

  if (failures.length > 0) {
    console.log('\n  FAILURES:');
    for (const f of failures) {
      console.log(`    ${f.name}`);
      console.log(`      Expected: ${f.expected}, Got: ${f.got}`);
    }
  }

  console.log('\n' + '═'.repeat(58) + '\n');
  process.exit(failures.length > 0 ? 1 : 0);
}

main();
