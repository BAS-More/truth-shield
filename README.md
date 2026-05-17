# Truth Shield

Claude sometimes states things confidently that turn out to be wrong. It invents function names, gets API details outdated, and presents guesses as facts. You have no way to tell which parts of a response are reliable and which are fabricated — unless you check every claim yourself.

Truth Shield is a Claude Code skill that checks for you. It verifies Claude's factual claims against up to 8 real sources — your code files, stored knowledge, live documentation, web search results, and more — and flags anything it can't confirm. You get a clear report showing what's grounded, what's unverified, and what's outright wrong.

Every contradiction is persisted to memory systems so the same mistake is never repeated.

---

## Install

### Mac / Linux

```bash
cp SKILL.md ~/.claude/skills/truth-shield.md
```

### Windows (PowerShell)

```powershell
Copy-Item SKILL.md "$env:USERPROFILE\.claude\skills\truth-shield.md"
```

That's it. No config files to edit, no dependencies to install.

### Verify it works

After installing, open a Claude Code session and type:

```
truth-shield: are you active?
```

Claude should acknowledge that Truth Shield is available and explain its three modes. If it doesn't, check that the file landed in the right directory.

---

## How to use it

Truth Shield has three modes. Pick the one that fits your situation.

### Mode 1: Verify After

You already have a Claude response and want to know which claims are solid. Just type:

```
verify this
```

Truth Shield extracts every factual claim, checks each against available sources, and produces a report.

### Mode 2: Shield On (continuous)

For high-stakes work — production deployments, client deliverables, documentation — where you need every response checked before you see it.

```
shield on
```

From that point on, every Claude response is silently verified. You'll see inline markers on anything that doesn't check out. Turn it off when you're done:

```
shield off
```

**Note:** Shield-on mode adds verification time to every response. Use it for work where accuracy matters more than speed.

### Mode 3: Spot Check

Claude just said something specific and you want to check that one thing:

```
are you sure useEffect runs before render?
```

Truth Shield checks only the targeted claim and reports back with its source.

---

## Trigger phrases

### Always triggers

- `verify this`
- `truth-check this`
- `fact-check this`
- `shield this`
- `truth shield`
- `is this true`
- `check your work`

### Triggers when challenging a specific claim

- `are you sure`
- `really?`
- `source?`
- `prove it`
- `how do you know`
- `is that right`
- `double-check that`

### Continuous mode

- `shield on` — start verifying every response
- `shield off` — stop

---

## 8 Verification Sources

Truth Shield uses whatever tools Claude has access to in the current session. It checks sources in order of speed — cached and local sources first, expensive ones only when needed.

| Tier | Source | What it checks | Tool required |
|------|--------|----------------|---------------|
| 0 | **fact-mcp cache** | Previously verified claims (instant lookup) | `fact-mcp` MCP |
| 1 | **Total Recall** | Stored knowledge + past corrections | `total-recall` MCP |
| 2 | **Knowledge Graph** | Code structure — execution flows, symbol relationships | `knowledge-graph` MCP |
| 3 | **Local files** | Function names, file paths, line numbers, signatures | `Grep` + `Read` + `Glob` (always available) |
| 4 | **Context7** | Library and API claims — checked against live documentation | `context7` MCP |
| 5 | **Graphiti** | Entity relationships, temporal facts | `graphiti` MCP |
| 6 | **WebSearch** | General knowledge, version numbers, release dates | `WebSearch` tool |
| 7 | **9Router multi-model** | Cross-check with a different LLM via local proxy | 9Router running on `:20128` |
| 8 | **LLM Council** | Conflict resolution — fires only when sources disagree | `llm-council` skill |

If a tool isn't available, Truth Shield tells you what it couldn't check rather than silently skipping it. The report always shows which sources were used and which were unavailable.

### Graceful degradation

Truth Shield works with any subset of these sources. With only Grep/Read/Glob (always available), it verifies code claims. Each additional source expands what can be checked:

| Setup | What you get |
|-------|--------------|
| **Grep + Read + Glob only** | Code claims verified — function names, file paths, signatures |
| **+ Total Recall** | Past corrections recalled — same lie never repeated |
| **+ Knowledge Graph** | Code structure claims — execution flows, dependencies |
| **+ Context7** | Library/API claims against live documentation |
| **+ fact-mcp** | Instant cache hits for previously checked claims |
| **+ Graphiti** | Entity relationship and temporal fact verification |
| **+ WebSearch** | General knowledge, version numbers, release dates |
| **+ 9Router** | Cross-model disagreement detection |
| **+ LLM Council** | Conflict resolution when sources disagree |
| **All unavailable** | All claims marked UNVERIFIED — report is honest about this |

---

## Learning loop

When Truth Shield finds a contradiction, it doesn't just report it — it persists the correction so the same mistake is never repeated:

1. **Total Recall** — stores the correction with triggers so it's recalled whenever the topic comes up
2. **fact-mcp** — caches the correct answer for instant future lookups
3. **Graphiti** — adds the correction to relationship memory for cross-referencing

This means Truth Shield gets better over time. The first time Claude claims Express defaults to port 8080, it catches and corrects it. The second time the topic comes up, the correction is recalled from memory before Claude can repeat the mistake.

---

## Confidence ratings

| Rating | Meaning |
|---|---|
| **VERIFIED** | Confirmed by at least one real source. Evidence is quoted with the source named. |
| **UNVERIFIED** | Could not confirm or deny. No source available, or claim is outside what the available tools can check. Not necessarily wrong — just not confirmed. |
| **CONTRADICTED** | A source directly contradicts the claim. The correction and source are provided. |

**Important:** Claude's own confidence is never treated as a source. A claim that Claude states with certainty is not more likely to be true. Truth Shield only marks claims VERIFIED when external evidence confirms them.

---

## Limitations

Truth Shield reduces hallucination risk. It does not eliminate it.

- **Sources can be wrong.** Docs can be outdated. Search results can be inaccurate. Truth Shield is evidence-based, not infallible.
- **UNVERIFIED != wrong.** It means "I couldn't find evidence either way." Many true statements will be UNVERIFIED simply because no source was available to check.
- **Passive mode is slower.** Every response goes through verification. Use it for high-stakes work, not casual exploration.
- **It cannot verify predictions or opinions.** "This will scale to 1M users" and "React is better than Vue" are outside its scope.
- **Learning loop requires MCP servers.** Corrections are only persisted when Total Recall, Graphiti, or fact-mcp are available. Without them, corrections are reported but not remembered.

The goal is to move from "Claude said it confidently" to "Claude said it, and here's the evidence." That's a meaningful improvement, not a guarantee.

---

## Credit

Built by [Avi Bendetsky](https://github.com/AviSoifer).

Inspired by the observation that Claude's confidence and accuracy are uncorrelated — and that the fix is evidence, not more confidence.

## License

MIT — see [LICENSE](./LICENSE).
