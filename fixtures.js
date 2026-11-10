// The fixtures every measured package manager is run against, and the
// only thing the populate pass and the measuring pass have to agree on:
// a registry warmed for one set of fixtures and measured against another
// would hand whichever manager ran first the cost of the difference,
// inside a timed install.
//
// `skipManagers` names the scenarios a fixture is not measured with — for
// a manager the fixture is pathological for, or one that cannot install it
// at all. Every entry needs a reason recorded here: a column that quietly
// stops being measured is worse than one that is slow, because a reader
// cannot tell the difference from the numbers.
export const fixtures = [
  { name: 'notarial-marriage-frontend' },
  { name: 'notarial-marriage-fee-api' },
  { name: 'notarial-marriage-e2e' },
  { name: 'notarial-orbit-stub' },
]

/** Just the names — what the registry warm-up and the populate pass take. */
export const fixtureNames = fixtures.map((fixture) => fixture.name)
