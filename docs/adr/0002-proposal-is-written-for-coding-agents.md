---
status: accepted
---

# A Proposal is written for the designer's coding agent, and Loupe checks what it applied

Loupe was built on the assumption that a designer hands a Proposal to engineering: an HTML report for an engineer to read, and a Markdown summary for a ticket. The designers the maintainer has watched or asked would rather paste the changes into their own coding agent. Most of them already have one in the product repo, since the Installer runs through Claude Code. orbix-ai already runs Agentation, whose MCP server hands UI feedback to the agent. So whoever applies a Proposal now, an agent reads it first. That includes the engineer, who pastes it into their own agent.

The Proposal was already half written for an agent. `HOW_TO_APPLY` reads like instructions, and the JSON names each call site by its anchor. Its weak point is the one step an agent gets wrong: "count the uses of `<Component>` in source order to the nth".

We decided:

- **An agent reads every Proposal first.** The design target is the designer who applies a Proposal with their own agent. An engineer's agent reads the same text.
- **Exact, not approximate, stays.** The agent gets only exact changes: a call site, a prop, a from → to value. The designer's notes are context, never extra instructions.
- **There are two ways to an agent.**
  - **Copy Proposal** replaces Export and Copy as Markdown. It keeps the dialog (a suggested title, a note per entry) and copies one text: short rules, one line per change, then the Proposal's JSON in a fenced block. It works with any agent, and for an engineer.
  - **Send to agent** posts a snapshot of the Proposal to a store in Loupe's dev-server integration. `loupe mcp`, which the Installer registers with Claude Code, gives the agent tools to read pending changes, locate them, reply, mark them applied or skipped, and watch for more. `/loupe:apply` is the plugin skill that drives those tools. It is a snapshot, not a live sync, so the agent applies what was sent while the designer keeps trying things.
- **`loupe locate` finds and checks call sites.** This read-only command takes a Proposal and reports, per change, the `file:line:col` of each call site, how the prop is written there now, and whether the count of uses still matches. The agent runs it before editing, and the check runs again after. The agent never counts uses itself.
- **Every entry is tagged for the agent:**
  - **Apply**: a literal value edit.
  - **Ask first**: it needs a condition (1 of N Instances from a call site, or Left out Instances), or the prop is written as an expression or a spread. The agent proposes the code and waits for the designer.
  - **Context**: States shown and Flag previews. Never edited.
  - **Don't apply**: Held for review.
- **All on page edits call sites, never a default.** The agent edits each listed call site and never the component's definition (a cva `defaultVariants`, for example). It may suggest a default change as a follow-up. `alsoRendersOn` is filled for page changes too, since a call-site edit reaches every page that draws that call site.
- **Each sent change has a status**, after Agentation's: Pending, Acknowledged, then Applied or Skipped, with the agent's reason for a skip. An Ask first question is a thread on the change's row in the panel, and the designer answers there. Applied comes from `loupe locate` finding the proposed value in the code, never from the agent's word alone. Applied changes collapse into one line and their Overrides are dropped. Nothing on the page moves, since the code now gives the same value. On the copy path, the panel marks a change "In code" when, after a Fast Refresh, the app's own value equals the Override.
- **There are no git steps.** As with Agentation, the agent edits the working tree. The skill warns before it edits a file with uncommitted changes. At the end it lists the files each change touched and offers a PR description written from the Proposal.
- **Engineers review**, from the diff and that description, or apply a Proposal a designer sends them.
- **Principle 5 is reworded.** The toolbar and the `loupe` command never edit product code. Code changes come only from the designer's own agent, at the listed call sites, never inside the Product layer (the plugin's guard hook stays), and with the designer's yes for any change that needs a decision.
- **The Proposal moves to `formatVersion` 2.** Screenshots were removed in place at version 1 because nothing read the JSON then. A skill and a command read it now, and its shape changes: the tags, and `alsoRendersOn` on page changes.

## Considered options

- **Keep the HTML report for engineers.** Rejected: an engineer pastes it into an agent too, and with screenshots gone the report is a styled list of the same lines. One text means one thing to keep exact. A secondary "Download report" link was rejected for the same reason.
- **Send intent and let the agent pick props.** Rejected: that competes with the agent at its own job. Exact call sites and values the designer saw working are the one thing Loupe adds.
- **Paste only.** Picked first, and kept as the path any agent can use. Send to agent was added after looking at Agentation: a designer who answers the agent next to the change, on the page, is better off than one switching to a terminal.
- **A file in the repo** (`.loupe/proposal.md`) for the agent to read. Rejected: exporting would start writing to the repo, and the MCP store does the same job without it.
- **Pull straight from the browser**, with a browser tool calling `__loupe.proposal()`. Rejected: it depends on each designer's browser setup.
- **Post Loupe's changes into Agentation's queue.** Rejected: its annotation format has no prop, value or anchor, so each change would become a free-text note for the agent to interpret. Loupe would also depend on a tool not every product runs.
- **A separate server on its own port**, as Agentation does. Rejected: Loupe already runs inside `next dev`, so its store lives there, with no port and no CORS.
- **A "Make this the default" choice** for page changes. Deferred: Loupe can't see the other pages a default reaches, so the change can't be exact. It can come later as its own feature, with that warning.
- **Let the agent handle conditions and expressions on its own judgment.** Rejected: that is where an agent invents a rule ("why only this row?"), and the designer is right there to answer.
- **Branch, commit and PR in the skill**, as the Installer does for an upgrade. Rejected: designers who can't open PRs would be blocked, and Agentation users already apply in the working tree.
- **Trust the agent's "done".** Rejected: Applied comes from the code check. That is where Loupe goes further than Agentation's resolve.

## Consequences

- **Order.** First: Copy Proposal, the tags, `formatVersion` 2, `alsoRendersOn` on page changes, and `loupe locate`. Second: the store, `loupe mcp`, the statuses and threads in the panel, and `/loupe:apply`.
- **Retired.** The HTML report (`src/proposal/report.ts` and its tests), its download, and Copy as Markdown, once Copy Proposal ships.
- **Where Overrides live.** Unsent Overrides still live only in the tab, and a reload drops them. A sent snapshot outlives a reload.
- **Docs.** PRODUCT.md changes with this note. GLOSSARY.md and the README describe what ships, so they change with the code: the Proposal's definition ("handed to engineering"), the new terms (Send to agent, Applied, Skipped, the four tags) and the README's step 7.
- **The Installer grows.** It registers `loupe mcp` and ships `/loupe:apply`, through which the designer's agent edits product code. Its guard on the Product layer stays.
- **One text, two readers.** The copied Markdown has to read well for a person too, for the engineer path.

## Open questions

- Can the designers who prompted this open PRs in their product repos? If most can't, the engineer path becomes the main one, and the copied text matters more than the MCP path.
- Does a sent snapshot survive a dev-server restart, or only a page reload?
- How does `loupe mcp`, started by the agent over stdio, reach the store in the dev server?
- The evidence is a handful of conversations, not written up. This would be proved wrong by designers who copy a Proposal and hand it to an engineer unread, or who never apply one themselves.
