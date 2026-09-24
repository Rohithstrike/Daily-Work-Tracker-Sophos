/**
 * User-facing error mapping.
 *
 * Raw PostgreSQL / Supabase messages are never shown in the UI. Technical
 * detail is logged to the developer console instead.
 */

export class AppError extends Error {
  readonly userMessage: string;
  readonly cause?: unknown;

  constructor(userMessage: string, cause?: unknown) {
    super(userMessage);
    this.name = 'AppError';
    this.userMessage = userMessage;
    this.cause = cause;
  }
}

export const ERROR_MESSAGES = {
  offline: 'Your internet connection appears to be unavailable. The change was not saved.',
  saveActivity: 'Unable to save activity. Please try again.',
  deleteActivity: 'Unable to delete the activity. Please try again.',
  loadWorkspace: 'Unable to load your workspace. Please refresh and try again.',
  finishDay: 'Could not finish the workday. Please try again.',
  reopenDay: 'Could not reopen the workday. Please try again.',
  dayLocked: 'This day is completed. Reopen it before making changes.',
  monthLocked: 'This month is completed. Reopen it before making changes.',
  startLunch: 'Could not start lunch. Please try again.',
  endLunch: 'Could not resume work. Please try again.',
  loadHistory: 'Unable to load history. Please try again.',
  generateReport: 'Could not generate the Excel report. Please try again.',
  saveSettings: 'Unable to save your settings. Please try again.',
  auth: 'We could not complete that request. Please check your details and try again.',
  generic: 'Something went wrong. Please try again.',
} as const;

export type ErrorKey = keyof typeof ERROR_MESSAGES;

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Converts any thrown value into an AppError with a safe message, logging the
 * technical detail for developers.
 */
export function toAppError(error: unknown, fallback: ErrorKey = 'generic'): AppError {
  if (error instanceof AppError) return error;

  // eslint-disable-next-line no-console
  console.error('[workday-activity-tracker]', error);

  if (isOffline()) return new AppError(ERROR_MESSAGES.offline, error);

  const code = extractCode(error);
  if (code === '23505') {
    return new AppError('That record already exists for this date.', error);
  }
  if (code === '23514') {
    return new AppError('That combination is not allowed by the activity rules.', error);
  }
  if (code === '42501' || code === 'PGRST301') {
    return new AppError('You do not have permission to change this record.', error);
  }
  if (isNetworkError(error)) {
    return new AppError(ERROR_MESSAGES.offline, error);
  }
  const message = extractMessage(error);
  if (message.includes('completed workday') || message.includes('day is completed')) {
    return new AppError(ERROR_MESSAGES.dayLocked, error);
  }

  return new AppError(ERROR_MESSAGES[fallback], error);
}

function extractCode(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
  return null;
}

function extractMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' ? message.toLowerCase() : '';
  }
  return '';
}

function isNetworkError(error: unknown): boolean {
  const message = extractMessage(error);
  return message.includes('failed to fetch') || message.includes('network');
}

/** Auth errors are safe to surface in a limited, friendly form. */
export function authErrorMessage(error: unknown): string {
  const message = extractMessage(error);
  if (message.includes('invalid login credentials')) {
    return 'That email or password is not correct.';
  }
  if (message.includes('already registered') || message.includes('already been registered')) {
    return 'An account already exists for that email address.';
  }
  if (message.includes('email not confirmed')) {
    return 'Please confirm your email address before signing in.';
  }
  if (message.includes('password')) {
    return 'Your password must be at least 8 characters long.';
  }
  if (message.includes('rate limit') || message.includes('too many')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  // eslint-disable-next-line no-console
  console.error('[auth]', error);
  return ERROR_MESSAGES.auth;
}
