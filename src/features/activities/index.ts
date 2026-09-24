/**
 * Activity feature surface.
 *
 * Activity rules and validation live in `lib/`, persistence in `services/`.
 * This barrel keeps the feature's public pieces in one importable place.
 */
export { ActivityFormDialog } from '@/features/today/ActivityFormDialog';
export {
  createActivity,
  updateActivity,
  deleteActivity,
  closeActivity,
  closeOpenActivity,
} from '@/services/activityService';
export {
  ACTIVITY_RULES,
  ACTIVITY_RULE_LIST,
  PRIORITISED_TYPES,
  validateActivityRule,
  normalisePriority,
} from '@/lib/activityRules';
