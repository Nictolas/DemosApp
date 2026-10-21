import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Copy } from 'lucide-react';
import { getSafeCrashDiagnostic } from '@/lib/crashDiagnostic';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  diagnosisCopied: boolean;
}

/**
 * Error Boundary per contenere crash durante render o lifecycle.
 * Evita che un errore in una pagina (es. durante scroll/re-render) faccia cadere l'intera app.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, diagnosisCopied: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, diagnosisCopied: false };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo);
    if (process.env.NODE_ENV !== 'production') {
      console.error('ErrorBoundary caught:', error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, diagnosisCopied: false });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleCopyDiagnosis = async () => {
    if (!this.state.error) return;
    try {
      await navigator.clipboard.writeText(getSafeCrashDiagnostic(this.state.error));
      this.setState({ diagnosisCopied: true });
    } catch {
      // The diagnostic remains visible/selectable for a screenshot if copy is blocked.
      this.setState({ diagnosisCopied: false });
    }
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
          <p className="text-sm text-muted-foreground text-center max-w-md mb-3">
            Si è verificato un errore. Puoi riprovare o ricaricare la pagina.
          </p>
          <p className="text-xs text-muted-foreground text-center max-w-md">
            Su cellulare puoi fare uno screenshot del codice qui sotto e inviarlo all'assistenza DEMOS, senza aprire strumenti per sviluppatori.
          </p>
          <code
            className="mt-2 mb-3 max-w-full break-all select-text text-center text-xs bg-muted rounded p-2"
            aria-label="Codice diagnostico"
          >
            {getSafeCrashDiagnostic(this.state.error)}
          </code>
          <Button variant="outline" onClick={this.handleCopyDiagnosis} className="mb-4 gap-2">
            <Copy className="h-4 w-4" />
            {this.state.diagnosisCopied ? "Diagnosi copiata" : "Copia diagnosi"}
          </Button>
          <div className="flex flex-wrap justify-center gap-3">
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
