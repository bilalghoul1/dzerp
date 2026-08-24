"use client";

import * as React from "react";
import Image from "next/image";

/**
 * Premium marketing illustration wrapper using next/image.
 * - responsive via `fill` + intrinsic aspect ratio container
 * - hero (priority) loads eagerly with high fetch priority for LCP
 * - below-fold scenes lazy-load automatically (next/image default)
 * - `fillParent` makes the image fill an absolutely-positioned parent (e.g. CTA backdrop)
 */
export function SceneImage({
  src,
  alt,
  priority = false,
  aspect = "16/9",
  className = "",
  imgClassName = "",
  fillParent = false,
  sizes = "(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1100px",
}: {
  src: string;
  alt: string;
  priority?: boolean;
  aspect?: string;
  className?: string;
  imgClassName?: string;
  fillParent?: boolean;
  sizes?: string;
}) {
  if (fillParent) {
    return (
      <div className={`absolute inset-0 ${className}`}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes="100vw"
          priority={priority}
          decoding="async"
          className={`object-cover ${imgClassName}`}
          draggable={false}
        />
      </div>
    );
  }
  return (
    <div className={`relative w-full overflow-hidden ${className}`} style={{ aspectRatio: aspect }}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        decoding="async"
        className={`object-contain ${imgClassName}`}
        draggable={false}
      />
    </div>
  );
}
