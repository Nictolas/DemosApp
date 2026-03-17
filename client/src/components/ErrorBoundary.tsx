import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary per contenere crash durante render o lifecycle.
 * Evita che un errore in una pagina (es. durante scroll/re-render) faccia cadere l'intera app.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo);
    if (process.env.NODE_ENV !== 'production') {
      console.error('ErrorBoundary caught:', error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div
          className="flex flex-col items-center justify-center min-h-[200px] p-6 bg-muted/30 rounded-lg border border-destructive/20"
          role="alert"
        >
          <AlertTriangle className="h-10 w-10 text-destructive mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Qualcosa è andato storto
          </h3>
          <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
            Si è verificato un errore. Puoi riprovare o ricaricare la pagina.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={this.handleRetry} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Riprova
            </Button>
            <Button onClick={this.handleReload} className="gap-2">
              Ricarica pagina
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
