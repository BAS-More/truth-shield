---

name: truth-shield

description: "Fact-verification layer with 8 verification sources — cross-checks Claude's claims against local files, stored knowledge (Total Recall), code graph (Knowledge Graph), relationship memory (Graphiti), live docs (Context7), web search, multi-model cross-check (9Router), and LLM Council for conflict resolution. Catches hallucinations, ungrounded assertions, and confident-but-wrong statements. Every contradiction is persisted so the same lie is never repeated. MANDATORY TRIGGERS: 'verify this', 'truth-check this', 'fact-check this', 'shield this', 'truth shield', 'truth-shield', 'is this true', 'check your work'. STRONG TRIGGERS: 'are you sure', 'really?', 'source?', 'prove it', 'how do you know', 'is that right', 'double-check that'. PASSIVE MODE: 'shield on' enables continuous verification — every claim verified before presenting. 'shield off' disables it. Do NOT trigger on opinion questions, creative writing, brainstorming, or subjective preferences — Truth Shield is for factual claims only."

---


# Truth Shield — Hallucination Defence Layer

Claude generates plausible text, not verified truth. Truth Shield fixes this by checking every factual claim against real sources before presenting it.

It wires 8 verification systems into a single pipeline. Every contradiction is persisted — the same lie is never repeated.


---


## Three modes

### Mode 1: Verify After
User says "verify this" after Claude responds. Truth Shield retroactively checks every claim.

### Mode 2: Shield On (passive)
User says "shield on". Every subsequent response is verified before the user sees it. Slower but catches errors before they matter.

### Mode 3: Spot Check
User says "are you sure about X?" — checks that one claim only.


---


## The verification tiers (0–8)

Claims are checked in this order. Each tier is independent — if one is unavailable, skip it and try the next. Early tiers are fast and free; later tiers are slower but catch more.

```
Tier 0: fact-mcp cache        — instant, free (previously verified claims)
Tier 1: Total Recall           — stored knowledge, past corrections, verified facts
Tier 2: Knowledge Graph        — code structure (symbols, call chains, dependencies)
Tier 3: Local files            — Grep/Read/Glob (ground truth for code)
Tier 4: Context7               — live library/API documentation
Tier 5: Graphiti               — relationship memory (entity facts, connections)
Tier 6: WebSearch              — general knowledge, current events
Tier 7: 9Router multi-model    — cross-check against a different model family
Tier 8: LLM Council            — conflict resolution when sources disagree
```


---


## Step 1: Claim extraction

Parse the response and extract every factual claim — statements that are either true or false.

**Hedged statements are not claims.** "I think", "probably", "might", "could", "I believe" — these are already signalling uncertainty. Do not extract them. Only extract statements presented as definite facts.

Categorise each claim:

| Category | Example | Best tiers |
|---|---|---|
| **Code symbol** | "Function X exists at line Y" | Tier 2 (Knowledge Graph) → Tier 3 (Grep/Read) |
| **Code structure** | "Function X calls function Y" | Tier 2 (Knowledge Graph cypher) |
| **API/library** | "useEffect runs after render" | Tier 4 (Context7) → Tier 6 (WebSearch) |
| **Past decision** | "We chose JWT over sessions" | Tier 1 (Total Recall) → Tier 5 (Graphiti) |
| **Entity relationship** | "Service A depends on Service B" | Tier 5 (Graphiti) → Tier 2 (Knowledge Graph) |
| **General knowledge** | "Python was created in 1991" | Tier 6 (WebSearch) → Tier 7 (9Router) |
| **Current state** | "Server runs on port 3001" | Tier 3 (Read config) |


## Step 2: Verification pipeline

For each claim, work through tiers until you get a verdict. Stop at the first VERIFIED or CONTRADICTED result — no need to check further tiers for that claim.


### Tier 0 — fact-mcp cache (instant)

Check if this claim was previously verified. Avoids redundant lookups.

```
Load: ToolSearch query "select:mcp__fact-mcp__fact_query,mcp__fact-mcp__fact_set"

Call: mcp__fact-mcp__fact_query
  key: "truth-shield:<normalized-claim>"
  (normalize: lowercase, strip punctuation, collapse whitespace)

Hit → use cached verdict + source, skip all other tiers
Miss → continue to Tier 1
```


### Tier 1 — Total Recall (stored knowledge)

Check against everything the system has ever learned — past verifications, corrections, decisions, facts.

```
Load: ToolSearch query "select:mcp__total-recall__verify_claim,mcp__total-recall__recall_semantic,mcp__total-recall__recall_by_category"

Step A — Check for existing corrections first:
  Call: mcp__total-recall__recall_by_category
    category: "correction"
  Scan corrections for anything matching this claim.
  If a correction matches → CONTRADICTED (the system already caught this lie before)

Step B — Verify against stored facts:
  Call: mcp__total-recall__verify_claim
    claim_type: <"version" | "hosting" | "status" | "technology" | etc.>
    value: <the claim value>
  Returns: VERIFIED, CONFLICT, or UNKNOWN

Step C — Semantic search for related knowledge:
  Call: mcp__total-recall__recall_semantic
    query: <the claim as a natural language question>
  If matching entries found with high confidence → use as evidence
```

**Why this matters:** Total Recall remembers every correction ever made. If Claude lied about something last week and was corrected, Tier 1 catches it instantly this week.


### Tier 2 — Knowledge Graph (code structure)

For claims about code — symbols, call chains, dependencies, class hierarchies.

```
Load: ToolSearch query "select:mcp__knowledge-graph__query,mcp__knowledge-graph__context,mcp__knowledge-graph__cypher"

For "function X exists" claims:
  Call: mcp__knowledge-graph__context
    name: <function name>
  Returns: file path, callers, callees, references
  If found → VERIFIED with file path and signature
  If not found → fall through to Tier 3 (Grep) before marking CONTRADICTED

For "X calls Y" or "X depends on Y" claims:
  Call: mcp__knowledge-graph__cypher
    query: 'MATCH (a)-[:CodeRelation {type: "CALLS"}]->(b) WHERE a.name = "X" AND b.name = "Y" RETURN a, b'
  If result → VERIFIED
  If no result → CONTRADICTED with "no call relationship found in code graph"

For "how does feature X work" claims:
  Call: mcp__knowledge-graph__query
    query: <the claim>
  Returns: execution flows, ranked by relevance
```

**Why this matters:** Knowledge Graph has the actual call graph indexed. When Claude says "function A calls function B," this is a definitive check — not a text search, but a structural analysis.


### Tier 3 — Local files (Grep / Read / Glob)

Ground truth for anything in the codebase.

```
No ToolSearch needed — Grep, Read, Glob are always available.

1. Glob for the file (does it exist?)
2. Read the file at the claimed location (is the content what was claimed?)
3. Grep for the symbol name across the project (where does it actually appear?)
4. Compare actual content against claim
5. If found and matches → VERIFIED, quote the actual line
6. If found but differs → CONTRADICTED, quote actual vs claimed
7. If not found → CONTRADICTED with "not found in codebase"
```

**Always quote the evidence.** "VERIFIED — src/auth.ts:42 contains: `export function validateToken(token: string): boolean`" — not just "VERIFIED — checked the file."


### Tier 4 — Context7 (live documentation)

For library/API/framework claims. Live docs beat training data.

```
Load: ToolSearch query "select:mcp__context7__resolve-library-id,mcp__context7__query-docs"

1. Call: mcp__context7__resolve-library-id
     libraryName: <e.g. "react", "express", "prisma">
   Returns: library ID

2. Call: mcp__context7__query-docs
     context7CompatibleLibraryID: <ID from step 1>
     query: <the specific claim as a question>
   Returns: relevant doc passages

3. Compare claim against doc passages
   Match → VERIFIED, quote the doc passage
   Contradiction → CONTRADICTED, quote what docs actually say
   No relevant passage → UNVERIFIED, note "docs checked, no match found"
```


### Tier 5 — Graphiti (relationship memory)

For claims about entities, relationships, and facts stored in the knowledge graph memory.

```
Load: ToolSearch query "select:mcp__graphiti__search_memory_facts,mcp__graphiti__search_nodes"

For relationship claims ("X depends on Y", "A was decided because of B"):
  Call: mcp__graphiti__search_memory_facts
    query: <the claim>
  Returns: facts with source and temporal metadata

For entity claims ("Service X exists", "User Y is the owner"):
  Call: mcp__graphiti__search_nodes
    query: <entity name or description>
  Returns: matching entities with attributes

If fact found and matches → VERIFIED with source
If fact found and contradicts → CONTRADICTED with the stored fact
If no fact found → UNVERIFIED (no entry in relationship memory)
```


### Tier 6 — WebSearch (general knowledge)

For claims about the world — dates, versions, people, events.

```
Load: ToolSearch query "select:WebSearch"

Call: WebSearch
  query: <the claim phrased as a verification question>
  Example: "What year was Python created?" (not "Python was created in 1991")

Look for multiple independent sources. **Require at least 2 agreeing sources before marking VERIFIED** — a single search result could be wrong, outdated, or adversarial.
Two or more sources agree and match claim → VERIFIED, cite the sources
Two or more sources agree but contradict claim → CONTRADICTED, cite what sources say
Only one source found → UNVERIFIED, cite it but note "single source — verify independently"
Sources disagree with each other → UNVERIFIED, present the disagreement
```

**Never mark general knowledge VERIFIED on a single web source or on Claude's confidence alone.** Web results can be manipulated. Claude's confidence and accuracy are uncorrelated. When persisting WebSearch-only verdicts to the learning loop, use confidence 0.7 (not 0.9) to reflect the lower reliability.


### Tier 7 — 9Router multi-model cross-check

Query a different model family. The only check that catches training-data-wide blind spots.

```
Load: ToolSearch query "select:WebFetch"

Call: WebFetch
  url: "http://localhost:YOUR_PORT/v1/chat/completions"
  method: POST
  headers: {"Content-Type": "application/json", "Authorization": "Bearer YOUR_TOKEN"}
  body: {
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Is the following true or false? <claim>. State the answer and cite your source."}],
    "max_tokens": 300
  }

  Default: http://localhost:20128 with "Bearer 9router" — change these to match your local proxy.
  See ENHANCE.md Tier 7 for configuration instructions.

Both models agree → increases confidence (not proof — both could share the error)
Models disagree → flag as CONFLICTED, present both positions, escalate to Tier 8
Second model says "I don't know" → no signal, skip
```

If no proxy is running, the request fails with connection refused. Skip this tier and note "multi-model cross-check unavailable" in the report.


### Tier 8 — LLM Council (conflict resolution)

Fires ONLY when tiers 1-7 produce conflicting evidence. Not a blanket check — a disagreement arbitrator.

```
Trigger condition: two or more tiers returned different verdicts for the same claim
  Example: Context7 says VERIFIED but WebSearch says CONTRADICTED
  Example: Claude says X, GPT-4o says Y

When triggered, invoke the /llm-council skill (if available) with:
  "Two sources disagree on this factual claim:
   Claim: <the claim>
   Source A says: <verdict + evidence>
   Source B says: <verdict + evidence>
   Which source is more authoritative and why? Provide a final verdict."

If /llm-council is not available, present both positions to the user:
  "[CONFLICTED] Sources disagree on this claim:
   - <Source A>: <evidence>
   - <Source B>: <evidence>
   Verify manually."
```

The council is expensive (15 sub-agents). It only fires on genuine conflicts — typically 0-2 times per verification run.


---


## Step 3: Confidence scoring

| Score | Meaning | Display |
|---|---|---|
| **VERIFIED** | Confirmed by at least one authoritative source. Evidence quoted. | Presented normally |
| **UNVERIFIED** | No source could confirm or deny. | `[unverified]` |
| **CONTRADICTED** | Source directly contradicts. Correction provided. | `[CONTRADICTED — <correction>]` |
| **CONFLICTED** | Sources disagree. Both positions presented. | `[CONFLICTED — see details]` |


## Step 4: The learning loop

This is what makes Truth Shield get smarter over time. When a claim is CONTRADICTED:

```
Load: ToolSearch query "select:mcp__total-recall__correct,mcp__total-recall__remember,mcp__graphiti__add_memory"

1. PERSIST the correction permanently:
   Call: mcp__total-recall__remember
     category: "correction"
     content: "Claude claimed '<wrong claim>'. Correct answer: '<right answer>'. Source: <source>"
     tags: ["truth-shield", "<topic>"]
     triggers: [<key phrases from the claim>]
     scope: "global"

2. CACHE the correct answer for immediate reuse:
   Call: mcp__fact-mcp__fact_set
     key: "truth-shield:<normalized-claim>"
     value: '{"verdict":"CONTRADICTED","correction":"<correct answer>","source":"<source>"}'
     tier: "semi-dynamic"

3. ADD to relationship memory for cross-session recall:
   Call: mcp__graphiti__add_memory
     name: "Truth Shield correction"
     episode_body: "Corrected claim: '<wrong>' → '<right>'. Source: <source>."
     source: "truth-shield"
     source_description: "Automated fact verification correction"

4. If an existing Total Recall entry was the source of the wrong claim:
   Call: mcp__total-recall__correct
     original_id: <UUID of the wrong entry>
     corrected_content: <the correct information>
     reason: "Truth Shield verification found this to be incorrect. Source: <source>"
     severity: "high"
```

**Why this matters:** Next session, when Claude tries to make the same wrong claim, Tier 1 (Total Recall) catches it instantly from stored corrections. The lie is killed permanently.

When a claim is VERIFIED, store it too (lighter weight):

```
Call: mcp__total-recall__remember
  category: "fact"
  content: "<verified claim>. Source: <source>"
  tags: ["truth-shield", "<topic>"]
  scope: "global"
  confidence: 0.9

Call: mcp__fact-mcp__fact_set
  key: "truth-shield:<normalized-claim>"
  value: '{"verdict":"VERIFIED","source":"<source>"}'
  tier: "semi-dynamic"
```


---


## Step 5: Output

### Verify After report

```
## Truth Shield Report

### Claims checked: 7 | Verified: 5 | Unverified: 1 | Contradicted: 1

| # | Claim | Verdict | Evidence | Tier |
|---|---|---|---|---|
| 1 | useEffect runs after render | VERIFIED | Context7: React docs | 4 |
| 2 | validateToken exists in auth.ts | VERIFIED | Grep: src/auth.ts:42 | 3 |
| 3 | We chose JWT for auth | VERIFIED | Total Recall: decision-2026-04 | 1 |
| 4 | Express defaults to port 3000 | VERIFIED | WebSearch: Express docs | 6 |
| 5 | parseDate calls moment() | CONTRADICTED | Knowledge Graph: no CALLS edge found | 2 |
| 6 | Python 3.12 released March 2024 | UNVERIFIED | WebSearch: conflicting dates found | 6 |
| 7 | useSyncExternalStore added in React 16 | CONTRADICTED | Context7: added in React 18 | 4 |

### Corrections persisted (learning loop)
- Claim 5: `parseDate` does not call `moment()`. Knowledge Graph shows it calls `date-fns/parse`. Stored in Total Recall.
- Claim 7: `useSyncExternalStore` was introduced in React 18. Stored in Total Recall + Graphiti.

### Confidence: 71% (5/7 verified)
### Tiers used: Total Recall, Knowledge Graph, Grep, Context7, WebSearch
### Corrections stored: 2 (these errors will be caught instantly in future sessions)
```

### Shield On footer

```
[shield: 5/7 verified, 2 corrected, 2 corrections persisted | tiers: 1,2,3,4,6]
```

### Zero-verified report

When claims cannot be verified (e.g., general knowledge with no WebSearch available and no relevant local files):

```
## Truth Shield Report

Claims checked: 4 | Verified: 0 | Unverified: 4

Available tiers found no evidence for these claims:
- Tier 3 (Grep/Read/Glob): checked — no relevant local files
- Tier 0 (fact-mcp): unavailable
- Tier 1 (Total Recall): unavailable
- Tier 2 (Knowledge Graph): unavailable
- Tier 4 (Context7): unavailable
- Tier 5 (Graphiti): unavailable
- Tier 6 (WebSearch): unavailable
- Tier 7 (multi-model): unavailable

UNVERIFIED does not mean wrong — it means no source was available to confirm.
Verify these claims independently before relying on them.
```


---


## Graceful degradation

Each tier is independent. Missing tiers reduce coverage but never break the pipeline.

| Tier | If unavailable | Impact |
|---|---|---|
| 0 - fact-mcp | Skip cache, check all sources fresh | Slower, but same accuracy |
| 1 - Total Recall | No past corrections loaded | Same errors may repeat across sessions |
| 2 - Knowledge Graph | No code structure verification | Code claims rely on Grep only (text match, not structural) |
| 3 - Grep/Read/Glob | No local file verification | Code claims all UNVERIFIED |
| 4 - Context7 | No live docs | Library claims rely on WebSearch or go UNVERIFIED |
| 5 - Graphiti | No relationship memory | Entity/relationship claims go UNVERIFIED |
| 6 - WebSearch | No web verification | General knowledge claims all UNVERIFIED |
| 7 - 9Router | No multi-model cross-check | Training-data blind spots undetectable |
| 8 - LLM Council | Conflicts presented to user directly | User resolves conflicts instead of council |

**Minimum viable verification:** Tier 3 (Grep/Read/Glob) alone covers the highest-value case — code claims. Everything else is additive.


---


## What Truth Shield does NOT do

- **Verify opinions.** "React is better than Vue" — not a factual claim.
- **Verify predictions.** "This will scale to 1M users" — speculation.
- **Verify recommendations.** "You should use TypeScript" — advice.
- **Make Claude omniscient.** No source → UNVERIFIED. That's honest.
- **Guarantee 100% accuracy.** Sources can be wrong. The goal is evidence, not omniscience.


---


## Important notes

- **Always quote evidence.** Not "VERIFIED — checked docs." Say "VERIFIED — React docs state: `useEffect fires after the browser paints`."
- **Confidence ≠ accuracy.** Never skip verification because Claude feels sure. The whole point is that confidence without evidence is worthless.
- **Contradictions are permanent.** Every CONTRADICTED claim is stored in Total Recall. The learning loop means Truth Shield gets smarter with every correction.
- **UNVERIFIED ≠ wrong.** It means no source was available. Many true statements will be UNVERIFIED.
- **Conflicts are valuable.** When sources disagree, don't pick one — present both (or escalate to LLM Council).
- **Speed vs accuracy is the user's choice.** Shield-on is thorough but slow. Spot-check is fast but narrow.
