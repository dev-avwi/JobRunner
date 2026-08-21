import { Component, ErrorInfo } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";
import { isChunkLoadError, clearReloadFlag } from "@/lib/lazyWithReload";

// Benign dev-only noise: the Vite HMR client tries to open a WebSocket at
// `wss://localhost:undefined/?token=...` when its host/port can't resolve.
// It self-recovers and means nothing to end users — never report it.
function isBenignWebSocketNoise(msg?: string): boolean {
  if (!msg) return false;
  if (msg.includes('localhost:undefined') && msg.includes('WebSocket')) return true;
  if (msg.includes("Failed to construct 'WebSocket'")) return true;
  return false;
}

// Benign browser noise: "ResizeObserver loop completed with undelivered
// notifications." (and the older "loop limit exceeded" variant) just means the
// browser deferred observer delivery one frame. Nothing breaks and no user is
// affected — never report it.
function isBenignResizeObserverNoise(msg?: string): boolean {
  if (!msg) return false;
  return msg.includes('ResizeObserver loop');
}

// "Script error." (with or without a trailing period) is what browsers report
// when an error originates in a cross-origin script. The browser deliberately
// strips all detail to prevent cross-origin data leakage. It is never
// actionable — we have no stack, no file, no line — so don't report it.
function isCrossOriginScriptError(msg?: string): boolean {
  if (!msg) return false;
  const t = msg.trim();
  return t === 'Script error.' || t === 'Script error';
}

function reportErrorToServer(data: {
  message: string;
  stack?: string;
  componentStack?: string;
  url?: string;
}) {
  if (isBenignWebSocketNoise(data.message)) return;
  if (isBenignResizeObserverNoise(data.message)) return;
  if (isCrossOriginScriptError(data.message)) return;
  try {
    fetch('/api/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        url: data.url || window.location.href,
        userAgent: navigator.userAgent,
      }),
    }).catch(() => {});
  } catch {
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    // Stale lazy-chunk loads after a deploy are transient and self-recover via
    // lazyWithReload / ChunkErrorBoundary — don't spam the error reporter.
    if (isChunkLoadError(event.error) || isChunkLoadError(event.message)) return;
    reportErrorToServer({
      message: event.message || 'Unhandled window error',
      stack: event.error?.stack,
      url: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : window.location.href,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (isChunkLoadError(reason)) return;
    reportErrorToServer({
      message: reason?.message || String(reason) || 'Unhandled promise rejection',
      stack: reason?.stack,
    });
  });
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorUrl: string;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorUrl: '' };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error, errorUrl: window.location.href };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error.message, error.stack);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    trackEvent("app_crash", {
      error: error.message?.substring(0, 200),
      componentStack: errorInfo.componentStack?.substring(0, 500),
    });

    reportErrorToServer({
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack || undefined,
    });

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    this.checkInterval = setInterval(() => {
      if (window.location.href !== this.state.errorUrl) {
        this.setState({ hasError: false, error: null, errorUrl: '' });
        if (this.checkInterval) {
          clearInterval(this.checkInterval);
          this.checkInterval = null;
        }
      }
    }, 500);
  }

  componentWillUnmount() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="flex flex-col items-center text-center pt-8 pb-8 gap-4">
              <div className="rounded-full bg-destructive/10 p-3">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <h1 className="text-xl font-semibold text-foreground">
                Something went wrong
              </h1>
              <p className="text-muted-foreground text-sm">
                We hit a snag. Try again or go back to the dashboard.
              </p>
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                <Button onClick={() => {
                  if (this.checkInterval) { clearInterval(this.checkInterval); this.checkInterval = null; }
                  this.setState({ hasError: false, error: null, errorUrl: '' });
                }}>
                  Try Again
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    this.setState({ hasError: false, error: null, errorUrl: '' });
                    window.location.href = "/";
                  }}
                >
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

interface PageErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class PageErrorBoundary extends Component<ErrorBoundaryProps, PageErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): PageErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[PageError] Caught error:', error.message);
    reportErrorToServer({
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack || undefined,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center p-8 min-h-[300px]">
          <div className="text-center space-y-3">
            <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">This page couldn't load properly.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try Again
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface ChunkErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches stale lazy-chunk load failures that the guarded reload in
 * `lazyWithReload` could not recover from (i.e. a reload was already attempted
 * and the import still failed). Shows a friendly "new version available" prompt
 * instead of a blank screen or a crash. Any non-chunk error is re-thrown during
 * render so the surrounding ErrorBoundary handles it normally.
 */
export class ChunkErrorBoundary extends Component<ErrorBoundaryProps, ChunkErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ChunkErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (isChunkLoadError(error)) {
      console.warn('[ChunkErrorBoundary] Stale chunk load failed after reload guard tripped:', error.message);
      trackEvent("stale_chunk_recovery_prompt", {
        error: error.message?.substring(0, 200),
      });
    } else {
      reportErrorToServer({
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack || undefined,
      });
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.state.error && !isChunkLoadError(this.state.error)) {
        // Not a chunk error — let an outer boundary deal with it.
        throw this.state.error;
      }
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="flex flex-col items-center text-center pt-8 pb-8 gap-4">
              <div className="rounded-full bg-primary/10 p-3">
                <RefreshCw className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-xl font-semibold text-foreground">
                A new version is available
              </h1>
              <p className="text-muted-foreground text-sm">
                The app was updated. Reload to get the latest version.
              </p>
              <Button
                className="mt-2"
                onClick={() => {
                  clearReloadFlag();
                  window.location.reload();
                }}
              >
                Reload
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}
