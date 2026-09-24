/**
 * Central business-rule definition for work activities.
 *
 * This file is the single source of truth for:
 *  - which activity types exist
 *  - which of them require a priority
 *  - how each type is labelled and coloured in the UI
 *
 * It is consumed by the activity form, Zod schemas, service-level validation,
 * summary cards, timeline labels, dashboard charts, Excel reports and tests.
 * The same rules are mirrored as CHECK constraints in PostgreSQL.
 */

export const ACTIVITY_TYPES = [
  'CASE',
  'AR',
  'DUPE',
  'IR',
  'PEER_REVIEW',
  'MISC_HELP',
  'THREAT_HUNT',
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const PRIORITIES = ['P1', 'P2', 'P3', 'P4'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const QUANTITY_MIN = 1;
export const QUANTITY_MAX = 999;
export const NOTES_MAX = 500;

export interface ActivityRule {
  /** Stable database value. */
  readonly type: ActivityType;
  /** Human label used across UI, charts and Excel headers. */
  readonly label: string;
  /** Short label used where space is tight (summary cards, mobile). */
  readonly shortLabel: string;
  /** Longer explanation shown as helper text. */
  readonly description: string;
  /** When false, priority MUST be null in the database and hidden in the UI. */
  readonly usesPriority: boolean;
  /** Allowed priorities; empty when the type does not use priority. */
  readonly priorities: readonly Priority[];
  /** Tailwind classes for badges/cards. Never used as the only signal. */
  readonly accentClass: string;
  /** Hex colour used by Recharts (charts cannot consume Tailwind classes). */
  readonly chartColor: string;
}

export const ACTIVITY_RULES: Readonly<Record<ActivityType, ActivityRule>> = {
  CASE: {
    type: 'CASE',
    label: 'Case',
    shortLabel: 'Case',
    description: 'Standard case worked during the day.',
    usesPriority: true,
    priorities: PRIORITIES,
    accentClass: 'bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300',
    chartColor: '#4f46e5',
  },
  AR: {
    type: 'AR',
    label: 'AR',
    shortLabel: 'AR',
    description: 'Action Required - an escalated case received a response and needs further action.',
    usesPriority: true,
    priorities: PRIORITIES,
    accentClass: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300',
    chartColor: '#0ea5e9',
  },
  DUPE: {
    type: 'DUPE',
    label: 'Dupe',
    shortLabel: 'Dupe',
    description: 'Duplicate cases identified and closed.',
    usesPriority: true,
    priorities: PRIORITIES,
    accentClass: 'bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-300',
    chartColor: '#14b8a6',
  },
  IR: {
    type: 'IR',
    label: 'IR',
    shortLabel: 'IR',
    description: 'Incident response work. Priority is not tracked for IR.',
    usesPriority: false,
    priorities: [],
    accentClass:
      'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300',
    chartColor: '#8b5cf6',
  },
  PEER_REVIEW: {
    type: 'PEER_REVIEW',
    label: 'Peer Review',
    shortLabel: 'Peer Rev.',
    description: 'Reviewing work completed by a colleague.',
    usesPriority: true,
    priorities: PRIORITIES,
    accentClass: 'bg-cyan-50 text-cyan-700 ring-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300',
    chartColor: '#06b6d4',
  },
  MISC_HELP: {
    type: 'MISC_HELP',
    label: 'Miscalculation / Help',
    shortLabel: 'Help',
    description: 'Helping a colleague or calculation-related work. Priority is not tracked.',
    usesPriority: false,
    priorities: [],
    accentClass: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-300',
    chartColor: '#64748b',
  },
  THREAT_HUNT: {
    type: 'THREAT_HUNT',
    label: 'Threat Hunt',
    shortLabel: 'Hunt',
    description: 'Proactive threat-hunting work. Priority is not tracked.',
    usesPriority: false,
    priorities: [],
    accentClass:
      'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300',
    chartColor: '#10b981',
  },
};

/** Ordered list used for cards, charts, tables and Excel columns. */
export const ACTIVITY_RULE_LIST: readonly ActivityRule[] = ACTIVITY_TYPES.map(
  (type) => ACTIVITY_RULES[type],
);

/** Types that display and store a priority. */
export const PRIORITISED_TYPES: readonly ActivityType[] = ACTIVITY_TYPES.filter(
  (type) => ACTIVITY_RULES[type].usesPriority,
);

export function isActivityType(value: unknown): value is ActivityType {
  return typeof value === 'string' && (ACTIVITY_TYPES as readonly string[]).includes(value);
}

export function isPriority(value: unknown): value is Priority {
  return typeof value === 'string' && (PRIORITIES as readonly string[]).includes(value);
}

export function usesPriority(type: ActivityType): boolean {
  return ACTIVITY_RULES[type].usesPriority;
}

export function activityLabel(type: ActivityType): string {
  return ACTIVITY_RULES[type].label;
}

export interface RuleViolation {
  readonly field: 'type' | 'priority' | 'quantity' | 'notes';
  readonly message: string;
}

/**
 * Pure validation of an activity against the central rules.
 * Returns an empty array when the combination is valid.
 */
export function validateActivityRule(input: {
  type: unknown;
  priority?: unknown;
  quantity?: unknown;
  notes?: unknown;
}): RuleViolation[] {
  const violations: RuleViolation[] = [];

  if (!isActivityType(input.type)) {
    return [{ field: 'type', message: 'Select a valid activity type.' }];
  }

  const rule = ACTIVITY_RULES[input.type];
  const priority = input.priority ?? null;

  if (rule.usesPriority) {
    if (!isPriority(priority)) {
      violations.push({
        field: 'priority',
        message: `${rule.label} requires a priority (P1 to P4).`,
      });
    }
  } else if (priority !== null && priority !== undefined && priority !== '') {
    violations.push({
      field: 'priority',
      message: `${rule.label} does not use a priority.`,
    });
  }

  const quantity = input.quantity;
  if (typeof quantity !== 'number' || !Number.isFinite(quantity)) {
    violations.push({ field: 'quantity', message: 'Enter a quantity.' });
  } else if (!Number.isInteger(quantity)) {
    violations.push({ field: 'quantity', message: 'Quantity must be a whole number.' });
  } else if (quantity < QUANTITY_MIN) {
    violations.push({ field: 'quantity', message: `Quantity must be at least ${QUANTITY_MIN}.` });
  } else if (quantity > QUANTITY_MAX) {
    violations.push({ field: 'quantity', message: `Quantity cannot exceed ${QUANTITY_MAX}.` });
  }

  if (typeof input.notes === 'string' && input.notes.length > NOTES_MAX) {
    violations.push({ field: 'notes', message: `Notes cannot exceed ${NOTES_MAX} characters.` });
  }

  return violations;
}

export function isValidActivityRule(input: {
  type: unknown;
  priority?: unknown;
  quantity?: unknown;
  notes?: unknown;
}): boolean {
  return validateActivityRule(input).length === 0;
}

/** Normalises priority so non-prioritised types always persist NULL. */
export function normalisePriority(type: ActivityType, priority: unknown): Priority | null {
  if (!ACTIVITY_RULES[type].usesPriority) return null;
  return isPriority(priority) ? priority : null;
}

/* ---------------------------------------------------------------- breaks */

export const BREAK_TYPES = ['LUNCH'] as const;
export type BreakType = (typeof BREAK_TYPES)[number];

export const BREAK_LABELS: Readonly<Record<BreakType, string>> = {
  LUNCH: 'Lunch',
};
