import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Alert';
import { signUpSchema, type SignUpValues } from '@/lib/schemas';
import { authErrorMessage } from '@/lib/errors';
import { useAuth } from '@/features/auth/AuthProvider';

export default function SignUpPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({ resolver: zodResolver(signUpSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const { needsConfirmation } = await signUp(values.email, values.password, values.name);
      if (needsConfirmation) setConfirmationSent(true);
      else navigate('/today', { replace: true });
    } catch (error) {
      setFormError(authErrorMessage(error));
    }
  });

  if (confirmationSent) {
    return (
      <>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Check your email</h2>
        <Alert tone="success" className="mt-4">
          We have sent you a confirmation link. Open it to activate your account, then sign in.
        </Alert>
        <Link
          className="mt-5 inline-block text-sm text-brand-700 hover:underline dark:text-brand-300"
          to="/sign-in"
        >
          Back to sign in
        </Link>
      </>
    );
  }

  return (
    <>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Create your account</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Your records are private to you.
      </p>

      <form className="mt-5 space-y-4" onSubmit={onSubmit} noValidate>
        {formError ? <Alert tone="error">{formError}</Alert> : null}

        <Field label="Display name" error={errors.name?.message} required>
          {({ id, describedBy, invalid }) => (
            <TextInput id={id} autoComplete="name" aria-describedby={describedBy} aria-invalid={invalid} {...register('name')} />
          )}
        </Field>

        <Field label="Email" error={errors.email?.message} required>
          {({ id, describedBy, invalid }) => (
            <TextInput id={id} type="email" autoComplete="email" aria-describedby={describedBy} aria-invalid={invalid} {...register('email')} />
          )}
        </Field>

        <Field label="Password" hint="At least 8 characters." error={errors.password?.message} required>
          {({ id, describedBy, invalid }) => (
            <TextInput id={id} type="password" autoComplete="new-password" aria-describedby={describedBy} aria-invalid={invalid} {...register('password')} />
          )}
        </Field>

        <Field label="Confirm password" error={errors.confirmPassword?.message} required>
          {({ id, describedBy, invalid }) => (
            <TextInput id={id} type="password" autoComplete="new-password" aria-describedby={describedBy} aria-invalid={invalid} {...register('confirmPassword')} />
          )}
        </Field>

        <Button type="submit" className="w-full" loading={isSubmitting} loadingLabel="Creating account…">
          Create account
        </Button>
      </form>

      <p className="mt-5 text-sm text-slate-600 dark:text-slate-400">
        Already registered?{' '}
        <Link className="text-brand-700 hover:underline dark:text-brand-300" to="/sign-in">
          Sign in
        </Link>
      </p>
    </>
  );
}
