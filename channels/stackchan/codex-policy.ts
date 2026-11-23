export const developmentPermissionName = "stackchan_development";
export const conversationPermissionName = "stackchan_conversation";

export function conversationFilesystem(cameraDirectory: string): Record<string, unknown> {
  return { ":minimal": "read", ":workspace_roots": { ".": "read" }, [cameraDirectory]: "read" };
}

export function toToml(value: Record<string, unknown>): string {
  return "{" + Object.entries(value).map(([key, item]) => `${JSON.stringify(key)}=${typeof item === "object" && item !== null ? toToml(item as Record<string, unknown>) : JSON.stringify(item)}`).join(",") + "}";
}

export function developmentFilesystem(readOnlyRoots: string[] = []): Record<string, unknown> {
  const filesystem: Record<string, unknown> = { ":minimal": "read", ":workspace_roots": {
    ".": "write", ".git": "deny", ".codex": "deny", "**/.env*": "deny", "**/*.pem": "deny", "**/*.key": "deny",
  } };
  for (const root of readOnlyRoots) {
    if (!root.startsWith("/") || root === "/") throw new Error("Development dependency roots must be explicit absolute paths");
    filesystem[root] = "read";
  }
  filesystem["/opt/homebrew/etc"] = "deny";
  return filesystem;
}
