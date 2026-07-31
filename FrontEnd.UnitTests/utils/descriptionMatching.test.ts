import { describe, it, expect } from 'vitest'
import { findApproximateMatch } from '../../FrontEnd/src/utils/descriptionMatching'
import type { TransactionDescriptionStat } from '../../FrontEnd/src/services/transactionDescriptionsService'

function stat(description: string, transactionCount: number, unclassifiedCount = 0): TransactionDescriptionStat {
  return { description, transactionCount, unclassifiedCount }
}

describe('findApproximateMatch', () => {
  it('matches on a single shared word when only the first word is common (CHEMIST WAREHOUSE example)', () => {
    const result = findApproximateMatch('CHEMIST WAREHOUSE CHATS CHATSWOOD', [stat('CHEMIST WAREHOUSE HORNS HORNSBY', 1)])

    expect(result).toEqual({ descriptionStart: 'CHEMIST WAREHOUSE', matchingTransactionCount: 1 })
  })

  it('matches on the merchant word only, ignoring coincidentally-shared digits (COLES example)', () => {
    const result = findApproximateMatch('COLES 0717 TURRAMURRA AUS', [stat('COLES 0760 ASQUITH AUS', 1)])

    expect(result).toEqual({ descriptionStart: 'COLES', matchingTransactionCount: 1 })
  })

  it('prefers the longer, more precise match and excludes an unrelated single-word match (DAVID JONES example)', () => {
    const result = findApproximateMatch('DAVID JONES HORNSBY     HORNSBY', [
      stat('DAVID JONES LIMITED SYDNEY AUS', 1),
      stat('DAVID CAMERON Name', 1),
    ])

    expect(result).toEqual({ descriptionStart: 'DAVID JONES', matchingTransactionCount: 1 })
  })

  it('falls back to a weaker single-word match when nothing more precise exists', () => {
    const result = findApproximateMatch('DAVID CAMERON Name', [stat('DAVID JONES HORNSBY HORNSBY', 1)])

    expect(result).toEqual({ descriptionStart: 'DAVID', matchingTransactionCount: 1 })
  })

  it('returns null when no other description shares even the first word', () => {
    const result = findApproximateMatch('Netflix', [stat('Spotify', 1), stat('Steam Games', 1)])

    expect(result).toBeNull()
  })

  it('returns null when the description has no spaces at all', () => {
    const result = findApproximateMatch('Netflix', [stat('Netflix Extra', 1)])

    expect(result).toBeNull()
  })

  it('matches against its own stat entry when more than one transaction shares the exact same description', () => {
    // The core UBE-54 fix: the description-stats list is deduplicated (one entry per unique
    // description string), so two transactions with the literal same description collapse to a
    // single stat entry with transactionCount 2 - that entry must still be a valid match target.
    const result = findApproximateMatch('COLES 0717 TURRAMURRA AUS', [stat('COLES 0717 TURRAMURRA AUS', 2, 2)])

    expect(result).toEqual({ descriptionStart: 'COLES 0717 TURRAMURRA', matchingTransactionCount: 1 })
  })

  it('returns null for its own stat entry when this is the only transaction with that description', () => {
    const result = findApproximateMatch('COLES 0717 TURRAMURRA AUS', [stat('COLES 0717 TURRAMURRA AUS', 1, 1)])

    expect(result).toBeNull()
  })

  it('prefers an exact-duplicate self-match over a weaker prefix match against a different description', () => {
    const result = findApproximateMatch('COLES 0717 TURRAMURRA AUS', [
      stat('COLES 0717 TURRAMURRA AUS', 2, 2),
      stat('COLES 0760 ASQUITH AUS', 1, 1),
    ])

    expect(result).toEqual({ descriptionStart: 'COLES 0717 TURRAMURRA', matchingTransactionCount: 1 })
  })

  it('sums transaction counts across every description matching the chosen boundary', () => {
    const result = findApproximateMatch('COLES 0717 TURRAMURRA AUS', [
      stat('COLES 0760 ASQUITH AUS', 2),
      stat('COLES 0999 NEWTOWN AUS', 3),
    ])

    expect(result).toEqual({ descriptionStart: 'COLES', matchingTransactionCount: 5 })
  })
})
