/**
 * Inline SVG icon components — zero external dependencies.
 *
 * Each icon mirrors the lucide-react viewBox (0 0 24 24) and stroke style.
 * Consumers can override size via the `size` prop; color follows `currentColor`.
 *
 * Key design: every icon passes its shapes inside a single React Fragment,
 * so the `<svg>` has exactly one child — no key warnings, ever.
 */

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

const defaults: IconProps = {
  size: 16,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function icon(props: IconProps, children: React.ReactNode) {
  const { size = defaults.size, ...rest } = props;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={defaults.fill}
      stroke={defaults.stroke}
      strokeWidth={defaults.strokeWidth}
      strokeLinecap={defaults.strokeLinecap}
      strokeLinejoin={defaults.strokeLinejoin}
      {...rest}
    >
      {children}
    </svg>
  );
}

/* ── Navigation ── */

export function ChevronLeftIcon(props: IconProps) {
  return icon(props, <path d="m15 18-6-6 6-6" />);
}

export function ChevronRightIcon(props: IconProps) {
  return icon(props, <path d="m9 18 6-6-6-6" />);
}

export function ChevronDownIcon(props: IconProps) {
  return icon(props, <path d="m6 9 6 6 6-6" />);
}

export function ShieldCheckIcon(props: IconProps) {
  return icon(
    props,
    <>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </>,
  );
}

export function ZapIcon(props: IconProps) {
  return icon(props, <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />);
}

/* ── Actions ── */

export function DownloadIcon(props: IconProps) {
  return icon(
    props,
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </>,
  );
}

export function CopyIcon(props: IconProps) {
  return icon(
    props,
    <>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </>,
  );
}

export function CheckIcon(props: IconProps) {
  return icon(props, <path d="M20 6 9 17l-5-5" />);
}

export function SearchIcon(props: IconProps) {
  return icon(
    props,
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>,
  );
}

export function WrapTextIcon(props: IconProps) {
  return icon(
    props,
    <>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="15" y2="18" />
      <path d="M18 14.5a2.5 2.5 0 0 1 0 5" />
    </>,
  );
}

export function ExternalLinkIcon(props: IconProps) {
  return icon(
    props,
    <>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </>,
  );
}

/* ── Zoom & Rotate ── */

export function ZoomInIcon(props: IconProps) {
  return icon(
    props,
    <>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </>,
  );
}

export function ZoomOutIcon(props: IconProps) {
  return icon(
    props,
    <>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </>,
  );
}

export function RotateCwIcon(props: IconProps) {
  return icon(
    props,
    <>
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </>,
  );
}

export function Maximize2Icon(props: IconProps) {
  return icon(
    props,
    <>
      <path d="M15 3h6v6" />
      <path d="M9 21H3v-6" />
      <path d="M21 3l-7 7" />
      <path d="M3 21l7-7" />
    </>,
  );
}

export function Minimize2Icon(props: IconProps) {
  return icon(
    props,
    <>
      <path d="M8 3v3a2 2 0 0 1-2 2H3" />
      <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
      <path d="M3 16h3a2 2 0 0 1 2 2v3" />
      <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
    </>,
  );
}

/* ── View modes ── */

export function EyeIcon(props: IconProps) {
  return icon(
    props,
    <>
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </>,
  );
}

export function Code2Icon(props: IconProps) {
  return icon(
    props,
    <>
      <path d="m18 16 4-4-4-4" />
      <path d="m6 8-4 4 4 4" />
      <path d="m14.5 4-5 16" />
    </>,
  );
}

export function Columns2Icon(props: IconProps) {
  return icon(
    props,
    <>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <line x1="12" y1="3" x2="12" y2="21" />
    </>,
  );
}

export function Grid3X3Icon(props: IconProps) {
  return icon(
    props,
    <>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </>,
  );
}

export function ListIcon(props: IconProps) {
  return icon(
    props,
    <>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </>,
  );
}

export function Table2Icon(props: IconProps) {
  return icon(
    props,
    <>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </>,
  );
}

export function MonitorIcon(props: IconProps) {
  return icon(
    props,
    <>
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </>,
  );
}

export function LayoutGridIcon(props: IconProps) {
  return icon(
    props,
    <>
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </>,
  );
}

/* ── Alerts & Status ── */

export function AlertTriangleIcon(props: IconProps) {
  return icon(
    props,
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>,
  );
}

export function AlertCircleIcon(props: IconProps) {
  return icon(
    props,
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </>,
  );
}

export function ImageOffIcon(props: IconProps) {
  return icon(
    props,
    <>
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M10.41 10.41a2 2 0 1 1-2.83-2.83" />
      <line x1="13.5" y1="13.5" x2="17" y2="17" />
      <path d="M8.5 17H5a2 2 0 0 1-2-2V5a2 2 0 0 1 .59-1.42" />
      <path d="M18.42 5.58A2 2 0 0 1 21 7v8.86" />
      <path d="M22 17H14.5" />
      <path d="m2 2 20 20" />
    </>,
  );
}

export function MessageSquareIcon(props: IconProps) {
  return icon(props, <path d="M20 7v7a2 2 0 0 1-2 2H6l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2" />);
}

/* ── File & Folder ── */

export function FileIcon(props: IconProps) {
  return icon(
    props,
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </>,
  );
}

export function FolderIcon(props: IconProps) {
  return icon(props, <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />);
}

export function FolderOpenIcon(props: IconProps) {
  return icon(props, <path d="m6 14 1.5-2.8A2 2 0 0 1 9.4 10H20a2 2 0 0 1 1.95 2.518l-1.992 7A2 2 0 0 1 18.008 21H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4.928a2 2 0 0 1 1.69.9l.814 1.1A2 2 0 0 0 13.116 6H20a2 2 0 0 1 2 2v3" />);
}

export function BookOpenIcon(props: IconProps) {
  return icon(
    props,
    <>
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-5a4 4 0 0 0-4 4 4 4 0 0 0-4-4z" />
    </>,
  );
}

/* ── Sort ── */

export function ArrowUpDownIcon(props: IconProps) {
  return icon(
    props,
    <>
      <path d="m21 16-4 4-4-4" />
      <path d="M17 20V4" />
      <path d="m3 8 4-4 4 4" />
      <path d="M7 4v16" />
    </>,
  );
}

/* ── Close ── */

export function XIcon(props: IconProps) {
  return icon(
    props,
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>,
  );
}
