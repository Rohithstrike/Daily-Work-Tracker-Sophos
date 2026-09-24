import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Alert';
import { resetPasswordSchema, type ResetPasswordValues } from '@/lib/schemas';
import { authErrorMessage } from '@/lib/errors';
import { useAuth } from '@/features/auth/AuthProvider';

export default function ResetPasswordPage() {
  const { updatePassword, session } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await updatePassword(values.password);
      navigate('/today', { replace: true });
    } catch (error) {
      setFormError(authErrorMessage(error));
    }
  });

  return (
    <>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Choose a new password</h2>
      {!session ? (
        <Alert tone="warning" className="mt-4">
          Open this page from the reset link in your email so we can verify your identity.
        </Alert>
      ) : null}

      <form className="mt-5 space-y-4" onSubmit={onSubmit} noValidate>
        {formError ? <Alert tone="error">{formError}</Alert> : null}
        <Field label="New password" hint="At least 8 characters." error={errors.password?.message} required>
          {({ id, describedBy, invalid }) => (
            <TextInput id={id} type="password" autoComplete="new-password" aria-describedby={describedBy} aria-invalid={invalid} {...register('password')} />
          )}
        </Field>
        <Field label="Confirm new password" error={errors.confirmPassword?.message} required>
          {({ id, describedBy, invalid }) => (
            <TextInput id={id} type="password" autoComplete="new-password" aria-describedby={describedBy} aria-invalid={invalid} {...register('confirmPassword')} />
          )}
        </Field>
        <Button type="submit" className="w-full" loading={isSubmitting} loadingLabel="Updating…" disabled={!session}>
          Update password
        </Button>
      </form>
    </>
  );
}
