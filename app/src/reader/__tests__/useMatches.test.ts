import { findMatches } from '@/reader/useMatches';

it('returns indexes of texts containing any folded term', () => {
  expect(findMatches(['boil water', 'fire', 'café water'], ['WATER'])).toEqual([0, 2]);
  expect(findMatches(['café'], ['cafe'])).toEqual([0]);
  expect(findMatches(['x'], [])).toEqual([]);
});
