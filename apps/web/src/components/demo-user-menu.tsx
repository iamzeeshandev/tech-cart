import { getCurrentUserId, getDemoUsers } from "@/lib/api";
import { DemoUserSwitcher } from "./demo-user-switcher";

export async function DemoUserMenu() {
  const [users, currentUserId] = await Promise.all([getDemoUsers(), getCurrentUserId()]);
  return <DemoUserSwitcher users={users} currentUserId={currentUserId} />;
}
