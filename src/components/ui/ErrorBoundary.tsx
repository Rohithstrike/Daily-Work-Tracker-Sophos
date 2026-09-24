import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/** Application-wide error boundary. Technical detail goes to the console only. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[workday-activity-tracker] render error', error, info.componentStack);
  }

  handleReload = (): void => {
    this.setState({ hasError: false });
    window.location.assign('/today');
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="card max-w-md p-6 text-center">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            The page could not be displayed. Your recorded data is safe in the database.
          </p>
          <Button className="mt-5" onClick={this.handleReload}>
            Return to Today
          </Button>
        </div>
      </main>
    );
  }
}
