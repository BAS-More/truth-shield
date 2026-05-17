# Truth Shield

Claude sometimes states things confidently that turn out to be wrong. It invents function names, gets API details outdated, and presents guesses as facts. You have no way to tell which parts of a response are reliable and which are fabricated — unless you check every claim yourself.

Truth Shield is a Claude Code skill that checks for you. It verifies Claude's factual claims against real sources — your actual code files, live documentation, web search results — and flags anything it can't confirm. You get a clear report showing what's grounded, what's unverified, and what's outright wrong.

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

**Example:**

> **You:** What port does Express default to?
>
> **Claude:** Express defaults to port 3000. The `app.listen()` method was added in Express 3.0 and accepts a callback as its second argument.
>
> **You:** verify this

> **Truth Shield Report**
>
> Claims checked: 3 · Verified: 2 · Contradicted: 1
>
> | # | Claim | Verdict | Evidence |
> |---|---|---|---|
> | 1 | Express defaults to port 3000 | VERIFIED | Express docs: "the app.listen() method binds and listens... if port is omitted or 0, the OS assigns an arbitrary port" — common convention is 3000 per getting-started guide |
> | 2 | app.listen() added in Express 3.0 | CONTRADICTED | Express changelog shows app.listen() existed since Express 1.x. Express 3.0 removed bundled middleware, not added listen. |
> | 3 | app.listen() accepts callback as second argument | VERIFIED | Express docs: "app.listen(port, callback)" — callback is the second parameter |
>
> **Corrections**
> - Claim 2: `app.listen()` has been part of Express since its earliest versions. Express 3.0 was a release that removed bundled middleware (like bodyParser), not one that added `listen()`.
>
> **Confidence: 67%** — 1 claim was actively wrong and has been corrected above.

### Mode 2: Shield On (continuous)

For high-stakes work — production deployments, client deliverables, documentation — where you need every response checked before you see it.

```
shield on
```

From that point on, every Claude response is silently verified. You'll see inline markers on anything that doesn't check out:

> **You:** shield on
>
> **Claude:** Truth Shield active. All factual claims will be verified before presenting.
>
> **You:** How does React's useMemo work?
>
> **Claude:** `useMemo` caches the result of a computation between re-renders. It takes a function and a dependency array. React re-runs the function only when a dependency changes. It was introduced in React 16.8 alongside hooks. `useMemo` guarantees the cached value is never stale. [CONTRADICTED — React docs state: "You may rely on useMemo as a performance optimization, not as a semantic guarantee. React may choose to forget previously memoized values."]
>
> [shield: 4/5 claims verified, 1 corrected]

Turn it off when you're done:

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

> **Claude:** Checking that claim against React documentation...
>
> **CONTRADICTED** — React docs state: "The function passed to useEffect will run after the render is committed to the screen." useEffect runs *after* render, not before. You may be thinking of `useLayoutEffect`, which fires synchronously after DOM mutations but before the browser paints.

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

## What gets checked (and what doesn't)

Truth Shield verifies **factual claims** — statements that are either true or false. It does NOT verify opinions, predictions, recommendations, creative writing, or subjective judgments.

### Verification capabilities depend on available tools

| Tools available | What Truth Shield can verify |
|---|---|
| **Grep + Read + Glob** (always available) | Code claims — function names, file paths, line numbers, signatures |
| **+ Context7 MCP** | Library and API claims — checked against live documentation |
| **+ WebSearch** | General knowledge, version numbers, release dates |
| **+ Second model** (via multi-provider setup) | Cross-model disagreement detection |
| **None of the above** | All claims marked UNVERIFIED — the report is honest about this |

Truth Shield uses whatever tools Claude has access to in the current session. If a tool isn't available, Truth Shield tells you what it couldn't check rather than silently skipping it.

---

## Confidence ratings

| Rating | Meaning |
|---|---|
| **VERIFIED** | Confirmed by at least one real source (file content, live docs, search result). Evidence is quoted. |
| **UNVERIFIED** | Could not confirm or deny. No source available, or claim is outside what the available tools can check. Not necessarily wrong — just not confirmed. |
| **CONTRADICTED** | A source directly contradicts the claim. The correction and source are provided. |

**Important:** Claude's own confidence is never treated as a source. A claim that Claude states with certainty is not more likely to be true. Truth Shield only marks claims VERIFIED when external evidence confirms them.

---

## Limitations

Truth Shield reduces hallucination risk. It does not eliminate it.

- **Sources can be wrong.** Docs can be outdated. Search results can be inaccurate. Truth Shield is evidence-based, not infallible.
- **UNVERIFIED ≠ wrong.** It means "I couldn't find evidence either way." Many true statements will be UNVERIFIED simply because no source was available to check.
- **Passive mode is slower.** Every response goes through verification. Use it for high-stakes work, not casual exploration.
- **It cannot verify predictions or opinions.** "This will scale to 1M users" and "React is better than Vue" are outside its scope.

The goal is to move from "Claude said it confidently" to "Claude said it, and here's the evidence." That's a meaningful improvement, not a guarantee.

---

## Credit

Built by [Avi Bendetsky](https://github.com/AviSoifer).

Inspired by the observation that Claude's confidence and accuracy are uncorrelated — and that the fix is evidence, not more confidence.

## License

MIT — see [LICENSE](./LICENSE).
