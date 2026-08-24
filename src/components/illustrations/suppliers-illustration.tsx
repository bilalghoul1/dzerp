import * as React from "react";

/**
 * SVG illustration for empty supplier lists.
 * Line-art, currentColor-driven, scales cleanly, RTL/light/dark safe.
 */
export function SuppliersIllustration({
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
      aria-label="suppliers"
    >
      <path d="M34 40c-6 0-11 4-11 10v22c0 4 3 7 7 7h2V44c0-2 2-4 5-4" />
      <path d="M86 40c6 0 11 4 11 10v22c0 4-3 7-7 7h-2V44c0-2-2-4-5-4" />
      <path d="M44 66h14l5 12 5-12h14" />
      <path d="M40 92h40" />
    </svg>
  );
}
