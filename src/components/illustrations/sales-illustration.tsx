import * as React from "react";

/**
 * SVG illustration for sales / commercial activity.
 * Line-art, currentColor-driven, scales cleanly, RTL/light/dark safe.
 */
export function SalesIllustration({
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
      aria-label="sales"
    >
      <path d="M28 92V40M52 92V56M76 92V32M100 92V68" />
      <path d="M22 92h84" />
      <path d="M60 24l10 10-10 10" opacity={0.55} />
    </svg>
  );
}
