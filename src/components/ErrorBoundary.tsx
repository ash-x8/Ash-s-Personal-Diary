import React from 'react';
import { BookLock, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected rendering issue occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Diary application boundary caught error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0b0c10] text-[#e8e6e3] flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-xl border border-[#252832] bg-[#12141a] p-8 text-center shadow-2xl">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-[#c5a059]/40 bg-[#c5a059]/10 text-[#c5a059]">
              <BookLock className="h-5 w-5" />
            </div>
            <h1 className="font-serif-title text-xl tracking-wide text-[#f2efe9]">
              Something Interrupted This Page
            </h1>
            <p className="mt-2.5 text-sm leading-relaxed text-[#9ca1ab]">
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                window.location.href = '/';
              }}
              className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#c5a059] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#0c0e13] hover:bg-[#d4b06a] transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Return to Book Cover
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
