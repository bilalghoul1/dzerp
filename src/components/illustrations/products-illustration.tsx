import * as React from "react";

/**
 * SVG illustration for empty product lists.
 * Line-art, currentColor-driven, scales cleanly, RTL/light/dark safe.
 */
export function ProductsIllustration({
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
      aria-label="products"
    >
      <path d="M60 24 28 42v36l32 18 32-18V42z" />
      <path d="M28 42l32 18 32-18" />
      <path d="M60 60v36" />
      <path d="M44 33 76 51" opacity={0.55} />
    </svg>
  );
}
