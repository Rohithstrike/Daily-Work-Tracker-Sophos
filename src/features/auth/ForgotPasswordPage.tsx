import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Alert';
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/lib/schemas';
import { authErrorMessage } from '@/lib/errors';
import { useAuth } from '@/features/auth/AuthProvider';

export default function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth();
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await sendPasswordReset(values.email);
      setSent(true);
    } catch (error) {
      setFormError(authErrorMessage(error));
    }
  });

  return (
    <>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Reset your password</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        We will email you a secure link to choose a new password.
      </p>

      {sent ? (
        <Alert tone="success" className="mt-4">
          If an account exists for that address, a reset link is on its way.
        </Alert>
      ) : (
        <form className="mt-5 space-y-4" onSubmit={onSubmit} noValidate>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <Field label="Email" error={errors.email?.message} required>
            {({ id, describedBy, invalid }) => (
              <TextInput id={id} type="email" autoComplete="email" aria-describedby={describedBy} aria-invalid={invalid} {...register('email')} />
            )}
          </Field>
          <Button type="submit" className="w-full" loading={isSubmitting} loadingLabel="Sending…">
            Send reset link
          </Button>
        </form>
      )}

      <Link className="mt-5 inline-block text-sm text-brand-700 hover:underline dark:text-brand-300" to="/sign-in">
        Back to sign in
      </Link>
    </>
  );
}
