import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Alert';
import { signInSchema, type SignInValues } from '@/lib/schemas';
import { authErrorMessage } from '@/lib/errors';
import { useAuth } from '@/features/auth/AuthProvider';

export default function SignInPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({ resolver: zodResolver(signInSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await signIn(values.email, values.password);
      navigate('/today', { replace: true });
    } catch (error) {
      setFormError(authErrorMessage(error));
    }
  });

  return (
    <>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Sign in</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Continue tracking your workday.
      </p>

      <form className="mt-5 space-y-4" onSubmit={onSubmit} noValidate>
        {formError ? <Alert tone="error">{formError}</Alert> : null}

        <Field label="Email" error={errors.email?.message} required>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              type="email"
              autoComplete="email"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              {...register('email')}
            />
          )}
        </Field>

        <Field label="Password" error={errors.password?.message} required>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              type="password"
              autoComplete="current-password"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              {...register('password')}
            />
          )}
        </Field>

        <Button type="submit" className="w-full" loading={isSubmitting} loadingLabel="Signing in…">
          Sign in
        </Button>
      </form>

      <div className="mt-5 flex flex-col gap-2 text-sm">
        <Link className="text-brand-700 hover:underline dark:text-brand-300" to="/forgot-password">
          Forgot your password?
        </Link>
        <p className="text-slate-600 dark:text-slate-400">
          No account?{' '}
          <Link className="text-brand-700 hover:underline dark:text-brand-300" to="/sign-up">
            Create one now
          </Link>
        </p>
      </div>
    </>
  );
}
