---

name: truth-shield


description: "Fact-verification layer that cross-checks Claude's claims against real sources before presenting them. Catches hallucinations, ungrounded assertions, and confident-but-wrong statements by triangulating against code, docs, and optionally a second model. MANDATORY TRIGGERS: 'verify this', 'truth-check this', 'fact-check this', 'shield this', 'truth shield', 'truth-shield', 'is this true', 'check your work'. STRONG TRIGGERS (use when Claude just made a factual claim the user seems uncertain about): 'are you sure', 'really?', 'source?', 'prove it', 'how do you know', 'is that right', 'double-check that'. PASSIVE MODE TRIGGER: 'shield on' enables continuous verification for the rest of the session — every claim Claude makes is silently verified before presenting. 'shield off' disables it. Do NOT trigger on opinion questions, creative writing, brainstorming, or subjective preferences — Truth Shield is for factual claims only."

---


# Truth Shield — Hallucination Defence Layer


Claude generates plausible text, not verified truth. When Claude is confident and wrong, nothing in the default workflow catches it. Truth Shield fixes this by inserting a verification step between Claude's reasoning and its output.

The principle is simple: **never present a factual claim without checking it first.**


---


## How it works


Truth Shield operates in three modes depending on what the user asks for:

### Mode 1: Verify After (default trigger)

The user says "verify this" or "fact-check this" after Claude has already made claims. Truth Shield retroactively checks the claims in Claude's previous response.

### Mode 2: Verify Before (passive mode)

The user says "shield on" and Truth Shield wraps around Claude's normal output. Every factual claim is checked before being presented. This is slower but catches errors before the user sees them.

### Mode 3: Spot Check

The user says "are you sure about X?" and Truth Shield checks that specific claim only.


---


## The verification pipeline


### Step 1: Claim extraction

Parse the response (or question) and extract every factual claim. A factual claim is any statement that is either true or false — not opinions, not recommendations, not subjective judgments.

**Hedged statements are not claims.** If a statement uses "I think", "probably", "might", "could", "I believe", "it's possible that", or similar hedging language, the speaker is already signalling uncertainty. Do not extract these as claims requiring verification — they are pre-classified as UNVERIFIED by their own language. Only extract statements presented as definite facts.

Categorise each extracted claim:

| Category | Example | Verification method |
|---|---|---|
| **Code claim** | "Function X exists at line Y" | Grep, Read, Glob — check the actual file |
| **API/library claim** | "React useEffect runs after render" | Context7 docs fetch, or web search |
| **Data claim** | "This table has 50k rows" | Run the query, check the file, read the data |
| **General knowledge** | "Python was created in 1991" | Cross-reference with web search |
| **Current state** | "The server is running on port 3001" | Check process list, read config |
| **Attribution** | "According to the docs, X does Y" | Read the actual docs and verify |

### Step 2: Source grounding

For each claim, attempt verification in this priority order:

1. **Local files** — Grep, Read, Glob. If the claim is about code, config, or project state, check the actual files. This is the highest-confidence source.

2. **Documentation** — If a Context7 or docs MCP is available, fetch the current documentation for the library/API being referenced. Training data may be outdated; live docs are ground truth.

3. **Web search** — If a WebSearch tool is available, search for the specific claim. Look for authoritative sources (official docs, RFCs, reputable references).

4. **Second model** — If the user has multi-model access (e.g., 9Router, multiple providers), re-query the same factual question to a different model. Agreement across models increases confidence; disagreement is a red flag.

5. **Reasoning check** — If no external source is available, apply logical consistency checks. Does the claim contradict other claims in the same response? Does it contradict known constraints?

**If a claim cannot be verified by any source, mark it as UNVERIFIED — do not present it as fact.**

**Always quote your evidence.** When marking a claim VERIFIED, include the specific line, passage, or search result that confirms it. "VERIFIED — React docs" is not enough. "VERIFIED — React docs state: `useEffect fires after the browser paints`" is. This makes every verification auditable — the user can see exactly what evidence you relied on, not just that you checked something.


### Step 3: Confidence scoring

Score each claim on a three-tier scale:

| Score | Meaning | How it's shown |
|---|---|---|
| **VERIFIED** | Confirmed by at least one authoritative source (file, docs, search) | No marker needed — presented normally |
| **UNVERIFIED** | Could not confirm or deny. No source available. | Flagged with `[unverified]` |
| **CONTRADICTED** | Source directly contradicts the claim | Flagged with `[CONTRADICTED]` and corrected |

### Step 4: Output

Present the verified response with inline annotations:

```
The `useEffect` hook runs after every render by default.
React 18 introduced automatic batching for state updates. [unverified — could not confirm via docs]
The `useSyncExternalStore` hook was added in React 16. [CONTRADICTED — added in React 18, see React docs]
```

For **Verify After** mode, present a verification report:

```
## Truth Shield Report

### Claims checked: 7
### Verified: 5
### Unverified: 1
### Contradicted: 1

| # | Claim | Verdict | Source |
|---|---|---|---|
| 1 | useEffect runs after render | VERIFIED | React docs via Context7 |
| 2 | React 18 added automatic batching | VERIFIED | React blog post |
| 3 | useSyncExternalStore added in React 16 | CONTRADICTED | Added in React 18 |
| ... | ... | ... | ... |

### Corrections
- **Claim 3**: `useSyncExternalStore` was introduced in React 18, not React 16. It was designed as a replacement for the `useMutableSource` hook that was never publicly released.

### Confidence summary
This response has a **71% verification rate**. 1 claim was actively wrong and has been corrected above.
```

For **Passive mode** (shield on), silently verify and only surface issues:

- If all claims verify: present the response normally with a small `[shield: all claims verified]` footer
- If any claims fail: present the response with inline `[unverified]` or `[CONTRADICTED]` markers and corrections at the bottom


---


## Verification strategies by domain


### Code verification

When Claude claims something about code (function exists, parameter accepted, return type, etc.):

```
1. Glob for the file
2. Read the file at the claimed location
3. Grep for the symbol name
4. If found: compare actual signature/behavior against claim
5. If not found: mark CONTRADICTED with "symbol not found in codebase"
```

**This is the highest-value check.** Claude confidently references functions that don't exist, parameters that were renamed, and line numbers that are wrong. Always verify code claims against the actual files.


### Documentation verification

When Claude claims something about a library, API, or framework:

```
1. If Context7 MCP available:
   a. First, load the tools: ToolSearch with query "select:mcp__context7__resolve-library-id,mcp__context7__query-docs"
   b. Then call resolve-library-id with the library name to get its ID
   c. Then call query-docs with the library ID and the specific claim as the query
   d. Compare the returned docs against the claim
2. If Context7 is not available but WebSearch is:
   a. First, load: ToolSearch with query "select:WebSearch"
   b. Search "[library] [specific feature]" targeting official docs
3. If WebFetch available: fetch the specific docs page and read it
4. Compare claim against what the docs actually say
```

Context7 and WebSearch are often deferred tools — they exist but their schemas aren't loaded until you call ToolSearch. If you try to call them directly without loading first, you'll get an InputValidationError. Always load via ToolSearch before first use.

**Key pattern:** Claude's training data has a cutoff. Libraries change. Always prefer live docs over Claude's memory.


### General knowledge verification

When Claude states a fact about the world:

```
1. If WebSearch available: search for the specific claim
2. Look for multiple independent sources confirming/denying
3. If sources disagree: mark as UNVERIFIED and present the disagreement
4. If no search available: mark as UNVERIFIED with "cannot verify without web access"
```

**Never mark general knowledge as VERIFIED based on Claude's own confidence.** Claude's confidence and accuracy are uncorrelated. A claim Claude states with certainty is not more likely to be true than one it hedges on.


### Multi-model verification

When a second model is available (via 9Router or multiple providers):

```
1. Extract the specific factual claim as a standalone question
2. Query the second model with: "Is the following statement true or false? [claim]. Cite your source."
3. If models agree: increases confidence (but doesn't guarantee truth — both could be wrong)
4. If models disagree: mark as UNVERIFIED and present both positions
```

**This is the only check that catches training-data-wide blind spots.** Different models have different training data and different failure modes. Disagreement between models is a high-value signal.


---


## Passive mode protocol


When the user says "shield on":

1. Acknowledge: `Truth Shield active. All factual claims will be verified before presenting.`
2. For every subsequent response in the session:
   a. Generate the response internally
   b. Extract all factual claims
   c. Run verification pipeline on each claim
   d. Present the response with any corrections applied inline
   e. Add footer: `[shield: X/Y claims verified, Z corrected]`
3. When the user says "shield off": `Truth Shield deactivated.`

**Performance note:** Passive mode is slower because every response goes through verification. Use it for high-stakes work (production deployments, client deliverables, documentation). For casual exploration, spot-checking is more efficient.


---


## What Truth Shield does NOT do

- **It does not verify opinions.** "React is better than Vue" is not a factual claim.
- **It does not verify predictions.** "This will scale to 1M users" is speculation, not fact.
- **It does not verify recommendations.** "You should use TypeScript" is advice, not a claim.
- **It does not make Claude omniscient.** If no source is available, the claim stays UNVERIFIED. That's the honest answer.
- **It does not guarantee 100% accuracy.** Sources can be wrong. Docs can be outdated. The goal is to go from "Claude said it confidently" to "Claude said it and here's the evidence."


---


## Important notes

- **Always check code claims against actual files.** This is the single highest-value verification. Claude fabricates function names, parameter signatures, and file paths with complete confidence.
- **Prefer live docs over Claude's memory.** If Context7 or web search is available, use it. Claude's training data has a cutoff and libraries change.
- **Disagreement between sources is valuable information.** Don't resolve it — present it. Let the user decide.
- **UNVERIFIED is not the same as WRONG.** It means "I couldn't confirm this." That's honest. Presenting unverified claims as verified is the problem Truth Shield exists to solve.
- **Speed vs accuracy tradeoff is the user's choice.** Passive mode (shield on) is thorough but slow. Spot checking (are you sure about X?) is fast but narrow. The user picks their mode.
- **Never skip verification because you're confident.** Claude's confidence is not correlated with accuracy. The whole point of Truth Shield is that confidence without evidence is worthless.
