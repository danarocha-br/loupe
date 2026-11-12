// The Toolbar's icons, from the 2e sketch (PER-140). Stroked in `currentColor`, so
// each takes its colour from the button it sits in, in light and dark.

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
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const DownloadIcon = () => (
  <Icon>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" strokeWidth="2" />
  </Icon>
);

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
  <Icon size={18}>
    <circle cx="12" cy="12" r="9.25" strokeWidth="1.5" />
    <path d="M7.5 12h9" strokeWidth="1.5" />
  </Icon>
);

export const CheckIcon = ({ size = 12 }: { size?: number }) => (
  <Icon size={size}>
    <path d="M5 12.5l4.5 4.5L19 7.5" strokeWidth="2.25" />
  </Icon>
);

export const ChevronIcon = () => (
  <Icon>
    <path d="M9 6l6 6-6 6" />
  </Icon>
);

export const CursorIcon = () => (
  <svg className="icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M5 3.5l13 7-6 1.6-2.6 5.9z" fill="currentColor" />
  </svg>
);

export const LayersIcon = () => (
  <Icon size={18}>
    <path d="M12 3l9 5-9 5-9-5z" />
    <path d="M3 13l9 5 9-5" />
  </Icon>
);

export const PanelIcon = () => (
  <Icon size={18}>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="M12 5v14" />
  </Icon>
);

export const CaptureIcon = () => (
  <Icon size={18}>
    <path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3" />
    <circle cx="12" cy="12" r="3" />
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
