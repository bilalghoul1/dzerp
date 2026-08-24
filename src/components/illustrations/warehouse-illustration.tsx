import * as React from "react";

/**
 * SVG illustration for empty warehouse / inventory.
 * Line-art, currentColor-driven, scales cleanly, RTL/light/dark safe.
 */
export function WarehouseIllustration({
  className,
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-label="warehouse"
    >
      <path d="M24 54 60 30l36 24v42H24z" />
      <path d="M40 96V66h40v30" />
      <path d="M52 96V78h16v18" />
      <path d="M30 44h12M78 44h12" opacity={0.55} />
    </svg>
  );
}
