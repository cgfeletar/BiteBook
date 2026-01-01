/**
 * Decodes HTML entities in a string
 * Converts entities like &#39;, &#039;, &quot;, &amp;, etc. to their actual characters
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return text;

  // Create a temporary textarea element to decode HTML entities
  // This is the most reliable way to decode HTML entities in React Native
  const entityMap: Record<string, string> = {
    "&#39;": "'",
    "&#039;": "'",
    "&apos;": "'",
    "&quot;": '"',
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&nbsp;": " ",
    "&#160;": " ",
    "&mdash;": "—",
    "&ndash;": "–",
    "&hellip;": "…",
  };

  let decoded = text;

  // Replace numeric entities (&#39;, &#039;, etc.)
  decoded = decoded.replace(/&#(\d+);/g, (match, dec) => {
    return String.fromCharCode(parseInt(dec, 10));
  });

  // Replace hex entities (&#x27;, etc.)
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });

  // Replace named entities
  for (const [entity, char] of Object.entries(entityMap)) {
    decoded = decoded.replace(new RegExp(entity, "g"), char);
  }

  return decoded;
}

