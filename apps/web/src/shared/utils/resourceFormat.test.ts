import { describe, expect, it } from 'vitest'

import { formatRecord } from './resourceFormat'

describe('formatRecord', () => {
  it('renders nested records without object coercion noise', () => {
    expect(formatRecord({
      headers: { 'X-Lumen-Template': 'base' },
      enabled: true,
      ports: [443, 8443],
    })).toBe('headers={"X-Lumen-Template":"base"}, enabled=true, ports=[443, 8443]')
  })
})
