/**
 * Lightweight fuzzy subsequence scoring for the command palette.
 * Returns −1 when the query does not match; higher is better.
 */
export function fuzzyScore(query: string, text: string): number {
  const needle = query.trim().toLowerCase()
  if (!needle) return 0
  const haystack = text.toLowerCase()
  let score = 0
  let cursor = 0
  let streak = 0
  for (const char of needle) {
    const index = haystack.indexOf(char, cursor)
    if (index === -1) return -1
    streak = index === cursor ? streak + 1 : 0
    const previous = index > 0 ? (haystack[index - 1] ?? '') : ' '
    const boundary = index === 0 || /[\s\-_/.]/.test(previous)
    score += 1 + streak * 2 + (boundary ? 4 : 0)
    cursor = index + 1
  }
  return score - haystack.length * 0.01
}
