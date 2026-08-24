import * as React from "react";

/**
 * SVG illustration for empty commercial documents.
 * Line-art, currentColor-driven, scales cleanly, RTL/light/dark safe.
 */
export function DocumentsIllustration({
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
      aria-label="documents"
    >
      <path d="M36 22h30l18 18v58H36z" />
      <path d="M66 22v18h18" />
      <path d="M46 58h28M46 70h28M46 82h18" opacity={0.7} />
    </svg>
  );
}
