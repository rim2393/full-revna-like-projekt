import { describe, expect, it } from 'vitest'

const sourceFiles = import.meta.glob('../../**/*.{ts,tsx}', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>

const cssFiles = import.meta.glob('../styles/**/*.css', {
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

  it('keeps sample public URLs out of production modules', () => {
    const offenders = Object.entries(sourceFiles)
      .filter(([path]) => !/(\.test\.(ts|tsx)|shared\/data\/developmentFixtures\.ts|^\.\.\/data\/developmentFixtures\.ts)$/.test(path))
      .filter(([, source]) => /https:\/\/t\.me\/support|https:\/\/sub\.example\.com/.test(source))
      .map(([path]) => path)

    expect(offenders).toEqual([])
  })

  it('keeps development API status labels out of production modules', () => {
    const offenders = Object.entries(sourceFiles)
      .filter(([path]) => !/(\.test\.(ts|tsx)|shared\/api\/developmentClient\.ts|^\.\.\/api\/developmentClient\.ts|shared\/data\/productionReality\.test\.ts)$/.test(path))
      .filter(([, source]) => source.includes('Development API'))
      .map(([path]) => path)

    expect(offenders).toEqual([])
  })

  it('keeps pseudo-backend placeholder status labels out of production modules', () => {
    const forbidden = [
      'Backend render status not exposed',
      'Backend does not expose device registry',
      'Backend does not expose subscription request history',
      'Backend unavailable',
    ]
    const offenders = Object.entries(sourceFiles)
      .filter(([path]) => !/shared\/data\/productionReality\.test\.ts$/.test(path))
      .filter(([, source]) => forbidden.some((label) => source.includes(label)))
      .map(([path]) => path)

    expect(offenders).toEqual([])
  })

  it('keeps Russian translations for every literal t() key used by production UI', () => {
    const dictionarySource = Object.entries(sourceFiles).find(([path]) =>
      path.replaceAll('\\', '/').includes('I18nProvider.tsx'),
    )?.[1]
    expect(dictionarySource).toBeTruthy()
    if (!dictionarySource) {
      throw new Error('I18nProvider source was not loaded by the production reality test.')
    }

    const quotedKeys = Array.from(dictionarySource.matchAll(/^\s*'([^']+)':/gm)).map(
      (match) => match[1],
    )
    const bareKeys = Array.from(
      dictionarySource.matchAll(/^\s*([A-Za-z][A-Za-z0-9_ -]*):\s*'/gm),
    ).map((match) => match[1].trim())
    const dictionaryKeys = new Set([...quotedKeys, ...bareKeys])

    const missing = Object.entries(sourceFiles)
      .filter(([path]) => !/shared\/i18n\/I18nProvider\.tsx$/.test(path))
      .flatMap(([path, source]) =>
        Array.from(source.matchAll(/\bt\(\s*(['"])(.*?)\1/g))
          .map((match) => match[2])
          .filter((key) => !dictionaryKeys.has(key))
          .map((key) => `${path}: ${key}`),
      )

    expect(missing).toEqual([])
  })

  it('keeps the operator language switcher visible on narrow production viewports', () => {
    const globalCss = Object.entries(cssFiles).find(([path]) =>
      path.replaceAll('\\', '/').endsWith('global.css'),
    )?.[1]
    expect(globalCss).toBeTruthy()
    if (!globalCss) {
      throw new Error('global.css source was not loaded by the production reality test.')
    }

    const narrowViewportStart = globalCss.indexOf('@media (max-width: 860px)')
    const nextMediaStart = globalCss.indexOf('@media', narrowViewportStart + 1)
    const narrowViewportBlock = globalCss.slice(
      narrowViewportStart,
      nextMediaStart > narrowViewportStart ? nextMediaStart : undefined,
    )

    expect(narrowViewportStart).toBeGreaterThanOrEqual(0)
    expect(narrowViewportBlock).toContain('.topbar__actions')
    expect(narrowViewportBlock).toContain('display: flex')
    expect(narrowViewportBlock).not.toContain('.topbar__actions {\n    display: none;')
  })
})
