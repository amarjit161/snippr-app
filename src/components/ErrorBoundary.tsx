import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
          <div className="relative w-full max-w-md text-center">
            {/* Background Glow */}
            <div className="pointer-events-none absolute -inset-10 -z-10 bg-[radial-gradient(circle_at_50%_50%,_rgba(244,63,94,0.1),_transparent_70%)] opacity-50" />
            
            <div className="mb-6 flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-500">
                <AlertTriangle className="h-10 w-10" />
              </div>
            </div>

            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Something went wrong
            </h1>
            
            <p className="mt-4 text-sm text-muted-foreground">
              We encountered an unexpected error while rendering this page. Our team has been notified.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button 
                onClick={this.handleReset}
                className="h-11 gap-2 rounded-xl bg-primary px-6"
              >
                <RefreshCw className="h-4 w-4" />
                Reload Page
              </Button>
              <Button 
                onClick={this.handleGoHome}
                variant="outline"
                className="h-11 gap-2 rounded-xl px-6"
              >
                <Home className="h-4 w-4" />
                Back to Home
              </Button>
            </div>

            {process.env.NODE_ENV === "development" && this.state.error && (
              <div className="mt-10 rounded-xl border border-border bg-muted/50 p-4 text-left">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Debug Info (Dev Only)
                </p>
                <pre className="max-h-40 overflow-auto text-[10px] text-red-500">
                  {this.state.error.stack}
                </pre>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
