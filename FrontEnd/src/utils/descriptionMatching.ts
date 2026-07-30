export interface ApproximateMatch {
  descriptionStart: string
  matchingDescriptions: string[]
}

// A candidate description is an approximate match of `description` if it starts with the same
// characters as `description`, up to and including a space - i.e. the match only counts at a
// whole-word boundary, never mid-word (so "COLES 0717..." vs "COLES 0760..." matches on "COLES",
// not on the coincidentally-shared "07" digits). Where more than one boundary is supported,
// the longest (most precise) one wins - e.g. two "DAVID JONES ..." descriptions match each other
// on "DAVID JONES", which takes precedence over a weaker "DAVID"-only match against an unrelated
// "DAVID CAMERON ..." description.
export function findApproximateMatch(description: string, otherDescriptions: string[]): ApproximateMatch | null {
  const boundaries: number[] = []
  for (let i = 0; i < description.length; i++) {
    if (description[i] === ' ') {
      boundaries.push(i + 1)
    }
  }
  boundaries.sort((a, b) => b - a)

  for (const boundary of boundaries) {
    const prefix = description.slice(0, boundary)
    const matchingDescriptions = otherDescriptions.filter((other) => other !== description && other.startsWith(prefix))
    if (matchingDescriptions.length > 0) {
      return { descriptionStart: prefix.trimEnd(), matchingDescriptions }
    }
  }

  return null
}
