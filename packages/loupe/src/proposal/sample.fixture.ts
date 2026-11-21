// A Membros Proposal as an agent or an engineer would receive it: one change of each
// scope, a label text change, a State shown, a held record, a flag preview and a
// second route. Shared by the Copy Proposal tests; the actions and their reasons come
// from the builder's own `askFirstOf`, so the sample can't disagree with it.

import { readFileSync } from "node:fs";
import { URL as NodeUrl } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { callSiteId, instanceId } from "../call-site.js";
import { askFirstOf } from "./build.js";
import { howToApply, type Proposal, type ProposalChange } from "./types.js";

export const SAMPLE_ROUTE = "/org/acme/configuracoes/membros";
export const SAMPLE_FILE = "apps/app/components/product/member-row-menu.tsx";
const siteAt = (path: string, enclosing: string, component: string, ordinal = 1) => callSiteId({ path, enclosing, component, ordinal });
const TRIGGER = siteAt(SAMPLE_FILE, "MemberRowMenu", "Button");

type Unacted = Omit<ProposalChange, "action" | "askFirst">;

function acted(change: Unacted): ProposalChange {
  const askFirst = askFirstOf(change);
  const { id, ...rest } = change;
  return { id, action: askFirst.length > 0 ? "ask-first" : "apply", askFirst, ...rest };
}

export function sampleProposal(): Proposal {
  const project = { repo: "orbix-ai", commit: "0123456789abcdef", dirty: true, playgroundVersion: "0.0.3", install: { app: "apps/app", layer: "packages/loupe" } };
  return {
    formatVersion: 2,
    title: "Quieter member menus",
    createdAt: "2026-11-12T10:31:00.000Z",
    designer: "Dana",
    project,
    howToApply: howToApply(project.install),
    routes: [
      {
        url: `http://localhost:3131${SAMPLE_ROUTE}?tab=ativos`,
        route: SAMPLE_ROUTE,
        viewport: [1440, 900],
        dpr: 2,
        theme: "dark",
        flags: { "new-roles": true },
        capturedAt: "2026-11-12T10:30:00.000Z",
        changes: [
          acted({
            id: "c1",
            scope: "call-site",
            component: "Button",
            origin: null,
            callSites: [{ path: SAMPLE_FILE, enclosing: "MemberRowMenu", component: "Button", nth: 1, total: 2, anchor: TRIGGER, lineHint: "80:13" }],
            props: [
              {
                name: "variant",
                currentCounts: { '"ghost"': 3, '"secondary"': 1 },
                proposed: "outline",
                writtenAs: "expression",
                expression: 'isSelf ? "secondary" : "ghost"',
              },
              { name: "size", current: "icon", proposed: "sm", writtenAs: "literal" },
            ],
            instances: [
              { id: instanceId(TRIGGER, "user_1"), keyPath: "user_1", included: true, onScreenAtExport: true },
              { id: instanceId(TRIGGER, "user_2"), keyPath: "user_2", included: true, onScreenAtExport: true },
              { id: instanceId(TRIGGER, "user_4"), keyPath: "user_4", included: false, onScreenAtExport: true },
            ],
            needsCondition: "Left out: 1 (user_4), needs a condition",
            serverRendered: [],
            overriddenBy: ["c2"],
            alsoRendersOn: ["/org/acme/configuracoes/organizacao"],
            onScreenAtExport: true,
            note: "Rows feel heavy ```",
          }),
          acted({
            id: "c2",
            scope: "instance",
            component: "AlertDialogCancel",
            origin: null,
            callSites: [
              {
                path: SAMPLE_FILE,
                enclosing: "MemberRowMenu",
                component: "AlertDialogCancel",
                nth: 1,
                total: 1,
                anchor: siteAt(SAMPLE_FILE, "MemberRowMenu", "AlertDialogCancel"),
                lineHint: "118:9",
              },
            ],
            props: [{ name: "children", current: "Cancelar", proposed: "Voltar", writtenAs: "literal" }],
            instances: [{ id: instanceId("x", "user_2"), keyPath: "user_2", included: true, onScreenAtExport: false }],
            needsCondition: null,
            serverRendered: [],
            overriddenBy: [],
            alsoRendersOn: [],
            onScreenAtExport: false,
            note: null,
          }),
          acted({
            id: "c3",
            scope: "page",
            component: "Badge",
            origin: null,
            callSites: [
              { path: "apps/app/settings-header.tsx", enclosing: "SettingsHeader", component: "Badge", nth: 1, total: 2, anchor: siteAt("a", "SettingsHeader", "Badge", 1), lineHint: "80:13" },
              { path: "apps/app/settings-header.tsx", enclosing: "SettingsHeader", component: "Badge", nth: 2, total: 2, anchor: siteAt("a", "SettingsHeader", "Badge", 2), lineHint: null },
            ],
            props: [
              {
                name: "variant",
                current: "secondary",
                proposedUnset: true,
                writtenAs: "varies",
                perCallSite: [
                  { anchor: siteAt("a", "SettingsHeader", "Badge", 1), writtenAs: "literal" },
                  { anchor: siteAt("a", "SettingsHeader", "Badge", 2), writtenAs: "expression", expression: "tone" },
                ],
              },
            ],
            instances: [],
            needsCondition: null,
            serverRendered: [{ id: instanceId("b", "user_1"), anchor: siteAt("apps/app/membros/page.tsx", "MembersTable", "Badge"), keyPath: "user_1" }],
            overriddenBy: [],
            alsoRendersOn: [],
            onScreenAtExport: true,
            note: null,
          }),
          acted({
            id: "c4",
            scope: "call-site",
            component: "DropdownMenuItem",
            origin: null,
            callSites: [
              {
                path: SAMPLE_FILE,
                enclosing: "MemberRowMenu",
                component: "DropdownMenuItem",
                nth: 2,
                total: 2,
                anchor: siteAt(SAMPLE_FILE, "MemberRowMenu", "DropdownMenuItem", 2),
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
          }),
        ],
        statesShown: [
          {
            anchor: siteAt(SAMPLE_FILE, "MemberRowMenu", "AlertDialog"),
            component: "AlertDialog",
            keyPath: "user_2",
            prop: "open",
            forced: true,
            controlled: true,
            appControlsVia: "onOpenChange",
            onScreenAtExport: true,
          },
        ],
      },
      {
        url: null,
        route: "/org/acme/configuracoes/organizacao",
        viewport: null,
        dpr: null,
        theme: null,
        flags: { "new-roles": true },
        capturedAt: null,
        changes: [],
        statesShown: [],
      },
    ],
    heldForReview: [
      {
        scope: "call-site",
        component: "Button",
        anchor: siteAt("apps/app/membros/page-client.tsx", "MembersHeader", "Button"),
        route: SAMPLE_ROUTE,
        reason: "code-changed",
        detail: "Code changed here, review: this call site had 1 use and now has 2",
        props: [{ name: "variant", proposed: "ghost" }],
      },
    ],
  };
}

/** The published schema, compiled the way the builder's tests compile it. */
export function proposalSchema(): (data: unknown) => boolean {
  const schema = JSON.parse(readFileSync(new NodeUrl("../../proposal.schema.json", import.meta.url), "utf8")) as object;
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true });
  addFormats.default(ajv);
  return ajv.compile(schema);
}
