import { z } from 'zod';
import {
  ACTIVITY_TYPES,
  NOTES_MAX,
  PRIORITIES,
  QUANTITY_MAX,
  QUANTITY_MIN,
  ACTIVITY_RULES,
  isActivityType,
} from '@/lib/activityRules';

/** Zod schemas derived from the central activity rules. */

export const activityTypeSchema = z.enum(ACTIVITY_TYPES);
export const prioritySchema = z.enum(PRIORITIES);

const timeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a valid time in 24-hour format (HH:mm).');

/** Shape produced by the Add/Edit Activity form. */
export const activityFormSchema = z
  .object({
    type: activityTypeSchema,
    priority: z.union([prioritySchema, z.literal(''), z.null()]).optional(),
    // Kept as z.number (not z.coerce) so the form's input and output types
    // match exactly; the field registers with valueAsNumber.
    quantity: z
      .number({ invalid_type_error: 'Enter a quantity.' })
      .int('Quantity must be a whole number.')
      .min(QUANTITY_MIN, `Quantity must be at least ${QUANTITY_MIN}.`)
      .max(QUANTITY_MAX, `Quantity cannot exceed ${QUANTITY_MAX}.`),
    startTime: timeStringSchema,
    endTime: z.union([timeStringSchema, z.literal('')]).optional(),
    notes: z
      .string()
      .max(NOTES_MAX, `Notes cannot exceed ${NOTES_MAX} characters.`)
      .optional()
      .or(z.literal('')),
  })
  .superRefine((value, ctx) => {
    if (!isActivityType(value.type)) return;
    const rule = ACTIVITY_RULES[value.type];
    const priority = value.priority ?? null;

    if (rule.usesPriority) {
      if (!priority) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['priority'],
          message: `${rule.label} requires a priority (P1 to P4).`,
        });
      }
    } else if (priority) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['priority'],
        message: `${rule.label} does not use a priority.`,
      });
    }

    if (value.endTime && value.endTime < value.startTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endTime'],
        message: 'End time cannot be before the start time.',
      });
    }
  });

export type ActivityFormValues = z.input<typeof activityFormSchema>;
export type ParsedActivityForm = z.output<typeof activityFormSchema>;

/** Shape persisted to the database, validated before every write. */
export const activityRecordSchema = z
  .object({
    type: activityTypeSchema,
    priority: prioritySchema.nullable(),
    quantity: z.number().int().min(QUANTITY_MIN).max(QUANTITY_MAX),
    started_at: z.string().datetime({ offset: true }),
    ended_at: z.string().datetime({ offset: true }).nullable(),
    notes: z.string().max(NOTES_MAX).nullable(),
  })
  .superRefine((value, ctx) => {
    const rule = ACTIVITY_RULES[value.type];
    if (rule.usesPriority && value.priority === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['priority'],
        message: `${rule.label} requires a priority (P1 to P4).`,
      });
    }
    if (!rule.usesPriority && value.priority !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['priority'],
        message: `${rule.label} must not have a priority.`,
      });
    }
    if (value.ended_at && value.ended_at < value.started_at) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ended_at'],
        message: 'End time cannot be before the start time.',
      });
    }
  });

export type ActivityRecordInput = z.infer<typeof activityRecordSchema>;

/* ------------------------------------------------------------------ auth */

export const signInSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});
export type SignInValues = z.infer<typeof signInSchema>;

export const signUpSchema = z
  .object({
    name: z.string().min(1, 'Enter your name.').max(80),
    email: z.string().email('Enter a valid email address.'),
    password: z.string().min(8, 'Use at least 8 characters.'),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });
export type SignUpValues = z.infer<typeof signUpSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
});
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Use at least 8 characters.'),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

/* -------------------------------------------------------------- settings */

export const settingsSchema = z.object({
  name: z.string().min(1, 'Enter a display name.').max(80),
  timezone: z.string().min(1, 'Select a timezone.'),
  week_starts_on: z.number().int().min(0).max(6),
  report_prefix: z
    .string()
    .min(1, 'Enter a report prefix.')
    .max(20, 'Keep the prefix under 20 characters.')
    .regex(/^[A-Za-z0-9 _-]+$/, 'Use letters, numbers, spaces, hyphens or underscores only.'),
  theme: z.enum(['light', 'dark', 'system']),
});
export type SettingsValues = z.infer<typeof settingsSchema>;

/* --------------------------------------------------------- report ranges */

export const customRangeSchema = z
  .object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Select a start date.'),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Select an end date.'),
  })
  .refine((value) => value.start <= value.end, {
    path: ['end'],
    message: 'The end date must not be before the start date.',
  });
export type CustomRangeValues = z.infer<typeof customRangeSchema>;
