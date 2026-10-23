"use client";

import { memo, useState, type CSSProperties } from "react";
import { optimizedPhotoUrl } from "@/lib/images";

export const PlayerAvatar = memo(function PlayerAvatar({
  src,
  name,
  size = 40,
  className = "",
  eager = false
}: {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const source = [optimizedPhotoUrl(src, size * 2), src].find((url) => url && !failed.has(url));
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => Array.from(part)[0])
      .join("")
      .toUpperCase() || "FC";

  return (
    <span
      className={`player-avatar ${className}`}
      style={{ "--avatar-size": `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      {source ? (
        <img
          src={source}
          width={size}
          height={size}
          alt=""
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          onError={() => setFailed((current) => new Set(current).add(source))}
        />
      ) : (
        initials
      )}
    </span>
  );
});
