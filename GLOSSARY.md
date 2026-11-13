# Loupe

A dev-only tool for designers: it inspects and overrides the props of real components in a running Next.js app, then hands engineering a Proposal. It installs into a product's repo and never reaches a production build.

## Components on the page

**Instance**:
One rendered occurrence of a design-system or app component on the page.
_Avoid_: element, node

**Call site**:
The place in the source where a component is drawn: the file, the component that draws it, and which use it is there. Every Instance drawn there shares it.
_Avoid_: usage, location

**Anchor**:
The stable name of a call site. It survives edits to the file around it.
_Avoid_: selector, id

**Hint**:
The line and column of a call site. People see it, but nothing is identified by it.
_Avoid_: anchor

**Adapter**:
The generated stand-in for a component module that lets its Instances take Overrides.
_Avoid_: wrapper, proxy

**Unadapted Instance**:
An Instance rendered in the browser from an anchored call site, but with no Adapter, so it is inspect only. Loupe finds it by walking React's tree.

**Server-rendered Instance**:
An Instance a Server Component rendered. Loupe finds it through React's development record of the Server Component, and never overrides it.

**Inspect only**:
An Instance that can be inspected but not overridden: it has no Adapter, it rendered on the server, or Overrides are off for the page.

**State prop**:
A prop the app controls through a change handler, such as `open` with `onOpenChange`. It can be held on one Instance only.

## Changes

**Override**:
A value a designer sets for a prop, in the browser only, in place of the app's own value until it is reset.
_Avoid_: edit, patch

**Scope**:
How far an Override reaches: This instance, every Instance of a call site, or All on page. The narrowest scope wins.

**Flag preview**:
A feature-flag value forced for this browser through the Flags SDK's override cookie.

**Snapshot**:
A before-and-after capture of the page, or a close-up of one change. It goes out of date once a value it showed changes.

**Proposal**:
The record of a designer's Overrides, Flag previews and Snapshots, handed to engineering. The HTML report and the Markdown summary are renderings of it.
_Avoid_: report, export

## Install

**Product layer**:
The package Loupe creates in the product's repo. It holds the generated Adapters, the prop metadata and the ledger.
_Avoid_: Loupe folder

**Touch point**:
One of the product's own files, outside the Product layer, that the install edits. There are at most four.
_Avoid_: integration point, hook

**Ledger**:
The record of every touch point and Product layer file Loupe wrote, and of the Loupe version that wrote them, so Loupe can tell its own work from anyone else's.
_Avoid_: manifest, lockfile

**Adopt**:
To record a Loupe edit that a person made by hand, after the install asked for a manual step.

**Upgrade**:
Moving an install to a newer Loupe version. An install never moves to an older one.
_Avoid_: update, migrate

### What Loupe concludes about a file it may have written

**Intact**:
Loupe wrote it, and it is unchanged since.

**Drift**:
Loupe wrote it, and it was changed by hand since.
_Avoid_: modified, dirty (dirty means uncommitted in git)

**Missing**:
The ledger says Loupe wrote it, but it is gone.

**Pending**:
A manual step the install asked for, not adopted yet.

**Unclaimed**:
A Loupe edit is there, but the ledger has no record of it.
_Avoid_: unrecorded (a call site with no record of what it writes)

**Not Loupe's**:
Nothing records or marks it as Loupe's work.
_Avoid_: foreign, external

**Unrecognised**:
A recorded touch point that no longer points at the file it was recorded in.
