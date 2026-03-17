/**
 * Build an invite link for a kitchen invite
 * @param inviteId - The invite document ID
 * @returns The invite URL (uses deep link for native, web URL for sharing)
 */
export function buildInviteLink(inviteId: string): string {
  // Use deep link for native apps (bitebook://invite/abc123)
  // This will open the app directly if installed
  // Matches the scheme in app.json
  return `bitebook://invite/${inviteId}`;
}

/**
 * Build a web invite link (for sharing via email, etc.)
 * @param inviteId - The invite document ID
 * @returns The web invite URL
 */
export function buildWebInviteLink(inviteId: string): string {
  // Web URL for sharing (will redirect to app if installed)
  // Using bitebookhq.app as the Firebase Hosting domain
  return `https://bitebookhq.app/invite/${inviteId}`;
}

/**
 * Extract invite ID from an invite URL
 * @param url - The invite URL
 * @returns The invite ID or null if invalid
 */
export function extractInviteIdFromUrl(url: string): string | null {
  // Match both web URLs and deep links
  const bitebookMatch = url.match(/bitebookhq\.app\/invite\/([a-zA-Z0-9]+)/);
  const bitebookDeepLinkMatch = url.match(
    /bitebook:\/\/invite\/([a-zA-Z0-9]+)/,
  );
  const match = bitebookMatch || bitebookDeepLinkMatch;
  return match ? match[1] : null;
}
