import React, { useState } from 'react';

interface FloatingLabelInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const FloatingLabelInput: React.FC<FloatingLabelInputProps> = ({ 
  label, 
  value, 
  onChange, 
  error,
  className = '',
  ...props 
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = value && value.toString().length > 0;
  
  return (
    <div className={`relative ${className}`}>
      <input
        className={`
          peer pt-6 pb-2 px-4 w-full border rounded-lg bg-white dark:bg-gray-800
          focus:outline-none focus:ring-2 focus:ring-[#8A1538] focus:border-transparent
          disabled:bg-gray-50 disabled:text-gray-500
          transition-all duration-200
          ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-700'}
        `}
        value={value}
        onChange={onChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder=" " // Required for peer-placeholder-shown trick if we used CSS-only, but we use state
        {...props}
      />
      <label
        className={`
          absolute left-4 transition-all duration-200 pointer-events-none
          ${isFocused || hasValue 
            ? 'top-2 text-xs text-[#8A1538]' 
            : 'top-1/2 -translate-y-1/2 text-gray-400'}
          ${error ? 'text-red-500' : ''}
        `}
      >
        {label}
      </label>
      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
    </div>
  );
};

