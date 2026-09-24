import { describe, expect, it } from 'vitest';
import {
  isValidActivityRule,
  normalisePriority,
  validateActivityRule,
} from '../src/lib/activityRules';
import { activityRecordSchema } from '../src/lib/schemas';

const base = { quantity: 1 };

function record(overrides: Record<string, unknown>) {
  return {
    type: 'CASE',
    priority: 'P1',
    quantity: 1,
    started_at: '2026-09-24T03:00:00.000Z',
    ended_at: null,
    notes: null,
    ...overrides,
  };
}

describe('activity rules', () => {
  it('1. accepts Case with P1', () => {
    expect(isValidActivityRule({ ...base, type: 'CASE', priority: 'P1' })).toBe(true);
    expect(activityRecordSchema.safeParse(record({})).success).toBe(true);
  });

  it('2. accepts Case with P4', () => {
    expect(isValidActivityRule({ ...base, type: 'CASE', priority: 'P4' })).toBe(true);
  });

  it('3. accepts AR with P2', () => {
    expect(isValidActivityRule({ type: 'AR', priority: 'P2', quantity: 4 })).toBe(true);
  });

  it('4. accepts Dupe with P3', () => {
    expect(isValidActivityRule({ type: 'DUPE', priority: 'P3', quantity: 2 })).toBe(true);
  });

  it('5. accepts IR without a priority', () => {
    expect(isValidActivityRule({ type: 'IR', priority: null, quantity: 1 })).toBe(true);
    expect(
      activityRecordSchema.safeParse(record({ type: 'IR', priority: null })).success,
    ).toBe(true);
  });

  it('6. rejects IR with P1', () => {
    const violations = validateActivityRule({ type: 'IR', priority: 'P1', quantity: 1 });
    expect(violations).toHaveLength(1);
    expect(violations[0]?.field).toBe('priority');
    expect(activityRecordSchema.safeParse(record({ type: 'IR', priority: 'P1' })).success).toBe(false);
  });

  it('7. accepts Peer Review with P2', () => {
    expect(isValidActivityRule({ type: 'PEER_REVIEW', priority: 'P2', quantity: 1 })).toBe(true);
  });

  it('8. accepts Help without a priority', () => {
    expect(isValidActivityRule({ type: 'MISC_HELP', priority: null, quantity: 1 })).toBe(true);
  });

  it('9. rejects Help with a priority', () => {
    expect(isValidActivityRule({ type: 'MISC_HELP', priority: 'P2', quantity: 1 })).toBe(false);
    expect(
      activityRecordSchema.safeParse(record({ type: 'MISC_HELP', priority: 'P2' })).success,
    ).toBe(false);
  });

  it('10. accepts Threat Hunt without a priority', () => {
    expect(isValidActivityRule({ type: 'THREAT_HUNT', priority: null, quantity: 2 })).toBe(true);
  });

  it('11. rejects Threat Hunt with a priority', () => {
    expect(isValidActivityRule({ type: 'THREAT_HUNT', priority: 'P1', quantity: 2 })).toBe(false);
    expect(
      activityRecordSchema.safeParse(record({ type: 'THREAT_HUNT', priority: 'P1' })).success,
    ).toBe(false);
  });

  it('12. rejects a quantity below 1', () => {
    const violations = validateActivityRule({ type: 'CASE', priority: 'P1', quantity: 0 });
    expect(violations.some((violation) => violation.field === 'quantity')).toBe(true);
    expect(activityRecordSchema.safeParse(record({ quantity: 0 })).success).toBe(false);
  });

  it('13. rejects a non-integer quantity', () => {
    const violations = validateActivityRule({ type: 'CASE', priority: 'P1', quantity: 2.5 });
    expect(violations.some((violation) => violation.message.includes('whole number'))).toBe(true);
    expect(activityRecordSchema.safeParse(record({ quantity: 2.5 })).success).toBe(false);
  });

  it('rejects Case with no priority and AR with no priority', () => {
    expect(isValidActivityRule({ type: 'CASE', priority: null, quantity: 1 })).toBe(false);
    expect(isValidActivityRule({ type: 'AR', priority: null, quantity: 1 })).toBe(false);
  });

  it('normalises priority to null for non-prioritised types', () => {
    expect(normalisePriority('THREAT_HUNT', 'P1')).toBeNull();
    expect(normalisePriority('IR', 'P2')).toBeNull();
    expect(normalisePriority('CASE', 'P2')).toBe('P2');
  });

  it('rejects notes longer than 500 characters', () => {
    const violations = validateActivityRule({
      type: 'IR',
      priority: null,
      quantity: 1,
      notes: 'x'.repeat(501),
    });
    expect(violations.some((violation) => violation.field === 'notes')).toBe(true);
  });
});
