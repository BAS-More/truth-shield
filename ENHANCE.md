# Enhancing Truth Shield

Truth Shield works out of the box with zero configuration — it uses Grep, Read, and Glob (built into Claude Code) to verify code claims, and WebSearch for general knowledge.

But it gets dramatically better with optional MCP servers. Each one unlocks a new verification tier.

---

## Quick reference

| MCP Server | What it adds | Install effort |
|------------|-------------|----------------|
| **Context7** | Live library/API docs (React, Express, Prisma, etc.) | 1 minute |
| **Total Recall** | Persistent memory — corrections survive across sessions | 5 minutes |
| **Graphiti** | Entity relationships, temporal facts | 10 minutes |
| **fact-mcp** | Cached verifications — instant lookups for repeat claims | 5 minutes |
| **Knowledge Graph** | Code structure — call chains, dependencies, symbol maps | 10 minutes |

---

## Tier 1: Context7 (recommended first add)

Gives Truth Shield access to live, up-to-date documentation for 9,000+ libraries. When Claude claims "useEffect runs before render," Context7 checks the actual React docs — not Claude's training data from months ago.

### Install

Add to your Claude Code MCP config (`.mcp.json` in your project root or `~/.claude/.mcp.json` globally):

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

## Tier 2: Total Recall

Gives Truth Shield persistent memory across sessions. Every correction is stored permanently. If Claude lied about something last week and was corrected, Total Recall catches it instantly this week.

This is what enables the **learning loop** — the feature where Truth Shield gets smarter over time.

### Install

See: [Total Recall MCP](https://github.com/pchaganti/gx-total-recall) for setup instructions.

Add to your MCP config:

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

## Tier 3: Graphiti

Adds relationship and entity memory. Useful when Claude makes claims about how things connect — "Service A depends on Service B" or "the auth module was refactored in Sprint 12."

### Install

See: [Graphiti MCP](https://github.com/getzep/graphiti) for setup instructions.

### What it catches

- Wrong relationships ("the payment service calls the auth service directly" — it goes through a gateway)
- Stale facts ("the database is PostgreSQL" — it was migrated to DynamoDB last month)
- Entity confusion ("User model is in models/user.ts" — it was moved to entities/user.ts)

---

## Tier 4: fact-mcp

A tiered caching layer. Previously verified claims get instant lookups instead of re-running the entire verification pipeline. Makes Shield On mode significantly faster.

### Install

See: [fact-mcp](https://github.com/pchaganti/gx-fact-mcp) for setup instructions.

### What it enables

- **Instant cache hits** — "Does useEffect run after render?" was checked 3 minutes ago, no need to hit Context7 again
- **Tiered TTLs** — static facts cached 24h, semi-dynamic 1h, dynamic 5min
- **Faster Shield On mode** — repeat claims skip the pipeline entirely

---

## Tier 5: Knowledge Graph

Structural code analysis — not text search, but actual call graphs, dependency trees, and symbol relationships. When Claude says "function A calls function B," the Knowledge Graph has a definitive answer.

### Install

See: [Knowledge Graph MCP](https://github.com/nicholasgriffintn/knowledge-graph-mcp) for setup instructions.

### What it catches

- Wrong call chains ("validateToken calls hashPassword" — no, it calls verifyJWT)
- Missing dependencies ("the auth module has no external dependencies" — it imports jsonwebtoken)
- Incorrect inheritance ("UserService extends BaseService" — it extends AuthenticatedService)

---

## Multi-model cross-check (advanced)

If you run a local LLM proxy (like LiteLLM, OpenRouter, or 9Router), Truth Shield can cross-check claims against a completely different model family. This catches training-data-wide blind spots — errors that every Claude model repeats because they're in the training data.

This requires:
1. A local proxy running on a known port
2. Access to at least one non-Anthropic model (GPT-4o, Gemini, Llama, etc.)
3. The `WebFetch` tool available in your Claude Code session

Configure the proxy URL in the SKILL.md Tier 7 section if your proxy runs on a different port than the default `:20128`.

---

## Always-on mode

To make Truth Shield verify every response automatically (no need to type "shield on" each session), add this line to your project's `CLAUDE.md` or your global `~/.claude/CLAUDE.md`:

```
Always verify factual claims before presenting them using the truth-shield skill.
```

This makes verification the default behavior for every session.
