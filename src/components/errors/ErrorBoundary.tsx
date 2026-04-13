import React, { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("APP_ERROR_BOUNDARY:", error, info);
    // TODO: Send to Sentry when ready
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="text-center max-w-md">
              <div className="text-6xl mb-4">😕</div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Something went wrong</h1>
              <p className="text-gray-500 mb-6">We hit an unexpected error. Your data is safe.</p>
              <button
                onClick={() => window.location.reload()}
                className="bg-purple-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-purple-700 transition-colors"
              >
                Reload App
              </button>
              {process.env.NODE_ENV === "development" && (
                <pre className="mt-4 text-left text-xs bg-red-50 p-3 rounded-lg text-red-700 overflow-auto">
                  {this.state.error?.message}
                </pre>
              )}
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
