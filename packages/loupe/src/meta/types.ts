/** Bumped whenever the shape of a `meta/<source path>.json` file changes. */
export const META_FORMAT_VERSION = 1;

/**
 * Why a prop gets no control, in the Toolbar's mono-caps vocabulary (PER-84).
 * `children`'s per-call-site reasons (`FROM CODE`, `MIXED`) are decided by the
 * loader at the call site, never here.
 */
export type InspectReason =
  | "FUNCTION"
  | "CONTENT"
  | "OPEN TEXT"
  | "OBJECT"
  | "STRUCTURAL"
  | "LINKED PROPS"
  | "UNVERIFIED";

/** How far a closed option set can be trusted (PER-80). */
export type OptionStatus = "verified" | "verified-partial" | "type-only";

export type OptionValue = string | number | boolean;

export type DefaultValue =
  | { source: "destructure" | "defaultVariants"; value: OptionValue | null; expression?: string }
  | { source: "conflict"; value: OptionValue | null; defaultVariants: OptionValue | null }
  /** Declared by a primitive library whose runtime default we cannot read. */
  | { source: "unknown" };

type PropBase = {
  /** `repo` or the npm package that declares the prop. */
  from: string;
  default?: DefaultValue;
  /** Has an `on<Name>Change` sibling (PER-96). */
  state?: true;
};

export type EditableOptionsProp = PropBase & {
  editable: true;
  kind: "options";
  status: OptionStatus;
  options: OptionValue[];
  /** Present when the type and the variant config disagree. */
  mismatch?: { onlyInType: string[]; onlyInConfig: string[] };
};

/** `children` that accepts a string: editable where the call site writes one literal (PER-113). */
export type EditableTextProp = PropBase & { editable: true; kind: "text" };

export type InspectOnlyProp = PropBase & {
  editable: false;
  reason: InspectReason;
  /** Machine detail behind `UNVERIFIED`, e.g. a dynamic variant config. */
  detail?: string;
};

export type PropMeta = EditableOptionsProp | EditableTextProp | InspectOnlyProp;

export type ComponentShape =
  | "function"
  | "forwardRef"
  | "memo"
  | "class"
  | "lazy"
  /** `const Select = SelectPrimitive.Root`: another component under a new name. */
  | "alias"
  | "re-export"
  | "default-export"
  | "unknown";

export type ComponentExport = {
  kind: "component";
  shape: ComponentShape;
  generic?: true;
  props: Record<string, PropMeta>;
};

/** A helper value (`buttonVariants`, `useSidebar`) or a type an Adapter must re-export. */
export type OtherExport = { kind: "other" | "type" };

export type ModuleMeta = {
  formatVersion: number;
  engine: "ts-morph" | "react-docgen-typescript";
  /** POSIX path relative to the project root. */
  source: string;
  client: boolean;
  /** `sha256:<hex>` of every repo file read for this module, keyed by root-relative path. */
  files: Record<string, string>;
  exports: Record<string, ComponentExport | OtherExport>;
};
