import { describe, it, expect } from 'vitest'
import { findApproximateMatch } from '../../FrontEnd/src/utils/descriptionMatching'

describe('findApproximateMatch', () => {
  it('matches on a single shared word when only the first word is common (CHEMIST WAREHOUSE example)', () => {
    const result = findApproximateMatch('CHEMIST WAREHOUSE CHATS CHATSWOOD', ['CHEMIST WAREHOUSE HORNS HORNSBY'])

    expect(result).toEqual({
      descriptionStart: 'CHEMIST WAREHOUSE',
      matchingDescriptions: ['CHEMIST WAREHOUSE HORNS HORNSBY'],
    })
  })

  it('matches on the merchant word only, ignoring coincidentally-shared digits (COLES example)', () => {
    const result = findApproximateMatch('COLES 0717 TURRAMURRA AUS', ['COLES 0760 ASQUITH AUS'])

    expect(result).toEqual({
      descriptionStart: 'COLES',
      matchingDescriptions: ['COLES 0760 ASQUITH AUS'],
    })
  })

  it('prefers the longer, more precise match and excludes an unrelated single-word match (DAVID JONES example)', () => {
    const result = findApproximateMatch('DAVID JONES HORNSBY     HORNSBY', [
      'DAVID JONES LIMITED SYDNEY AUS',
      'DAVID CAMERON Name',
    ])

    expect(result).toEqual({
      descriptionStart: 'DAVID JONES',
      matchingDescriptions: ['DAVID JONES LIMITED SYDNEY AUS'],
    })
  })

  it('falls back to a weaker single-word match when nothing more precise exists', () => {
    const result = findApproximateMatch('DAVID CAMERON Name', ['DAVID JONES HORNSBY HORNSBY'])

    expect(result).toEqual({
      descriptionStart: 'DAVID',
      matchingDescriptions: ['DAVID JONES HORNSBY HORNSBY'],
    })
  })

  it('returns null when no other description shares even the first word', () => {
    const result = findApproximateMatch('Netflix', ['Spotify', 'Steam Games'])

    expect(result).toBeNull()
  })

  it('returns null when the description has no spaces at all', () => {
    const result = findApproximateMatch('Netflix', ['Netflix Extra'])

    expect(result).toBeNull()
  })

  it('excludes the description itself from the matching set', () => {
    const result = findApproximateMatch('COLES 0717 TURRAMURRA AUS', ['COLES 0717 TURRAMURRA AUS', 'COLES 0760 ASQUITH AUS'])

    expect(result).toEqual({
      descriptionStart: 'COLES',
      matchingDescriptions: ['COLES 0760 ASQUITH AUS'],
    })
  })
})
