// Any `data-*` attribute a primitive passes through to its element: a view's hooks
// (`data-marks`, `data-hold`, `data-option`) and its tests'.
export type DataAttributes = { [name: `data-${string}`]: string | undefined };
