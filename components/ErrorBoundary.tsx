
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './Button';

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
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    // Attempt to clear local storage if data corruption is suspected
    // But keep it safe, maybe just reload
    window.location.reload();
  };

  private handleClearData = () => {
     if(confirm('This will clear all local data and reset the app. Are you sure?')) {
        localStorage.clear();
        window.location.reload();
     }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 font-sans text-center">
          <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-gray-200">
            <div className="w-16 h-16 bg-salmon/10 text-salmon rounded-full flex items-center justify-center mx-auto mb-6">
               <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h1 className="text-2xl font-serif font-bold text-charcoal mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-500 mb-6">
              The application encountered an unexpected error. 
            </p>
            
            <div className="p-4 bg-gray-100 rounded-lg text-left text-xs font-mono text-gray-700 mb-6 overflow-auto max-h-32">
               {this.state.error?.message || 'Unknown error'}
            </div>

            <div className="space-y-3">
               <Button onClick={this.handleReset} fullWidth>
                  Reload Application
               </Button>
               <button onClick={this.handleClearData} className="text-xs text-gray-400 hover:text-salmon underline transition-colors">
                  Clear data and reset
               </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
