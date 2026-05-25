import React from 'react';
import { motion } from 'motion/react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'default';
  fullWidth?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false,
  className = '',
  loading = false,
  icon,
  onClick,
  ...props 
}) => {
  const baseStyle = "relative inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded font-medium text-sm uppercase tracking-wider transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden";
  
  const variants = {
    primary: "bg-al-adaam text-white hover:bg-al-adaam-dark shadow-lg shadow-al-adaam/25 hover:shadow-xl focus:ring-al-adaam",
    secondary: "bg-transparent border border-dune text-charcoal hover:border-al-adaam hover:text-al-adaam focus:ring-dune",
    default: "bg-white border border-gray-200 text-charcoal hover:border-gray-300 hover:bg-gray-50 shadow-sm focus:ring-gray-300",
    danger: "bg-salmon text-white hover:bg-red-700 focus:ring-salmon shadow-lg shadow-salmon/20",
    success: "bg-palm text-white hover:bg-green-700 focus:ring-palm shadow-lg shadow-palm/20",
    ghost: "bg-transparent text-dune hover:text-charcoal hover:bg-gray-100/50 focus:ring-gray-300"
  };

  return (
    <motion.button 
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className={`${baseStyle} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${loading ? 'text-transparent' : ''} ${className}`}
      onClick={onClick}
      disabled={loading || props.disabled}
      {...props as any}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-current">
           <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin opacity-70"></div>
        </div>
      )}
      {!loading && icon && <span className="flex-shrink-0">{icon}</span>}
      <span className={loading ? 'opacity-0' : 'opacity-100'}>{children}</span>
    </motion.button>
  );
};
