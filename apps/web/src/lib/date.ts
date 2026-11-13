export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { timeStyle: "medium" });
}
