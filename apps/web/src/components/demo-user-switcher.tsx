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
    <label className="flex min-h-11 items-center gap-2 text-caption text-muted sm:min-h-9">
      Demo user
      <select
        defaultValue={currentUserId ?? ""}
        onChange={(event) => {
          setDemoUser(event.target.value);
          router.refresh();
        }}
        className="min-h-11 rounded-control border border-dashed border-muted bg-transparent px-2 text-caption text-ink sm:min-h-8"
      >
        <option value="" disabled>
          Choose a user
        </option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name}
          </option>
        ))}
      </select>
    </label>
  );
}
