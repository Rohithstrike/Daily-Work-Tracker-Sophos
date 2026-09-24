import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Field, SelectInput, TextInput } from '@/components/ui/Field';
import { LoadingState } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/AuthProvider';
import { settingsSchema, type SettingsValues } from '@/lib/schemas';
import { toAppError } from '@/lib/errors';
import { detectBrowserTimezone } from '@/utils/date';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function timezoneOptions(current: string): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
  const supported = typeof intl.supportedValuesOf === 'function' ? intl.supportedValuesOf('timeZone') : [];
  const list = supported.length > 0 ? supported : ['UTC', 'Asia/Kolkata', 'Europe/London', 'America/New_York'];
  return Array.from(new Set([current, detectBrowserTimezone(), ...list])).filter(Boolean);
}

export default function SettingsPage() {
  const { profile, saveProfile, user } = useAuth();
  const toast = useToast();
  const [saved, setSaved] = useState(false);

  const timezones = useMemo(() => timezoneOptions(profile?.timezone ?? detectBrowserTimezone()), [profile?.timezone]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: profile?.name ?? '',
      timezone: profile?.timezone ?? detectBrowserTimezone(),
      week_starts_on: profile?.week_starts_on ?? 1,
      report_prefix: profile?.report_prefix ?? 'OC',
      theme: profile?.theme ?? 'system',
    },
  });

  useEffect(() => {
    if (!profile) return;
    reset({
      name: profile.name ?? '',
      timezone: profile.timezone,
      week_starts_on: profile.week_starts_on,
      report_prefix: profile.report_prefix,
      theme: profile.theme,
    });
  }, [profile, reset]);

  if (!profile) return <LoadingState label="Loading settings…" />;

  const onSubmit = handleSubmit(async (values) => {
    setSaved(false);
    try {
      await saveProfile(values);
      setSaved(true);
      toast.success('Settings saved.');
    } catch (error) {
      toast.error(toAppError(error, 'saveSettings').userMessage);
    }
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Preferences are stored in the database and follow you to any device.
        </p>
      </header>

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <Card>
          <CardHeader title="Profile" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Display name" error={errors.name?.message} required>
              {({ id, describedBy, invalid }) => (
                <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} {...register('name')} />
              )}
            </Field>
            <Field label="Email" hint="Change your email address from your account provider.">
              {({ id }) => <TextInput id={id} value={user?.email ?? profile.email} readOnly disabled />}
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Time and calendar"
            description="Timestamps are stored in UTC; your work date is calculated in this timezone."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Timezone" error={errors.timezone?.message} required>
              {({ id, describedBy, invalid }) => (
                <SelectInput id={id} aria-describedby={describedBy} aria-invalid={invalid} {...register('timezone')}>
                  {timezones.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </SelectInput>
              )}
            </Field>
            <Field label="Week starts on" error={errors.week_starts_on?.message}>
              {({ id, describedBy }) => (
                <SelectInput id={id} aria-describedby={describedBy} {...register('week_starts_on', { valueAsNumber: true })}>
                  {WEEKDAYS.map((day, index) => (
                    <option key={day} value={index}>
                      {day}
                    </option>
                  ))}
                </SelectInput>
              )}
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Reports and appearance" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Report prefix"
              hint="Used for export filenames, for example “OC September 2026.xlsx”."
              error={errors.report_prefix?.message}
              required
            >
              {({ id, describedBy, invalid }) => (
                <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} {...register('report_prefix')} />
              )}
            </Field>
            <Field label="Theme" error={errors.theme?.message}>
              {({ id, describedBy }) => (
                <SelectInput id={id} aria-describedby={describedBy} {...register('theme')}>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </SelectInput>
              )}
            </Field>
          </div>
        </Card>

        {saved ? <Alert tone="success">Your settings have been saved.</Alert> : null}

        <div className="flex gap-2">
          <Button type="submit" loading={isSubmitting} loadingLabel="Saving settings…">
            Save settings
          </Button>
          <Button type="button" variant="secondary" onClick={() => reset()} disabled={isSubmitting}>
            Reset changes
          </Button>
        </div>
      </form>

      <Card>
        <CardHeader title="Privacy" />
        <p className="flex gap-2 text-sm text-slate-600 dark:text-slate-300">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          <span>
            This application stores work metadata only — category, priority, quantity, timings and
            short notes such as “CX replied”. Never record customer names, personal information,
            case contents, credentials, indicators or confidential company information.
          </span>
        </p>
      </Card>

      <Card>
        <CardHeader
          title="Planned settings"
          description="Designed for, but not yet enabled in, this version."
        />
        <ul className="list-inside list-disc space-y-1 text-sm text-slate-600 dark:text-slate-300">
          <li>Work schedule defaults</li>
          <li>Suggested lunch duration (a suggestion only — never an enforced limit)</li>
          <li>Custom work categories</li>
          <li>Export preferences</li>
          <li>JSON backup and restore</li>
        </ul>
      </Card>
    </div>
  );
}
