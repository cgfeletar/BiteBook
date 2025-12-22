/**
 * Build an invite link for a kitchen invite
 * @param inviteId - The invite document ID
 * @returns The invite URL (uses deep link for native, web URL for sharing)
 */
export function buildInviteLink(inviteId: string): string {
  // Use deep link for native apps (saute://invite/abc123)
  // This will open the app directly if installed
  return `saute://invite/${inviteId}`;
}

/**
 * Build a web invite link (for sharing via email, etc.)
 * @param inviteId - The invite document ID
 * @returns The web invite URL
 */
export function buildWebInviteLink(inviteId: string): string {
  // Web URL for sharing (will redirect to app if installed)
  return `https://saute.app/invite/${inviteId}`;
}

/**
 * Extract invite ID from an invite URL
 * @param url - The invite URL
 * @returns The invite ID or null if invalid
 */
export function extractInviteIdFromUrl(url: string): string | null {
  // Match both web URLs and deep links
  const webMatch = url.match(/saute\.app\/invite\/([a-zA-Z0-9]+)/);
  const deepLinkMatch = url.match(/saute:\/\/invite\/([a-zA-Z0-9]+)/);
  
  const match = webMatch || deepLinkMatch;
  return match ? match[1] : null;
}

