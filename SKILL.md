---

name: truth-shield

description: "Fact-verification layer v3 — catches hallucinations using 10 verification tiers, self-consistency sampling, isolated-context verification (CoVe), package existence checking (DepScope), and multi-judge arbitration. Cross-checks claims against local files, stored knowledge, live docs, web search, multi-model cross-check, and external fact-checkers. Every contradiction is persisted so the same lie is never repeated. MANDATORY TRIGGERS: 'verify this', 'truth-check this', 'fact-check this', 'shield this', 'truth shield', 'truth-shield', 'is this true', 'check your work'. STRONG TRIGGERS: 'are you sure', 'really?', 'source?', 'prove it', 'how do you know', 'is that right', 'double-check that'. PASSIVE MODE: 'shield on' / 'shield off'. Do NOT trigger on opinions, creative writing, brainstorming, or subjective preferences."

---


# Truth Shield v3 — Hallucination Defence Layer

Claude generates plausible text, not verified truth. Truth Shield checks every factual claim against real sources before presenting it.

v3 adds research-backed upgrades: self-consistency sampling detects uncertain claims before verification, isolated-context verification breaks confirmation bias, DepScope catches hallucinated packages, and multi-judge arbitration resolves conflicts without single-model bias.

---


## Three modes

### Mode 1: Verify After
User says "verify this" after Claude responds. Truth Shield retroactively checks every claim.

### Mode 2: Shield On (passive)
User says "shield on". Every subsequent response is verified before the user sees it. Slower but catches errors before they matter.

### Mode 3: Spot Check
User says "are you sure about X?" — checks that one claim only.


---


## The verification tiers (0–9)

Claims are checked in this order. Each tier is independent — if unavailable, skip it. Early tiers are fast; later tiers catch more.

```
Tier 0:   fact-mcp cache         — instant (previously verified claims)
Tier 1:   Total Recall            — stored knowledge, past corrections
Tier 2:   Knowledge Graph         — code structure (symbols, call chains)
Tier 3:   Local files             — Grep/Read/Glob (ground truth for code)
Tier 3.5: DepScope                — package existence across 19 ecosystems
Tier 4:   Context7                — live library/API documentation
Tier 5:   Graphiti                — relationship memory (entity facts)
Tier 6:   WebSearch               — general knowledge, current events
Tier 7:   Multi-model cross-check — self-consistency + different model family
Tier 8:   MiniCheck               — external fact-checking model
Tier 9:   Multi-Judge Council     — FACTS-style conflict resolution
```


---


## Step 1: Claim extraction

Parse the response and extract every factual claim — statements that are either true or false.

**Hedged statements are not claims.** "I think", "probably", "might" — these signal uncertainty. Only extract statements presented as definite facts.

Categorise each claim:

| Category | Example | Best tiers |
|---|---|---|
| **Code symbol** | "Function X exists at line Y" | 2 → 3 |
| **Code structure** | "Function X calls function Y" | 2 (cypher) |
| **Package/library name** | "Install lodash-utils" | 3.5 (package check) → 4 |
| **API/library behaviour** | "useEffect runs after render" | 4 → 6 |
| **Past decision** | "We chose JWT over sessions" | 1 → 5 |
| **Entity relationship** | "Service A depends on Service B" | 5 → 2 |
| **General knowledge** | "Python was created in 1991" | 6 → 7 |
| **Current state** | "Server runs on port 3001" | 3 (Read config) |

The "Best tiers" column shows where to START — skip tiers that are obviously irrelevant (e.g., don't check Knowledge Graph for a general knowledge claim). Always fall through to subsequent tiers if the best tier returns UNVERIFIED.


## Step 2: Self-consistency pre-screen (v3)

Before full verification, flag claims that Claude itself is uncertain about. This catches hallucinations that sound confident but aren't stable.

```
For each high-risk claim (package names, version numbers, API signatures, dates):

1. Mentally re-derive the claim from scratch — would you give the same answer
   if asked independently, with no memory of what you just said?

2. Rate your genuine internal confidence (not the confidence you displayed):
   - HIGH: would bet on it, have seen it many times
   - MEDIUM: fairly sure but could be wrong
   - LOW: guessing, filling in from pattern-matching

3. Any claim rated LOW → auto-flag as UNCERTAIN, prioritize for verification
   Any claim rated MEDIUM → verify with extra scrutiny (check 2+ tiers)
   HIGH claims → normal verification pipeline
```

This is NOT a verification source — it's a triage step. Claude's self-assessment is unreliable, which is precisely why uncertain claims get escalated to real sources. The value is catching the claims Claude knows (at some level) it's guessing about.


## Step 3: Verification pipeline

For each claim, work through tiers in order until you get a verdict:

- **VERIFIED or CONTRADICTED** → stop checking this claim (verdict found)
- **UNVERIFIED** → continue to next tier (no evidence yet)
- **CONFLICTED** → stop, escalate to Tier 9

**Exception — Tier 8 (MiniCheck):** If available, run MiniCheck as a second opinion on VERIFIED claims from tiers 4-6 (library docs, web search). If MiniCheck disagrees, escalate to Tier 9. Skip MiniCheck for claims verified by local files (Tier 3) or stored knowledge (Tier 1) — those are ground truth.

**If all tiers exhausted with no verdict** → UNVERIFIED (not UNCERTAIN — self-consistency flags are triage hints, not final verdicts).

**If zero factual claims extracted** → report "No factual claims found — nothing to verify."

**v3 rule: Isolated context for verification.** When checking a claim, do NOT let the original response influence your interpretation of evidence. Read the source material as if you'd never seen the claim. This breaks confirmation bias — the #1 reason v2 missed contradictions.


### Tier 0 — fact-mcp cache (instant)

```
Load: ToolSearch query "select:mcp__fact-mcp__fact_query,mcp__fact-mcp__fact_set"

Call: mcp__fact-mcp__fact_query
  key: "truth-shield:<normalized-claim>"

Hit → use cached verdict + source, skip remaining tiers
Miss → continue to Tier 1
```


### Tier 1 — Total Recall (stored knowledge)

```
Load: ToolSearch query "select:mcp__total-recall__verify_claim,mcp__total-recall__recall_semantic,mcp__total-recall__recall_by_category"

Step A — corrections first:
  Call: mcp__total-recall__recall_by_category  category: "correction"
  Match → CONTRADICTED (this lie was caught before)

Step B — verify against stored facts:
  Call: mcp__total-recall__verify_claim
    claim_type: <"version"|"hosting"|"status"|"technology"|etc.>
    value: <the claim>

Step C — semantic search:
  Call: mcp__total-recall__recall_semantic  query: <claim as question>
```


### Tier 2 — Knowledge Graph (code structure)

```
Load: ToolSearch query "select:mcp__knowledge-graph__query,mcp__knowledge-graph__context,mcp__knowledge-graph__cypher"

"function X exists":
  Call: mcp__knowledge-graph__context  name: <function>
  Found → VERIFIED with path+signature
  Not found → fall through to Tier 3

"X calls Y":
  Call: mcp__knowledge-graph__cypher
    query: 'MATCH (a)-[:CodeRelation {type:"CALLS"}]->(b) WHERE a.name="X" AND b.name="Y" RETURN a,b'
```


### Tier 3 — Local files (Grep / Read / Glob)

```
Always available — no ToolSearch needed.

1. Glob for the file
2. Read at claimed location
3. Grep for symbol across project
4. Compare actual vs claimed
5. Found + matches → VERIFIED, quote the line
6. Found + differs → CONTRADICTED, quote actual vs claimed
7. Not found → CONTRADICTED with "not found in codebase"
```

**Always quote evidence.** "VERIFIED — src/auth.ts:42: `export function validateToken(...)`" — not just "checked the file."


### Tier 3.5 — Package existence verification (v3)

For any claim that references a package, library, or module by name — especially in install commands, import statements, or dependency recommendations.

Hallucinated package names are a top-5 hallucination category. Users who `npm install` a fake name risk installing malware that squatted it.

```
Method A — DepScope MCP (if installed):
  Load: ToolSearch query "+depscope"
  Call the package-check tool for the claimed package + ecosystem.
  EXISTS → continue (package is real)
  NOT FOUND → CONTRADICTED with "Package does not exist in <ecosystem>"

Method B — WebSearch fallback (if no DepScope):
  Load: ToolSearch query "select:WebSearch"
  Call: WebSearch
    query: "<package-name>" site:npmjs.com  (or pypi.org, crates.io, etc.)
  
  Registry page found → package exists, continue
  No results → CONTRADICTED — "No registry listing found for '<name>'.
    This may be a hallucinated package name."

Method C — Context7 fallback:
  If the package is a well-known library, Context7 can confirm it exists
  via resolve-library-id. No match → suspicious but not definitive.
```

**Always check package names.** Even if the rest of the claim is verified, a wrong package name can cause real harm (slopsquatting/typosquatting attacks).


### Tier 4 — Context7 (live documentation)

```
Load: ToolSearch query "select:mcp__context7__resolve-library-id,mcp__context7__query-docs"

1. mcp__context7__resolve-library-id  libraryName: <library>
2. mcp__context7__query-docs  context7CompatibleLibraryID: <id>  query: <claim>
3. Match → VERIFIED, quote doc passage
   Contradiction → CONTRADICTED, quote what docs say
   No match → UNVERIFIED
```


### Tier 5 — Graphiti (relationship memory)

```
Load: ToolSearch query "select:mcp__graphiti__search_memory_facts,mcp__graphiti__search_nodes"

Relationships: mcp__graphiti__search_memory_facts  query: <claim>
Entities: mcp__graphiti__search_nodes  query: <entity>

Interpreting results:
  Fact found + matches claim → VERIFIED with the stored fact as evidence
  Fact found + contradicts claim → CONTRADICTED with the stored fact
  Fact found but temporal metadata shows it's outdated → UNVERIFIED (stale data)
  No matching facts or entities → UNVERIFIED (not in relationship memory)
```


### Tier 6 — WebSearch (general knowledge)

```
Load: ToolSearch query "select:WebSearch"

Call: WebSearch  query: <claim as verification question>

**Require 2+ agreeing sources before VERIFIED.**
Single source → UNVERIFIED (note "single source — verify independently")
Sources disagree → UNVERIFIED, present disagreement
WebSearch-only verdicts: persist at confidence 0.7 (not 0.9)
```

**Never mark VERIFIED on a single web source or Claude's confidence alone.**


### Tier 7 — Multi-model cross-check with self-consistency (v3)

v3 upgrades this tier with self-consistency sampling: query multiple models (or the same model multiple times at high temperature) and check agreement.

```
Load: ToolSearch query "select:WebFetch"

Step A — Cross-model check:
  Call: WebFetch
    url: "http://localhost:20128/v1/chat/completions"
    headers: {"Content-Type":"application/json","Authorization":"Bearer 9router"}
    body: {
      "model": "gpt-4o",
      "messages": [{"role":"user","content":"Is this true or false? <claim>. Cite your source."}],
      "max_tokens": 300,
      "temperature": 0.0
    }

  These are defaults — change URL/auth to match your proxy.
  See ENHANCE.md Tier 7 for configuration.

Step B — Self-consistency (if proxy supports multiple models):
  Repeat the query with 2 additional models (e.g., gemini-2.5-flash, llama-3.3-70b)
  
  All 3 agree → strong signal (increases confidence)
  2/3 agree → moderate signal
  All 3 disagree → HIGH UNCERTAINTY, flag as CONFLICTED

If no proxy running → skip tier, note "multi-model unavailable"
```


### Tier 8 — MiniCheck external fact-checker (v3)

A purpose-built fact-verification model (EMNLP 2024). Unlike LLMs that generate plausible text, MiniCheck was trained specifically to judge `(document, claim) → true/false`. On grounding-check benchmarks, it matches or exceeds GPT-4 for document-claim verification.

```
Load: ToolSearch query "select:WebFetch"

Call: WebFetch
  url: "http://localhost:11434/api/generate"
  method: POST
  body: {
    "model": "bespoke-minicheck",
    "prompt": "Document: <evidence from earlier tiers>\nClaim: <the claim>\nIs the claim supported by the document? Answer YES or NO.",
    "stream": false
  }

YES → reinforces VERIFIED verdict
NO → reinforces CONTRADICTED verdict (or downgrades UNVERIFIED to CONTRADICTED)

Default: Ollama at localhost:11434 with bespoke-minicheck model.
See ENHANCE.md Tier 8 for setup: `ollama pull bespoke-minicheck`
```

MiniCheck is most valuable as a second opinion on claims that passed earlier tiers. If Tier 4 (Context7) says VERIFIED but MiniCheck says NO, escalate to Tier 9.

If Ollama/MiniCheck unavailable → skip tier.


### Tier 9 — Multi-Judge Council (v3, replaces old Tier 8)

Fires ONLY when tiers produce conflicting evidence. Uses FACTS-style multi-judge arbitration (DeepMind 2024) instead of single-model resolution.

```
Trigger: two or more tiers returned different verdicts for the same claim

When triggered:
  Option A — If /llm-council skill is available:
    Invoke with: "Sources disagree on: <claim>
      Source A: <verdict + evidence>
      Source B: <verdict + evidence>
      Arbitrate using FACTS framework: each judge scores independently,
      then average. Final verdict requires 2/3 majority."

  Option B — If multi-model proxy available but no /llm-council:
    Query 3 different models via WebFetch with the same arbitration prompt
    Each responds independently (isolated context)
    Tally: 2/3+ agree → that verdict wins
    No majority → CONFLICTED, present all positions to user

  Option C — No council, no proxy:
    Present both positions: "[CONFLICTED] Sources disagree: ..."
```


---


## Step 4: Confidence scoring

| Score | Meaning | Display |
|---|---|---|
| **VERIFIED** | Confirmed by authoritative source. Evidence quoted. | Presented normally |
| **UNVERIFIED** | No source could confirm or deny. | `[unverified]` |
| **CONTRADICTED** | Source directly contradicts. Correction provided. | `[CONTRADICTED — <correction>]` |
| **CONFLICTED** | Sources disagree. Both positions presented. | `[CONFLICTED — see details]` |
| **UNCERTAIN** | Self-consistency pre-screen flagged low confidence. | `[uncertain — needs verification]` |


## Step 5: The learning loop

When a claim is CONTRADICTED:

```
Load: ToolSearch query "select:mcp__total-recall__correct,mcp__total-recall__remember,mcp__graphiti__add_memory"

1. PERSIST correction:
   mcp__total-recall__remember
     category: "correction"
     content: "Claude claimed '<wrong>'. Correct: '<right>'. Source: <source>"
     tags: ["truth-shield", "<topic>"]
     triggers: [<key phrases>]
     scope: "global"

2. CACHE correct answer:
   mcp__fact-mcp__fact_set
     key: "truth-shield:<normalized-claim>"
     value: '{"verdict":"CONTRADICTED","correction":"<answer>","source":"<source>"}'
     tier: "semi-dynamic"

3. ADD to relationship memory:
   mcp__graphiti__add_memory
     name: "Truth Shield correction"
     episode_body: "Corrected: '<wrong>' → '<right>'. Source: <source>."

4. If existing Total Recall entry was wrong:
   mcp__total-recall__correct
     original_id: <UUID>
     corrected_content: <correct info>
     reason: "Truth Shield: <source>"
     severity: "high"
```

When VERIFIED, store lighter weight:
```
mcp__total-recall__remember  category:"fact"  content:"<claim>. Source:<source>"  confidence:0.9
mcp__fact-mcp__fact_set  key:"truth-shield:<claim>"  value:'{"verdict":"VERIFIED","source":"<source>"}'
```


---


## Step 6: Output

### Verify After report

```
## Truth Shield Report (v3)

Claims checked: 7 | Verified: 5 | Unverified: 1 | Contradicted: 1

| # | Claim | Verdict | Evidence | Tier |
|---|---|---|---|---|
| 1 | useEffect runs after render | VERIFIED | Context7: React docs | 4 |
| 2 | validateToken in auth.ts | VERIFIED | Grep: src/auth.ts:42 | 3 |
| 3 | Install lodash-helpers | CONTRADICTED | DepScope: package not found in npm | 3.5 |
| 4 | Express defaults to port 3000 | VERIFIED | WebSearch (3 sources) | 6 |
| 5 | parseDate calls moment() | CONTRADICTED | KG: calls date-fns/parse | 2 |
| 6 | Python 3.12 released Mar 2024 | UNVERIFIED | Conflicting dates | 6 |
| 7 | We chose JWT for auth | VERIFIED | Total Recall: decision-2026-04 | 1 |

Corrections persisted: 2 (caught instantly in future sessions)
Self-consistency flags: 1 claim pre-screened as LOW confidence (#3)
Tiers used: Total Recall, Knowledge Graph, Grep, DepScope, Context7, WebSearch
```

### Shield On footer

```
[shield: 5/7 verified, 2 contradicted | tiers: 1,2,3,3.5,4,6 | v3]
```

### Zero-verified report

```
## Truth Shield Report (v3)

Claims checked: 4 | Verified: 0 | Unverified: 4

Available tiers found no evidence:
- Tier 3 (Grep/Read/Glob): checked — no relevant local files
- Tier 0-2, 4-9: unavailable

UNVERIFIED ≠ wrong — no source was available to confirm.
```


---


## Graceful degradation

Every tier is independent. Missing tiers reduce coverage, never break the pipeline.

| Tier | If unavailable | Impact |
|---|---|---|
| 0 - fact-mcp | Check all sources fresh | Slower |
| 1 - Total Recall | No past corrections | Errors may repeat |
| 2 - Knowledge Graph | No structure verification | Code uses Grep only |
| 3 - Grep/Read/Glob | No local verification | Code claims UNVERIFIED |
| 3.5 - DepScope | No package checking | Fake packages undetected |
| 4 - Context7 | No live docs | Library claims use WebSearch |
| 5 - Graphiti | No relationship memory | Entity claims UNVERIFIED |
| 6 - WebSearch | No web verification | General knowledge UNVERIFIED |
| 7 - Multi-model | No cross-check | Training blind spots undetected |
| 8 - MiniCheck | No external fact-checker | Rely on tier agreement only |
| 9 - Multi-Judge | Conflicts shown to user | User resolves manually |

**Minimum viable:** Tier 3 alone covers code claims — the highest-value case.


---


## What Truth Shield does NOT do

- **Verify opinions.** "React is better than Vue" — not factual.
- **Verify predictions.** "This will scale to 1M users" — speculation.
- **Verify recommendations.** "You should use TypeScript" — advice.
- **Guarantee 100%.** Sources can be wrong. The goal is evidence, not omniscience.


---


## Important notes

- **Always quote evidence.** Not "checked docs." Say what the docs say.
- **Confidence ≠ accuracy.** Never skip verification because Claude feels sure.
- **Isolated context (v3).** When reading evidence, pretend you never saw the original claim. This breaks confirmation bias.
- **Contradictions are permanent.** Every CONTRADICTED claim enters the learning loop.
- **UNVERIFIED ≠ wrong.** Many true statements will be UNVERIFIED.
- **Package names are high-risk.** Always check Tier 3.5 for any package recommendation.
