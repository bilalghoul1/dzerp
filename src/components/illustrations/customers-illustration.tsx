import * as React from "react";

/**
 * SVG illustration for empty customer lists.
 * Line-art, currentColor-driven, scales cleanly, RTL/light/dark safe.
 */
export function CustomersIllustration({
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
      aria-label="customers"
    >
      <circle cx="42" cy="46" r="14" />
      <path d="M20 92c0-13 10-22 22-22s22 9 22 22" />
      <circle cx="84" cy="54" r="10" />
      <path d="M70 92c0-10 6-16 14-16s14 6 14 16" />
      <path d="M96 18v22M85 29h22" opacity={0.55} />
    </svg>
  );
}
