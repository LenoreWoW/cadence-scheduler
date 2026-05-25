
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  success?: boolean;
}

export const Input: React.FC<InputProps> = ({ label, error, success, className = '', ...props }) => {
  return (
    <div className={`input-group ${className}`}>
      <input
        className={`input ${error ? 'input--error' : ''} ${success ? 'input--success' : ''}`}
        placeholder=" "
        {...props}
      />
      <label className="input-label">
        {label}
      </label>
      
      {success && (
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-palm animate-check-pop pointer-events-none">
           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        </div>
      )}
      
      {error && (
        <div className="input-error-message text-salmon text-xs mt-1 flex items-center gap-1 animate-shake">
           <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
           {error}
        </div>
      )}
    </div>
  );
};
