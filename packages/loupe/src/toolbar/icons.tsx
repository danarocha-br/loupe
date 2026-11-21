// The Toolbar's icons, from the 2e sketch (PER-140), with an arrow for Back since the
// 2026-11-19 critique. Stroked in `currentColor`, so each takes its colour from the
// button it sits in, in light and dark. Every stroke is 1.5px on screen at any size or
// viewBox (`vector-effect` in styles.ts, review 2026-11-20): one weight beside the text.

import type { ReactNode } from "react";

function Icon({ size = 16, children }: { size?: number; children: ReactNode }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const SunIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
  </Icon>
);

export const MoonIcon = () => (
  <Icon>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
  </Icon>
);

export const ResetIcon = ({ size = 14 }: { size?: number }) => (
  <Icon size={size}>
    <path d="M4 12a8 8 0 1 0 2.6-5.9" />
    <path d="M4 4v4.5h4.5" />
  </Icon>
);

export const BackIcon = () => (
  <Icon size={14}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Icon>
);

export const CheckIcon = ({ size = 12 }: { size?: number }) => (
  <Icon size={size}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icon>
);

export const ChevronIcon = () => (
  <Icon>
    <path d="M9 6l6 6-6 6" />
  </Icon>
);

/** Select one: the arrow, as the Revision Set comp draws it. */
export const CursorIcon = () => (
  <svg className="icon" width="18" height="18" viewBox="238 238 36 36" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
    <path d="M247.171 248.005l5.315 17.434c0.354 1.16 1.906 1.232 2.341 0.121l2.854-6.582c0.212-0.535 0.675-0.959 1.24-1.09l7.272-1.705c1.17-0.273 1.21-1.928 0.131-2.352l-17.597-7.366c-1.08-0.454-1.866 0.535-1.553 1.544z" />
  </svg>
);

/** Select all from a call site: two stacked frames and the arrow. */
export const SelectManyIcon = () => (
  <svg
    className="icon"
    width="18"
    height="18"
    viewBox="238 238 36 36"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M246.01 258.375h-1.007c-1.127 0-1.963-0.836-1.963-1.963v-10.776c0-1.127 0.836-2.008 2.008-2.008h12.877c1.127 0 2.027 0.836 2.026 2.008v0.785" />
    <path d="M254.293 264.224h-2.147c-1.127 0-1.976-0.868-1.976-1.995v-10.398c0-1.127 0.848-1.976 1.976-1.976h11.764c1.127 0 2.02 0.81 2.02 1.938v2.172" />
    <path d="M256.586 256.839l3.338 10.94c0.222 0.728 1.197 0.773 1.47 0.076l1.792-4.13c0.133-0.336 0.424-0.602 0.779-0.684l4.567-1.07c0.735-0.171 0.76-1.21 0.082-1.476l-11.051-4.622c-0.678-0.285-1.172 0.336-0.975 0.969z" />
  </svg>
);

/** Light or dark: a half-filled circle. */
export const ContrastIcon = () => (
  <svg className="icon" width="16" height="16" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
    <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M7 1.5A5.5 5.5 0 0 1 7 12.5Z" fill="currentColor" />
  </svg>
);

export const ArrowIcon = () => (
  <Icon size={16}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);

/**
 * A revision delta: the triangle a drawing's revision carries its number in, here
 * one change of the Proposal. Without `n` it is the bare triangle, for a number set
 * over it in HTML; `dashed`, empty, for a held state.
 */
export function Delta({ n, dashed = false }: { n?: number; dashed?: boolean }) {
  return (
    <svg className={dashed ? "delta dashed" : "delta"} width="20" height="18" viewBox="0 0 20 18" aria-hidden="true" focusable="false">
      <path d="M10 1.6 18.6 16.4H1.4Z" strokeLinejoin="round" />
      {n !== undefined && (
        <text x="10" y="14.2" textAnchor="middle">
          {n}
        </text>
      )}
    </svg>
  );
}

/** Hide marks, while the marks show: an eye. */
export const MarksIcon = () => (
  <Icon size={18}>
    <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="2.75" />
  </Icon>
);

/** Hide marks, while the marks are hidden: the eye, struck through. */
export const MarksHiddenIcon = () => (
  <Icon size={18}>
    <path d="M9.6 5.8A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.2 3M6.2 7.4C3.9 9.1 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.6 0 3-.5 4.2-1.1" />
    <path d="M10.1 10.1a2.75 2.75 0 0 0 3.8 3.8M4 4l16 16" />
  </Icon>
);

export const PanelIcon = () => (
  <Icon size={18}>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="M12 5v14" />
  </Icon>
);

export const CopyIcon = ({ size = 14 }: { size?: number }) => (
  <Icon size={size}>
    <rect x="8" y="8" width="12" height="12" rx="2.5" />
    <path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8" />
  </Icon>
);

export const ClockIcon = () => (
  <Icon size={14}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
);

export const InfoIcon = () => (
  <Icon size={14}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8h.01" />
  </Icon>
);

export const LockIcon = () => (
  <Icon size={12}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Icon>
);
