"use client";

import { useState } from "react";

export function CartCount({ count }: { count: number }) {
  const [initial] = useState(count);
  if (count === 0) return null;

  return (
    <span key={count} className={`ml-1.5 ${count !== initial ? "tick" : ""}`} aria-hidden="true">
      ({count})
    </span>
  );
}
