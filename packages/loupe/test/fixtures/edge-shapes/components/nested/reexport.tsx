export { Alert } from "../shapes";

export function Plain() {
  return null;
}

// Both a value and a type under one name: an Adapter must re-export the value.
// The type comes first, so a reader taking the first declaration gets it wrong.
export type Size = keyof typeof Size;
export const Size = { sm: "sm", lg: "lg" } as const;

// A component that is also a type: its Adapter could not re-export the type.
export interface Panel {
  open?: boolean;
}
export function Panel(props: Panel) {
  return props.open ? null : null;
}
