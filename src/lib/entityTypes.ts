import type { EntityType } from './types'

export const ENTITY_TYPES: EntityType[] = ['POSITIVE', 'ANATOMY', 'DOSE']

export const ENTITY_TYPE_META: Record<EntityType, { label: string; bg: string; text: string }> = {
  POSITIVE: { label: 'finding', bg: '#fee2e2', text: '#dc2626' },
  ANATOMY: { label: 'anatomy', bg: '#dbeafe', text: '#2563eb' },
  DOSE: { label: 'dose', bg: '#ede9fe', text: '#7c3aed' }
}

export function entityLabel(type?: EntityType): string | null {
  if (!type) return null
  return ENTITY_TYPE_META[type]?.label ?? type.toLowerCase()
}
