# Truth Shield

**Stop Claude from lying to you.**

Claude states things confidently that turn out to be wrong. It invents function names, hallucinates API parameters, gets version numbers outdated, and presents guesses as facts. You have no way to tell which parts of a response are reliable and which are fabricated — unless you check every claim yourself.

Truth Shield is a [Claude Code](https://docs.anthropic.com/en/docs/claude-code) skill that does the checking for you. It verifies every factual claim against real sources — your actual code files, live documentation, web search results — and flags anything it can't confirm.

```
You: What port does Express default to?

Claude: Express defaults to port 3000. The app.listen() method
was added in Express 3.0 and accepts a callback as its second argument.

You: verify this

Truth Shield Report
Claims checked: 3 · Verified: 2 · Contradicted: 1

| # | Claim                              | Verdict      | Evidence                              |
|---|------------------------------------|--------------|---------------------------------------|
| 1 | Express defaults to port 3000      | VERIFIED     | Context7: Express getting-started     |
| 2 | app.listen() added in Express 3.0  | CONTRADICTED | Express changelog: existed since 1.x  |
| 3 | Accepts callback as second arg     | VERIFIED     | Context7: app.listen(port, callback)  |

Corrections: app.listen() has existed since Express 1.x.
Express 3.0 removed bundled middleware, not added listen().
```

---

## Install (30 seconds)

### One-liner

**Mac / Linux:**
```bash
curl -sL https://raw.githubusercontent.com/BAS-More/truth-shield/master/install.sh | bash
```

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/BAS-More/truth-shield/master/install.ps1 | iex
```

### Manual install

```bash
# Mac / Linux
mkdir -p ~/.claude/skills
cp SKILL.md ~/.claude/skills/truth-shield.md

# Windows (PowerShell)
New-Item -ItemType Directory -Path "$env:USERPROFILE\.claude\skills" -Force | Out-Null
Copy-Item SKILL.md "$env:USERPROFILE\.claude\skills\truth-shield.md"
```

### Verify it works

Open Claude Code, ask Claude any factual question, then type:

```
verify this
```

You should see a Truth Shield Report with a table of claims, verdicts, and evidence.

---

## How to use it

### Say "verify this" after any response

```
You: How does React's useMemo work?
Claude: [responds with claims about useMemo]
You: verify this
```

Truth Shield extracts every factual claim, checks each one, and gives you a report showing what's real and what's not.

### Turn on continuous mode for high-stakes work

```
shield on
```

Every response is now verified before you see it. Inline markers flag anything wrong:

```
useMemo guarantees the cached value is never stale.
[CONTRADICTED — React docs: "You may rely on useMemo as a performance
optimization, not as a semantic guarantee."]

[shield: 4/5 claims verified, 1 corrected]
```

Turn it off when you're done:

```
shield off
```

### Spot-check a single claim

```
are you sure useEffect runs before render?
```

---

## What gets checked

Out of the box, Truth Shield uses the tools every Claude Code session has:

| Tool | What it verifies |
|------|-----------------|
| **Grep / Read / Glob** | Code claims — function names, file paths, line numbers, signatures |
| **WebSearch** | General knowledge — dates, versions, people, facts |

That covers the two most common hallucination categories: made-up code and wrong facts.

### Optional: add more verification sources

Install additional MCP servers to unlock more tiers. Each one makes Truth Shield more powerful. See **[ENHANCE.md](ENHANCE.md)** for setup instructions.

| Add this | What you gain |
|----------|--------------|
| **Context7** (MCP) | Live library docs — React, Express, Prisma, 9,000+ libraries |
| **Total Recall** (MCP) | Persistent memory — corrections survive across sessions (learning loop) |
| **fact-mcp** (MCP) | Cached verifications — instant repeat lookups |
| **Graphiti** (MCP) | Entity relationships, temporal facts |
| **Knowledge Graph** (MCP) | Code structure — call chains, symbol maps, dependency trees |
| **Local LLM proxy** | Multi-model cross-check — catches training-data-wide blind spots |
| **LLM Council** (skill) | Conflict resolution when verification sources disagree |

With all sources connected, Truth Shield checks claims across **8 tiers** — from instant cache lookups to multi-model cross-verification.

---

## Always-on mode

Don't want to type "verify this" every time? Add this line to your `CLAUDE.md`:

```
Always verify factual claims before presenting them using the truth-shield skill.
```

Put it in:
- **One project:** `your-project/CLAUDE.md`
- **All projects:** `~/.claude/CLAUDE.md`

Every response with factual claims gets verified automatically. No trigger phrase needed.

---

## Learning loop

When Truth Shield finds a wrong claim and you have Total Recall installed, it doesn't just report the error — it **persists the correction** so the same mistake never happens again.

1. Claude claims "useEffect runs before render"
2. Truth Shield checks Context7 docs, finds it runs **after** render
3. The correction is stored in Total Recall with trigger phrases
4. Next week, Claude tries to make the same claim
5. Total Recall catches it instantly before verification even starts

Without Total Recall, corrections are reported but not remembered across sessions. The verification still works — you just won't get the persistence benefit.

---

## Trigger phrases

| Phrase | What happens |
|--------|-------------|
| `verify this` | Full verification of the previous response |
| `truth-check this` / `fact-check this` | Same as above |
| `shield this` / `truth shield` / `is this true` | Same as above |
| `check your work` | Full verification |
| `shield on` | Continuous mode — every response verified |
| `shield off` | Stop continuous mode |
| `are you sure...` | Spot-check a specific claim |
| `really?` / `source?` / `prove it` | Spot-check the most recent claim |
| `how do you know` / `is that right` / `double-check that` | Spot-check the most recent claim |

---

## Confidence ratings

| Rating | Meaning |
|--------|---------|
| **VERIFIED** | Confirmed by a real source. Evidence quoted. |
| **UNVERIFIED** | No source could confirm or deny. Not wrong — just unconfirmed. |
| **CONTRADICTED** | A source directly contradicts the claim. Correction provided. |
| **CONFLICTED** | Sources disagree with each other. Both positions presented for you to resolve. |

**Claude's own confidence is never treated as a source.** A claim stated with certainty gets the same scrutiny as a hedged guess. The whole point is that confidence without evidence is worthless.

---

## Limitations

- **Sources can be wrong.** Docs can be outdated. Search results can be inaccurate.
- **UNVERIFIED != wrong.** Many true things will be UNVERIFIED because no source was available.
- **Shield-on mode is slower.** Every response goes through verification. Use for high-stakes work.
- **Cannot verify opinions or predictions.** Only factual claims.
- **Learning loop requires Total Recall MCP.** Without it, corrections are reported but not persisted.

The goal is to move from "Claude said it confidently" to "Claude said it, and here's the evidence." That's a meaningful improvement, not a guarantee.

---

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (any version with skills support)
- That's it. No API keys, no dependencies, no config files.

Optional MCP servers enhance verification — see [ENHANCE.md](ENHANCE.md).

---

## How it works (technical)

Truth Shield is a single markdown file (`SKILL.md`) that Claude loads as a skill. It instructs Claude to:

1. **Extract claims** — parse every factual statement from a response
2. **Verify each claim** — check against available sources in tier order (fast/local first, slow/external last)
3. **Score confidence** — VERIFIED, UNVERIFIED, or CONTRADICTED with quoted evidence
4. **Persist corrections** — store wrong answers in memory so they're caught instantly next time
5. **Report results** — table with every claim, its verdict, and the evidence

No runtime dependencies. No external services required. No API keys. The skill file tells Claude what to do — Claude's existing tools do the actual checking.

---

## Contributing

Found a hallucination pattern Truth Shield misses? Open an issue with:
- What Claude said (the wrong claim)
- What the truth is (with source)
- Which verification tier should have caught it

Pull requests welcome for improving claim extraction, adding verification patterns, or enhancing the output format.

---

## Credit

Built by [Avi Bendetsky](https://github.com/AviSoifer).

Inspired by the observation that Claude's confidence and accuracy are uncorrelated — and that the fix is evidence, not more confidence.

## License

MIT — see [LICENSE](./LICENSE).
