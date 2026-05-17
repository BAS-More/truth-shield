# Enhancing Truth Shield

Truth Shield works out of the box with zero configuration — it uses Grep, Read, and Glob (built into Claude Code) to verify code claims, and WebSearch for general knowledge.

But it gets dramatically better with optional MCP servers. Each one unlocks a new verification tier.

---

## Quick reference

Tier numbers match the SKILL.md pipeline — the same numbers you see in verification reports.

| Tier | MCP Server | What it adds | Install effort |
|------|------------|-------------|----------------|
| 0 | **fact-mcp** | Cached verifications — instant lookups for repeat claims | 5 minutes |
| 1 | **Total Recall** | Persistent memory — corrections survive across sessions | 5 minutes |
| 2 | **Knowledge Graph** | Code structure — call chains, dependencies, symbol maps | 10 minutes |
| 4 | **Context7** | Live library/API docs (React, Express, Prisma, 9,000+ libs) | 1 minute |
| 5 | **Graphiti** | Entity relationships, temporal facts | 10 minutes |
| 7 | **Local LLM proxy** | Multi-model cross-check (GPT-4o, Gemini, Llama, etc.) | Varies |
| 8 | **LLM Council skill** | Conflict resolution when sources disagree | 5 minutes |

Tier 3 (Grep/Read/Glob) and Tier 6 (WebSearch) are built into Claude Code — no install needed.

---

## Tier 4: Context7 (recommended first add)

Gives Truth Shield access to live, up-to-date documentation for 9,000+ libraries. When Claude claims "useEffect runs before render," Context7 checks the actual React docs — not Claude's training data from months ago.

### Install

Add to your Claude Code MCP config (`.mcp.json` in your project root or `~/.claude/mcp.json` globally):

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

## Tier 1: Total Recall

Gives Truth Shield persistent memory across sessions. Every correction is stored permanently. If Claude lied about something last week and was corrected, Total Recall catches it instantly this week.

This is what enables the **learning loop** — the feature where Truth Shield gets smarter over time.

### Install

See: [Total Recall MCP](https://github.com/pchaganti/gx-total-recall) for full documentation.

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

## Tier 0: fact-mcp

A tiered caching layer. Previously verified claims get instant lookups instead of re-running the entire verification pipeline. Makes Shield On mode significantly faster.

### Install

See: [fact-mcp](https://github.com/pchaganti/gx-fact-mcp) for full documentation.

Add to your MCP config:

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

Structural code analysis — not text search, but actual call graphs, dependency trees, and symbol relationships. When Claude says "function A calls function B," the Knowledge Graph has a definitive answer.

### Install

See: [Knowledge Graph MCP](https://github.com/nicholasgriffintn/knowledge-graph-mcp) for full documentation.

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

## Tier 7: Multi-model cross-check (advanced)

Cross-checks claims against a completely different model family. This catches training-data-wide blind spots — errors that every Claude model repeats because they're in the training data.

### Requirements

1. A local LLM proxy running on a known port (e.g., [LiteLLM](https://github.com/BerriAI/litellm), [OpenRouter](https://openrouter.ai/), or any OpenAI-compatible proxy)
2. Access to at least one non-Anthropic model (GPT-4o, Gemini, Llama, etc.)
3. The `WebFetch` tool available in your Claude Code session

### Configuration

The SKILL.md defaults to `http://localhost:20128` with `Bearer 9router` auth. If your proxy runs on a different port or uses different auth, edit the Tier 7 section in your installed skill file (`~/.claude/skills/truth-shield.md`):

```
url: "http://localhost:YOUR_PORT/v1/chat/completions"
headers: {"Authorization": "Bearer YOUR_TOKEN"}
```

If no proxy is running, Tier 7 silently skips (connection refused is handled gracefully).

---

## Tier 8: LLM Council (conflict resolution)

When verification sources disagree — e.g., Context7 says VERIFIED but WebSearch says CONTRADICTED — the LLM Council convenes multiple models to arbitrate. It does NOT fire on every claim, only on genuine conflicts.

### Install

The LLM Council is a separate Claude Code skill. Install it from [claude-skills-llm-council](https://github.com/aiwithremy/claude-skills-llm-council):

```bash
# Mac / Linux
cp SKILL.md ~/.claude/skills/llm-council.md

# Windows
Copy-Item SKILL.md "$env:USERPROFILE\.claude\skills\llm-council.md"
```

If the LLM Council skill is not installed, Truth Shield presents both conflicting positions to you directly instead. You resolve the conflict manually.

---

## Always-on mode

To make Truth Shield verify every response automatically (no need to type "shield on" each session), add this line to your project's `CLAUDE.md` or your global `~/.claude/CLAUDE.md`:

```
Always verify factual claims before presenting them using the truth-shield skill.
```

This makes verification the default behavior for every session.
