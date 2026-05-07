import React from 'react';
import { Zap, RefreshCw, AlertTriangle } from 'lucide-react';

interface State {
  hasError: boolean;
  error: Error | null;
}

interface Props {
  children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[LifeOS] Error no controlado:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex flex-col min-h-screen bg-indigo-950 items-center justify-center p-6 text-center gap-6">
        <div className="flex flex-col items-center gap-3">
          <div className="bg-indigo-500 p-3 rounded-2xl shadow-lg">
            <Zap size={28} className="text-white" fill="white" />
          </div>
          <h1 className="text-xl font-black text-white uppercase italic tracking-tight">LifeOS</h1>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 max-w-sm w-full space-y-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 mx-auto">
            <AlertTriangle size={22} className="text-red-400" />
          </div>
          <div>
            <p className="text-white font-black text-base">Algo salió mal</p>
            <p className="text-indigo-400 text-xs font-medium mt-1 leading-relaxed">
              Ocurrió un error inesperado. Intenta recargar la página.
            </p>
            {this.state.error && (
              <p className="text-indigo-600 text-[10px] font-mono mt-2 break-all">
                {this.state.error.message}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-2xl transition-all active:scale-[0.98]"
            >
              <RefreshCw size={14} />
              Recargar LifeOS
            </button>
            <button
              onClick={this.handleReset}
              className="w-full text-indigo-400 hover:text-indigo-300 font-bold text-xs uppercase tracking-widest py-2 transition-all"
            >
              Intentar sin recargar
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
