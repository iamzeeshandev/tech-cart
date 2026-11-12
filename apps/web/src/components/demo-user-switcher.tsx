"use client";

import { useRouter } from "next/navigation";
import type { DemoUser } from "@/lib/api";
import { setDemoUser } from "@/lib/cart-client";

export function DemoUserSwitcher({
  users,
  currentUserId,
}: {
  users: DemoUser[];
  currentUserId?: string;
}) {
  const router = useRouter();

  return (
    <select
      aria-label="Demo user"
      defaultValue={currentUserId ?? ""}
      onChange={(event) => {
        setDemoUser(event.target.value);
        router.refresh();
      }}
      className="rounded border border-zinc-500/30 bg-transparent px-2 py-1 text-sm"
    >
      <option value="" disabled>
        Choose a demo user
      </option>
      {users.map((user) => (
        <option key={user.id} value={user.id}>
          {user.name}
        </option>
      ))}
    </select>
  );
}
