import type { TransactionDescriptionStat } from '../services/transactionDescriptionsService'

export interface ApproximateMatch {
  descriptionStart: string
  matchingTransactionCount: number
}

// A candidate description is an approximate match of `description` if it starts with the same
// characters as `description`, up to and including a space - i.e. the match only counts at a
// whole-word boundary, never mid-word (so "COLES 0717..." vs "COLES 0760..." matches on "COLES",
// not on the coincidentally-shared "07" digits). Where more than one boundary is supported,
// the longest (most precise) one wins - e.g. two "DAVID JONES ..." descriptions match each other
// on "DAVID JONES", which takes precedence over a weaker "DAVID"-only match against an unrelated
// "DAVID CAMERON ..." description.
//
// `otherDescriptions` is the deduplicated per-description stats list (one entry per unique
// description string, each carrying how many real transactions have it) - not a per-transaction
// list. The entry for `description` itself is still a valid candidate: if two+ transactions
// share the exact same description (the common case for real bank data), that's a single stat
// entry with `transactionCount` > 1, and it should still trigger a match against the other
// transaction(s) it represents - it only fails to qualify when `transactionCount` is 1, meaning
// this is the only transaction with that description.
export function findApproximateMatch(description: string, otherDescriptions: TransactionDescriptionStat[]): ApproximateMatch | null {
  const boundaries: number[] = []
  for (let i = 0; i < description.length; i++) {
    if (description[i] === ' ') {
      boundaries.push(i + 1)
    }
  }
  boundaries.sort((a, b) => b - a)

  for (const boundary of boundaries) {
    const prefix = description.slice(0, boundary)
    let matchingTransactionCount = 0

    for (const stat of otherDescriptions) {
      if (!stat.description.startsWith(prefix)) {
        continue
      }
      // The stat for `description` itself also represents the transaction being edited - only
      // the transactions *other* than that one count as a match.
      matchingTransactionCount += stat.description === description ? stat.transactionCount - 1 : stat.transactionCount
    }

    if (matchingTransactionCount > 0) {
      return { descriptionStart: prefix.trimEnd(), matchingTransactionCount }
    }
  }

  return null
}
