import { describe, expect, it } from 'vitest'

const sourceFiles = import.meta.glob('../../**/*.{ts,tsx}', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>

describe('production reality import boundaries', () => {
  it('keeps development fixtures out of production modules', () => {
    const offenders = Object.entries(sourceFiles)
      .filter(([path]) => !/(\.test\.(ts|tsx)|(^|\/)api\/developmentClient\.ts|^\.\.\/api\/developmentClient\.ts)$/.test(path))
      .filter(([, source]) => source.includes('developmentFixtures'))
      .map(([path]) => path)

    expect(offenders).toEqual([])
  })

  it('does not import the removed mixed production and fixture data module', () => {
    const offenders = Object.entries(sourceFiles)
      .filter(([path]) => !/shared\/data\/productionReality\.test\.ts$/.test(path))
      .filter(([, source]) => source.includes('lumenData'))
      .map(([path]) => path)

    expect(offenders).toEqual([])
  })
})
