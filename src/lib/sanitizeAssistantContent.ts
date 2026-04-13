/**
 * Remove model reasoning / "think" blocks that should not be shown to participants.
 * Extend patterns here if new formats appear in API output.
 */
const REASONING_BLOCK_PATTERNS: RegExp[] = [
  /<\s*think\b[^>]*>[\s\S]*?<\s*\/\s*think\s*>/gi,
  /<\s*thinking\b[^>]*>[\s\S]*?<\s*\/\s*thinking\s*>/gi,
  /<\s*reasoning\b[^>]*>[\s\S]*?<\s*\/\s*reasoning\s*>/gi,
  /<\s*redacted_thinking\b[^>]*>[\s\S]*?<\s*\/\s*redacted_thinking\s*>/gi,
  /【思考】[\s\S]*?【\/思考】/g,
];

// Cleanup for malformed outputs that include only opening/closing markers.
const REASONING_TAG_ONLY_PATTERNS: RegExp[] = [
  /<\s*\/?\s*think\b[^>]*>/gi,
  /<\s*\/?\s*thinking\b[^>]*>/gi,
  /<\s*\/?\s*reasoning\b[^>]*>/gi,
  /<\s*\/?\s*redacted_thinking\b[^>]*>/gi,
];

// Fallback for malformed outputs that open a reasoning tag but never close it.
const REASONING_UNCLOSED_OPENING_TO_END: RegExp[] = [
  /<\s*think\b[^>]*>[\s\S]*$/gi,
  /<\s*thinking\b[^>]*>[\s\S]*$/gi,
  /<\s*reasoning\b[^>]*>[\s\S]*$/gi,
  /<\s*redacted_thinking\b[^>]*>[\s\S]*$/gi,
];

export function stripHiddenReasoning(text: string): string {
  let out = text;
  let changed = true;
  while (changed) {
    changed = false;
    for (const re of REASONING_BLOCK_PATTERNS) {
      const next = out.replace(re, "");
      if (next !== out) {
        out = next;
        changed = true;
      }
    }
  }
  for (const re of REASONING_TAG_ONLY_PATTERNS) {
    out = out.replace(re, "");
  }
  for (const re of REASONING_UNCLOSED_OPENING_TO_END) {
    out = out.replace(re, "");
  }
  return out.replace(/\n{3,}/g, "\n\n").trim();
}
