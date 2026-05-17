# Enhancing Truth Shield v3

Truth Shield works out of the box with zero configuration — it uses Grep, Read, and Glob (built into Claude Code) to verify code claims, and WebSearch for general knowledge.

But it gets dramatically better with optional MCP servers, models, and hooks. Each one unlocks a new verification tier.

---

## Quick reference

Tier numbers match the SKILL.md pipeline — the same numbers you see in verification reports.

| Tier | Source | What it adds | Install effort |
|------|--------|-------------|----------------|
| 0 | **fact-mcp** | Cached verifications — instant repeat lookups | 5 minutes |
| 1 | **Total Recall** | Persistent memory — corrections survive across sessions | 5 minutes |
| 2 | **Knowledge Graph** | Code structure — call chains, dependencies, symbol maps | 10 minutes |
| 3.5 | **DepScope** | Package existence checking across 19 ecosystems | 5 minutes |
| 4 | **Context7** | Live library/API docs (React, Express, Prisma, 9,000+ libs) | 1 minute |
| 5 | **Graphiti** | Entity relationships, temporal facts | 10 minutes |
| 7 | **Local LLM proxy** | Multi-model cross-check + self-consistency sampling | Varies |
| 8 | **MiniCheck** | External fact-checking model (EMNLP 2024) | 5 minutes |
| 9 | **LLM Council skill** | FACTS-style multi-judge conflict resolution | 5 minutes |

Tiers 3 (Grep/Read/Glob) and 6 (WebSearch) are built into Claude Code — no install needed:

| 3 | **Grep/Read/Glob** | Local file verification — code ground truth | Built-in |
| 6 | **WebSearch** | General knowledge — dates, versions, facts | Built-in |

---

## Tier 4: Context7 (recommended first add)

Gives Truth Shield access to live, up-to-date documentation for 9,000+ libraries. When Claude claims "useEffect runs before render," Context7 checks the actual React docs.

### Install

Add to your Claude Code MCP config (`~/.claude/mcp.json` globally or `.mcp.json` in your project root):

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@context7/mcp-server"]
    }
  }
}
```

Restart Claude Code. Truth Shield automatically detects Context7 and uses it for library/API claims.

### What it catches

- Outdated API signatures ("useState takes a callback" — no, it takes an initial value)
- Removed features ("bodyParser is bundled with Express" — removed in Express 4)
- Version-specific behavior ("useId was added in React 16" — it was React 18)

---

## Tier 3.5: DepScope (v3 — package verification)

Checks whether package names actually exist across 19 ecosystems (npm, PyPI, Cargo, Go, Maven, etc.). Prevents slopsquatting — when Claude hallucinates a package name and a user installs malware that squatted that name.

### Install

Add to your MCP config:

```json
{
  "mcpServers": {
    "depscope": {
      "command": "npx",
      "args": ["-y", "@nicholasgriffintn/depscope-mcp"]
    }
  }
}
```

> **Note:** Verify the package name on [npm](https://www.npmjs.com/search?q=depscope-mcp) before installing — the published name may differ from the GitHub repo name.

### What it catches

- Hallucinated package names ("Install `react-query-utils`" — doesn't exist, the real one is `@tanstack/react-query`)
- Typosquatting risks ("Install `lodsah`" — typo of `lodash`, may be malware)
- Ecosystem confusion ("pip install express" — Express is an npm package, not PyPI)

### Research basis

Based on the [DepScope project](https://github.com/nicholasgriffintn/depscope-mcp) which checks package existence, and the [hallucinations dataset](https://github.com/BAS-More/depscope-hallucinations-dataset) documenting how LLMs fabricate package names.

---

## Tier 1: Total Recall

Gives Truth Shield persistent memory across sessions. Every correction is stored permanently. If Claude lied about something last week and was corrected, Total Recall catches it instantly this week.

This is what enables the **learning loop** — the feature where Truth Shield gets smarter over time.

### Install

Total Recall provides persistent memory for Claude Code sessions.

Add to your MCP config (check [npm](https://www.npmjs.com/search?q=total-recall-mcp) for the latest package name):

```json
{
  "mcpServers": {
    "total-recall": {
      "command": "npx",
      "args": ["-y", "total-recall-mcp"]
    }
  }
}
```

### What it enables

- **Correction persistence** — CONTRADICTED claims are stored with triggers, so the same lie is caught instantly in future sessions
- **Fact verification** — previously verified facts are recalled without re-checking sources
- **Cross-session learning** — the system accumulates knowledge over time

---

## Tier 0: fact-mcp

A tiered caching layer. Previously verified claims get instant lookups instead of re-running the entire verification pipeline. Makes Shield On mode significantly faster.

### Install

fact-mcp provides tiered caching for verified claims.

Add to your MCP config (check [npm](https://www.npmjs.com/search?q=fact-mcp) for the latest package name):

```json
{
  "mcpServers": {
    "fact-mcp": {
      "command": "npx",
      "args": ["-y", "fact-mcp"]
    }
  }
}
```

### What it enables

- **Instant cache hits** — "Does useEffect run after render?" was checked 3 minutes ago, no need to hit Context7 again
- **Tiered TTLs** — static facts cached 24h, semi-dynamic 1h, dynamic 5min
- **Faster Shield On mode** — repeat claims skip the pipeline entirely

---

## Tier 5: Graphiti

Adds relationship and entity memory. Useful when Claude makes claims about how things connect — "Service A depends on Service B" or "the auth module was refactored in Sprint 12."

### Install

See: [Graphiti MCP](https://github.com/getzep/graphiti) for full documentation.

Add to your MCP config:

```json
{
  "mcpServers": {
    "graphiti": {
      "command": "npx",
      "args": ["-y", "graphiti-mcp-server"],
      "env": {
        "NEO4J_URI": "bolt://localhost:7687",
        "NEO4J_USER": "neo4j",
        "NEO4J_PASSWORD": "your-password"
      }
    }
  }
}
```

Graphiti requires a Neo4j database. See the [Graphiti docs](https://github.com/getzep/graphiti) for Neo4j setup.

### What it catches

- Wrong relationships ("the payment service calls the auth service directly" — it goes through a gateway)
- Stale facts ("the database is PostgreSQL" — it was migrated to DynamoDB last month)
- Entity confusion ("User model is in models/user.ts" — it was moved to entities/user.ts)

---

## Tier 2: Knowledge Graph

Structural code analysis — not text search, but actual call graphs, dependency trees, and symbol relationships.

### Install

The Knowledge Graph MCP provides structural code analysis. Install a compatible knowledge-graph MCP server for your codebase.

Add to your MCP config:

```json
{
  "mcpServers": {
    "knowledge-graph": {
      "command": "npx",
      "args": ["-y", "knowledge-graph-mcp"]
    }
  }
}
```

### What it catches

- Wrong call chains ("validateToken calls hashPassword" — no, it calls verifyJWT)
- Missing dependencies ("the auth module has no external dependencies" — it imports jsonwebtoken)
- Incorrect inheritance ("UserService extends BaseService" — it extends AuthenticatedService)

---

## Tier 7: Multi-model cross-check + self-consistency (v3)

Cross-checks claims against different model families AND uses self-consistency sampling. v3 queries multiple models and checks agreement — divergence signals hallucination.

### Requirements

1. A local LLM proxy (e.g., [LiteLLM](https://github.com/BerriAI/litellm), [OpenRouter](https://openrouter.ai/), or any OpenAI-compatible proxy)
2. Access to at least one non-Anthropic model (GPT-4o, Gemini, Llama, etc.)
3. The `WebFetch` tool available in your Claude Code session

### Configuration

The SKILL.md defaults to `http://localhost:20128` with `Bearer 9router` auth. If your proxy runs on a different port or uses different auth, edit the Tier 7 section in your installed skill file (`~/.claude/skills/truth-shield.md`):

```
url: "http://localhost:YOUR_PORT/v1/chat/completions"
headers: {"Authorization": "Bearer YOUR_TOKEN"}
```

If no proxy is running, Tier 7 silently skips (connection refused is handled gracefully).

### v3 upgrade: Self-consistency sampling

v3 queries 3 models instead of 1. If all 3 agree, confidence is high. If they diverge, the claim is flagged as CONFLICTED. This is based on semantic entropy research ([Nature 2024](https://www.nature.com/articles/s41586-024-07421-0)) — divergent outputs from the same prompt indicate hallucination.

---

## Tier 8: MiniCheck external fact-checker (v3)

A purpose-built fact-verification model from EMNLP 2024. Unlike general LLMs, MiniCheck was specifically trained to judge whether a claim is supported by a document. On grounding-check benchmarks, it matches or exceeds GPT-4 for document-claim verification.

### Install

MiniCheck runs via [Ollama](https://ollama.ai/):

```bash
# Install Ollama (if not already installed)
# See https://ollama.ai/ for your platform

# Pull the MiniCheck model
ollama pull bespoke-minicheck
```

Ollama runs at `http://localhost:11434` by default. No MCP config needed — Truth Shield calls it directly via WebFetch.

### What it enables

- **Second opinion on verdicts** — if Context7 says VERIFIED, MiniCheck independently confirms against the evidence
- **Catches confirmation bias** — MiniCheck reads evidence without knowing what Claude claimed, breaking the bias loop
- **High precision** — trained on fact-checking benchmarks, not general text generation

### Research basis

Based on [MiniCheck](https://github.com/Liyan06/MiniCheck) (EMNLP 2024). See also [UQLM](https://github.com/cvs-health/uqlm) for uncertainty quantification and the [research forks](https://github.com/BAS-More) for additional hallucination detection patterns.

---

## Tier 9: Multi-Judge Council (v3, replaces old Tier 8)

When verification sources disagree, the Multi-Judge Council convenes multiple models to arbitrate using the FACTS framework (DeepMind 2024). Uses a 3-judge panel with independent scoring and majority vote — no single model's bias dominates.

### Install

The LLM Council is a separate Claude Code skill. Clone it from [claude-skills-llm-council](https://github.com/aiwithremy/claude-skills-llm-council) and install:

```bash
# Mac / Linux
git clone https://github.com/aiwithremy/claude-skills-llm-council.git
cp claude-skills-llm-council/SKILL.md ~/.claude/skills/llm-council.md

# Windows
git clone https://github.com/aiwithremy/claude-skills-llm-council.git
Copy-Item claude-skills-llm-council\SKILL.md "$env:USERPROFILE\.claude\skills\llm-council.md"
```

If the LLM Council skill is not installed, Truth Shield falls back to multi-model arbitration via the proxy (Tier 7), or presents both positions to you directly.

---

## Stop Hook enforcement (v3)

The enforcement hook is a Claude Code hook that runs OUTSIDE Claude's context window. Even if Claude "forgets" to verify in shield-on mode, the hook catches it.

### Install

1. Copy the hook file:

```bash
# Mac / Linux
mkdir -p ~/.claude/hooks
cp hooks/truth-shield-enforcer.js ~/.claude/hooks/

# Windows (PowerShell)
New-Item -ItemType Directory -Path "$env:USERPROFILE\.claude\hooks" -Force | Out-Null
Copy-Item hooks\truth-shield-enforcer.js "$env:USERPROFILE\.claude\hooks\"
```

2. Add to your `~/.claude/settings.json` under the `hooks.Stop` array (or create one):

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$HOME/.claude/hooks/truth-shield-enforcer.js\"",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

If you already have Stop hooks, add the truth-shield entry to the existing `hooks` array.

### What it does

- **Reads stdin** — async, with 2s timeout (matches Claude Code hook protocol)
- **Detects shield state** — scans `messages` array (preferred) or transcript JSONL for "shield on"/"shield off"
- **Classifies responses** — skips pure code, short answers, questions, and already-verified output
- **Checks verification** — looks for truth-shield tool calls and verification markers after last user message
- **Blocks unverified responses** — uses `decision: "block"` JSON output with reason (the proper Stop hook API)
- **Anti-loop protection** — tracks enforcement per session via lockfile; after one block, subsequent stops pass through
- **Subagent-safe** — skips enforcement inside subagents (they're tool executions, not user-facing)
- **Crash-proof** — all errors caught and logged to `~/.claude/_logs/truth-shield-errors.log`; never crashes Claude
- **Deterministic** — cannot be overridden by prompt content

---

## Always-on mode

To make Truth Shield verify every response automatically (no need to type "shield on" each session), add this line to your project's `CLAUDE.md` or your global `~/.claude/CLAUDE.md`:

```
Always verify factual claims before presenting them using the truth-shield skill.
```

This makes verification the default behavior for every session.
