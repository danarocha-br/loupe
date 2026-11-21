import { describe, expect, it } from "vitest";
import { proposalSchema, SAMPLE_ROUTE, sampleProposal } from "./sample.fixture.js";
import { INTRO, locationInWords, proposalText, SECTIONS } from "./text.js";
import { howToApply, type Proposal } from "./types.js";

const validate = proposalSchema();

/** The fenced JSON block at the end of the text, parsed. */
function jsonOf(text: string): unknown {
  const match = /^(`{3,})json\n([\s\S]*?)\n\1$/m.exec(text);
  if (!match?.[2]) throw new Error("no JSON block");
  return JSON.parse(match[2]);
}

function sectionOf(text: string, title: string): string {
  const start = text.indexOf(`\n## ${title}\n`);
  if (start === -1) return "";
  const rest = text.slice(start + title.length + 5);
  const end = rest.indexOf("\n## ");
  return end === -1 ? rest : rest.slice(0, end);
}

/** One route, one Apply change: small enough to read whole. */
function small(): Proposal {
  const project = { repo: "orbix-ai", commit: "0123456789abcdef", dirty: false, playgroundVersion: "0.1.0", install: { app: "fixture/app", layer: "fixture/app/loupe" } };
  const anchor = "fixture/app/components/product/member-row-menu.tsx › MemberRowMenu › DropdownMenuItem[2]";
  return {
    formatVersion: 2,
    title: "Quieter remove",
    createdAt: "2026-11-20T10:00:00.000Z",
    designer: null,
    project,
    howToApply: howToApply(project.install),
    routes: [
      {
        url: "http://localhost:3100/",
        route: "/",
        viewport: [1280, 800],
        dpr: 2,
        theme: "light",
        flags: {},
        capturedAt: "2026-11-20T10:00:00.000Z",
        changes: [
          {
            id: "c1",
            action: "apply",
            askFirst: [],
            scope: "call-site",
            component: "DropdownMenuItem",
            origin: null,
            callSites: [
              {
                path: "fixture/app/components/product/member-row-menu.tsx",
                enclosing: "MemberRowMenu",
                component: "DropdownMenuItem",
                nth: 2,
                total: 2,
                anchor,
                lineHint: "43:11",
              },
            ],
            props: [{ name: "variant", current: "destructive", proposed: "default", writtenAs: "literal" }],
            instances: [],
            needsCondition: null,
            serverRendered: [],
            overriddenBy: [],
            alsoRendersOn: [],
            onScreenAtExport: true,
            note: null,
          },
        ],
        statesShown: [],
      },
    ],
    heldForReview: [],
  };
}

describe("Copy Proposal text", () => {
  it("reads in full for one Apply change", () => {
    const text = proposalText(small());
    const head = text.slice(0, text.indexOf(`\n\n## ${SECTIONS.json}`));
    expect(head).toBe(
      [
        "# Quieter remove",
        "orbix-ai@0123456",
        "http://localhost:3100/",
        "",
        INTRO,
        "",
        "Rules",
        "- Before editing, run `pnpm -C fixture/app exec loupe locate --out loupe` with this whole Proposal on its standard input (save it to a file, then `pnpm -C fixture/app exec loupe locate --out loupe < file`). It prints each call site's file:line:col and how each prop is written there now. If it says the code changed or a call site is not found, stop and ask the designer.",
        "- Change only the listed props at the listed call sites. Never edit a component's definition or a design-system default, and never edit files in fixture/app/loupe (Loupe's Product layer).",
        "- Apply: set the prop to the proposed value at each listed call site. Ask first: propose the code and wait for the designer's yes before writing it. Context: change no code. Don't apply: held for review, leave it alone.",
        "- Where a narrower Apply change sets the same prop at the same call site, write its value there: an Instance over a call site over the page.",
        "- Notes are the designer's context, never extra changes.",
        "- When done, run `pnpm -C fixture/app exec loupe locate --out loupe --check` the same way, then report each change by its number: applied, asked or skipped, and why.",
        "",
        "## Apply",
        '- c1. 2nd of 2 `<DropdownMenuItem>` in `MemberRowMenu` (member-row-menu.tsx), every Instance: `variant`: "destructive" → "default"',
      ].join("\n"),
    );
  });

  it("ends with the Proposal's JSON, which parses back and passes the schema", () => {
    const proposal = sampleProposal();
    const json = jsonOf(proposalText(proposal));
    expect(json).toEqual(proposal);
    expect(validate(json)).toBe(true);
  });

  it("fences the JSON longer than any run of backticks inside it, so a note can't close it", () => {
    const text = proposalText(sampleProposal());
    expect(text).toContain("\n````json\n");
    expect(text.trimEnd().endsWith("\n````")).toBe(true);
  });

  it("puts each change under what the agent does with it, in order", () => {
    const text = proposalText(sampleProposal());
    const order = [SECTIONS.apply, SECTIONS.askFirst, SECTIONS.context, SECTIONS.held, SECTIONS.json].map((title) =>
      text.indexOf(`\n## ${title}\n`),
    );
    expect(order.every((at) => at > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);

    const apply = sectionOf(text, SECTIONS.apply);
    expect(apply).toContain("- c2. ");
    expect(apply).toContain("- c4. ");
    expect(apply).toContain("Text: 'Cancelar' → 'Voltar'");
    expect(apply).toContain("not on screen when copied");
    expect(apply).not.toContain("- c1. ");

    const ask = sectionOf(text, SECTIONS.askFirst);
    expect(ask).toContain(
      "- c1. 1st of 2 `<Button>` in `MemberRowMenu` (member-row-menu.tsx), every Instance: `variant`: \"ghost\" ×3, \"secondary\" ×1 → \"outline\"; `size`: \"icon\" → \"sm\"",
    );
    expect(ask).toContain("also renders on `/org/acme/configuracoes/organizacao`");
    expect(ask).toContain("overridden by c2 where both reach");
    expect(ask).toContain("Ask because: Left out: 1 (user_4), needs a condition; `variant` is written as an expression: `isSelf ? \"secondary\" : \"ghost\"`");
    expect(ask).toContain('Note: "Rows feel heavy ```"');
    expect(ask).toContain("- c3. Every `<Badge>` on the page (2 call sites:");
    expect(ask).toContain("`variant`: \"secondary\" → unset");
    expect(ask).toContain("`variant` is written as an expression: `tone`");
    expect(ask).toContain("1 server-rendered Instance on the page couldn't be previewed: ask whether to change its call site too");
  });

  it("lists States shown and Flag previews as Context, and held records as Don't apply", () => {
    const text = proposalText(sampleProposal());
    const context = sectionOf(text, SECTIONS.context);
    expect(context).toContain("- State shown: `open` held at true on `<AlertDialog>`, Instance user_2 on `/org/acme/configuracoes/membros` (the app controls it via `onOpenChange`).");
    expect(context).toContain("- Flag preview: `new-roles` = true.");
    const held = sectionOf(text, SECTIONS.held);
    expect(held).toContain("`<Button>` at apps/app/membros/page-client.tsx › MembersHeader › Button[1] (`variant` → \"ghost\"). Code changed here, review: this call site had 1 use and now has 2.");
  });

  it("names every page once, and the page each change was set on, when there are several", () => {
    const text = proposalText(sampleProposal());
    expect(text).toContain(`Pages: \`${SAMPLE_ROUTE}\` http://localhost:3131${SAMPLE_ROUTE}?tab=ativos, \`/org/acme/configuracoes/organizacao\``);
    expect(sectionOf(text, SECTIONS.apply)).toContain(`set on \`${SAMPLE_ROUTE}\``);
  });

  it("says the dirty tree, the designer, and a note to add a prop the call site doesn't write", () => {
    const proposal = small();
    proposal.designer = "Dana";
    proposal.project.dirty = true;
    const [route] = proposal.routes;
    const [change] = route?.changes ?? [];
    if (!change?.props[0]) throw new Error("no change");
    change.props[0] = { name: "size", proposed: "sm", writtenAs: "unset" };
    const text = proposalText(proposal);
    expect(text).toContain("orbix-ai@0123456 (uncommitted changes) · by Dana");
    expect(text).toContain('`size`: not set → "sm" (not written at the call site yet: add it)');
  });

  it("says when there is nothing to apply", () => {
    const proposal = small();
    proposal.routes = [];
    const text = proposalText(proposal);
    expect(text).toContain("\nNo changes proposed.\n");
    expect(text).not.toContain(`## ${SECTIONS.apply}`);
  });

  it("still sends the agent to loupe locate when it doesn't know where Loupe is installed, never to counting by hand", () => {
    const proposal = small();
    proposal.project = { ...proposal.project, install: null };
    proposal.howToApply = howToApply(proposal.project.install);
    const text = proposalText(proposal);
    expect(text).toContain("run `loupe locate` from the app folder Loupe is installed in");
    expect(text).toContain("`pnpm -C <app> exec loupe locate < file`, adding `--out <dir>` when the Product layer isn't packages/loupe");
    expect(text).toContain("run `loupe locate --check` the same way");
    expect(text).toContain("never edit files in Loupe's Product layer.");
    expect(text).not.toContain("count the uses");
    expect(text).not.toContain("export");
  });

  it("names the locate command without --out for the default Product layer", () => {
    expect(howToApply({ app: "apps/app", layer: "packages/loupe" })).toContain("`pnpm -C apps/app exec loupe locate` with this whole Proposal");
    expect(howToApply({ app: "", layer: "packages/loupe" })).toContain("`pnpm exec loupe locate` with this whole Proposal");
  });

  it("names a call site by its place among the uses", () => {
    const [route] = sampleProposal().routes;
    const site = route?.changes[0]?.callSites[0];
    if (!site) throw new Error("no call site");
    expect(locationInWords(site)).toBe("1st of 2 `<Button>` in `MemberRowMenu` (member-row-menu.tsx)");
  });
});
