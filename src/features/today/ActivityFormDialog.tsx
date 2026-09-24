import { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, SelectInput, TextArea, TextInput } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Alert';
import {
  ACTIVITY_RULES,
  ACTIVITY_RULE_LIST,
  NOTES_MAX,
  QUANTITY_MAX,
  QUANTITY_MIN,
  type ActivityType,
} from '@/lib/activityRules';
import { activityFormSchema, type ActivityFormValues } from '@/lib/schemas';
import { nowHHmm, utcIsoToZonedHHmm, zonedTimeToUtcIso } from '@/utils/date';
import type { Activity, ActivityInput, IsoDate, Priority } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: ActivityInput) => Promise<void>;
  workDate: IsoDate;
  timezone: string;
  activity?: Activity | null;
}

/**
 * Add / edit an activity. Priority appears only for the types that require it,
 * driven entirely by ACTIVITY_RULES, and the start time is pre-filled with the
 * current time so a normal entry takes a few seconds.
 */
export function ActivityFormDialog({ open, onClose, onSubmit, workDate, timezone, activity }: Props) {
  const isEditing = Boolean(activity);

  const defaultValues = useMemo<ActivityFormValues>(
    () => ({
      type: activity?.type ?? 'CASE',
      priority: activity?.priority ?? 'P3',
      quantity: activity?.quantity ?? 1,
      startTime: activity ? utcIsoToZonedHHmm(activity.started_at, timezone) : nowHHmm(timezone),
      endTime: activity?.ended_at ? utcIsoToZonedHHmm(activity.ended_at, timezone) : '',
      notes: activity?.notes ?? '',
    }),
    [activity, timezone],
  );

  const {
    register,
    handleSubmit,
    watch,
    control,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ActivityFormValues>({
    resolver: zodResolver(activityFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) reset(defaultValues);
  }, [open, defaultValues, reset]);

  const selectedType = (watch('type') ?? 'CASE') as ActivityType;
  const rule = ACTIVITY_RULES[selectedType];

  const submit = handleSubmit(async (values) => {
    const priority = rule.usesPriority ? ((values.priority as Priority) ?? null) : null;
    const input: ActivityInput = {
      type: values.type as ActivityType,
      priority,
      quantity: Number(values.quantity),
      started_at: zonedTimeToUtcIso(workDate, values.startTime as string, timezone),
      ended_at: values.endTime
        ? zonedTimeToUtcIso(workDate, values.endTime as string, timezone)
        : null,
      notes: values.notes ? String(values.notes).trim() || null : null,
    };

    try {
      await onSubmit(input);
      onClose();
    } catch (error) {
      setError('root', {
        message:
          error instanceof Error ? error.message : 'Unable to save activity. Please try again.',
      });
    }
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit activity' : 'Add activity'}
      description="Record metadata only. Never enter customer names, case contents or credentials."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={submit} loading={isSubmitting} loadingLabel="Saving activity…">
            {isEditing ? 'Save changes' : 'Add activity'}
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={submit} noValidate>
        {errors.root?.message ? <Alert tone="error">{errors.root.message}</Alert> : null}

        <Field label="Activity type" hint={rule.description} error={errors.type?.message} required>
          {({ id, describedBy, invalid }) => (
            <SelectInput id={id} aria-describedby={describedBy} aria-invalid={invalid} {...register('type')}>
              {ACTIVITY_RULE_LIST.map((item) => (
                <option key={item.type} value={item.type}>
                  {item.label}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>

        {rule.usesPriority ? (
          <Controller
            control={control}
            name="priority"
            render={({ field }) => (
              <Field label="Priority" error={errors.priority?.message} required>
                {({ id, describedBy, invalid }) => (
                  <div
                    id={id}
                    role="radiogroup"
                    aria-label="Priority"
                    aria-describedby={describedBy}
                    aria-invalid={invalid}
                    className="grid grid-cols-4 gap-2"
                  >
                    {rule.priorities.map((priority) => {
                      const selected = field.value === priority;
                      return (
                        <button
                          key={priority}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => field.onChange(priority)}
                          className={
                            selected
                              ? 'h-11 rounded-lg bg-brand-600 text-sm font-semibold text-white'
                              : 'h-11 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                          }
                        >
                          {priority}
                        </button>
                      );
                    })}
                  </div>
                )}
              </Field>
            )}
          />
        ) : (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {rule.label} does not use priority, so no P1–P4 value is stored.
          </p>
        )}

        <Field label="Quantity" error={errors.quantity?.message} required>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              type="number"
              inputMode="numeric"
              min={QUANTITY_MIN}
              max={QUANTITY_MAX}
              step={1}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              {...register('quantity', { valueAsNumber: true })}
            />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start time" error={errors.startTime?.message} required>
            {({ id, describedBy, invalid }) => (
              <TextInput id={id} type="time" aria-describedby={describedBy} aria-invalid={invalid} {...register('startTime')} />
            )}
          </Field>
          <Field label="End time" hint="Leave blank if still running." error={errors.endTime?.message}>
            {({ id, describedBy, invalid }) => (
              <TextInput id={id} type="time" aria-describedby={describedBy} aria-invalid={invalid} {...register('endTime')} />
            )}
          </Field>
        </div>

        <Field
          label="Notes (optional)"
          hint={`Metadata only, up to ${NOTES_MAX} characters. For example: CX replied.`}
          error={errors.notes?.message}
        >
          {({ id, describedBy, invalid }) => (
            <TextArea id={id} maxLength={NOTES_MAX} aria-describedby={describedBy} aria-invalid={invalid} {...register('notes')} />
          )}
        </Field>
      </form>
    </Dialog>
  );
}
