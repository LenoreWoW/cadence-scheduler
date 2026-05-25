
import React, { useState } from 'react';
import { Button } from './Button';
import { authService } from '../services/authService';
import { User, Language } from '../types';
import { LoginScene3D } from './LoginScene3D';

interface LoginPageProps {
  onLogin: (user: User) => void;
  lang: Language;
  t: (key: string) => string;
  toggleLang: () => void;
  initialMode?: 'login' | 'register';
}

type AuthMode = 'login' | 'register';

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, lang, t, toggleLang, initialMode }) => {
  // Determine initial mode from prop or URL path
  const getInitialAuthMode = (): AuthMode => {
    if (initialMode) return initialMode;
    const path = window.location.pathname;
    if (path === '/register') return 'register';
    return 'login';
  };
  
  const [authMode, setAuthMode] = useState<AuthMode>(getInitialAuthMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isLogin = authMode === 'login';
  const isRegister = authMode === 'register';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const user = await authService.login(username.trim(), password);
        onLogin(user);
      } else if (isRegister) {
        // The register form's second field is labelled "username" in the UI but
        // bound to `regEmail`. Use it as both the username and (when it looks
        // like an email) the email field on the API call.
        const trimmedIdentifier = regEmail.trim();
        const looksLikeEmail = /.+@.+\..+/.test(trimmedIdentifier);
        const user = await authService.register(
          regName.trim(),
          trimmedIdentifier,
          regPassword,
          looksLikeEmail ? trimmedIdentifier : undefined,
        );
        onLogin(user);
      }
    } catch (err: any) {
      // `ApiError` exposes a parsed `.body` with `{ error }` from the server,
      // but fall back to `.message` for network errors or unknown shapes.
      const errorMessage =
        err?.body?.error ||
        err?.message ||
        (isLogin ? 'Login failed' : 'Registration failed');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white overflow-hidden font-sans" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      
      {/* LEFT SIDE: Immersive World (60%) */}
      <div className="relative w-full md:w-[60%] bg-black overflow-hidden flex flex-col justify-between order-2 md:order-1">
         <div className="absolute inset-0 z-0">
            <LoginScene3D />
         </div>
         
         <div className="relative z-10 p-8 md:px-10 md:py-8 pointer-events-none flex justify-between">
            <h1 className="text-white text-2xl font-display font-bold tracking-tight mix-blend-difference">REGENT.</h1>
         </div>
      </div>

      {/* RIGHT SIDE: Login Form (40%) - Clean professional design */}
      <div className="w-full md:w-[40%] flex flex-col justify-center p-8 lg:p-16 bg-white relative z-20 shadow-2xl order-1 md:order-2">
         
         <div className="absolute top-8 right-8">
            <button onClick={toggleLang} className="text-xs font-bold border border-gray-200 px-4 py-2 rounded-full text-gray-600 hover:bg-[#8A1538] hover:text-white hover:border-[#8A1538] transition-colors uppercase tracking-wider">
               {lang === 'en' ? 'Arabic' : 'English'}
            </button>
         </div>

         <div className="w-full max-w-sm mx-auto animate-reveal delay-100">
            <div className="mb-10">
               <h3 className="text-3xl font-display font-semibold text-charcoal mb-2">
                  {isLogin ? t('welcome') : t('createAccount')}
               </h3>
               <p className="text-dune text-sm">
                  {isLogin ? t('loginTitle') : t('registerTitle')}
               </p>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
               {isRegister && (
                  <div className="relative group">
                     <input
                        type="text"
                        required
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        className="input peer block w-full border-b border-gray-300 bg-transparent py-3 px-0 text-sm text-charcoal focus:border-al-adaam focus:outline-none focus:ring-0"
                        placeholder=" "
                     />
                     <label className="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-xs text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-al-adaam">
                        {t('fullName')}
                     </label>
                  </div>
               )}

               <div className="relative group">
                  <input
                     type="text"
                     required
                     value={isLogin ? username : regEmail}
                     onChange={(e) => {
                        if (isLogin) {
                           setUsername(e.target.value);
                        } else {
                           setRegEmail(e.target.value);
                        }
                     }}
                     className="input peer block w-full border-b border-gray-300 bg-transparent py-3 px-0 text-sm text-charcoal focus:border-al-adaam focus:outline-none focus:ring-0"
                     placeholder=" "
                  />
                  <label className="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-xs text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-al-adaam">
                     {t('username')}
                  </label>
               </div>

               <div className="relative group">
                  <input
                     type={showPassword ? "text" : "password"}
                     required
                     value={isLogin ? password : regPassword}
                     onChange={(e) => isLogin ? setPassword(e.target.value) : setRegPassword(e.target.value)}
                     className="input peer block w-full border-b border-gray-300 bg-transparent py-3 px-0 text-sm text-charcoal focus:border-al-adaam focus:outline-none focus:ring-0 pr-10"
                     placeholder=" "
                  />
                  <label className="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-xs text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-al-adaam">
                     {t('password')}
                  </label>
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 top-3 text-gray-400 hover:text-al-adaam transition-colors"
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
               </div>

               {error && (
                  <div className="text-salmon text-xs font-bold p-3 bg-salmon/5 border-l-2 border-salmon rounded-r animate-shake flex items-center gap-2">
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                     {error}
                  </div>
               )}

               <div className="pt-4">
                  <Button type="submit" fullWidth loading={loading} className="shadow-xl shadow-al-adaam/10">
                     {isLogin ? t('signIn') : t('createAccount')}
                  </Button>
               </div>

               {/* Google SSO */}
               <div className="relative">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                     <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
                     <span className="bg-white px-3 text-gray-400 font-mono">
                        {lang === 'ar' ? 'أو' : 'Or'}
                     </span>
                  </div>
               </div>
               <button
                  type="button"
                  onClick={() => {
                     const apiUrl = (import.meta.env?.VITE_API_URL as string | undefined) || 'http://localhost:3001';
                     window.location.href = `${apiUrl}/api/sso/google/login`;
                  }}
                  className="w-full inline-flex items-center justify-center gap-3 px-5 py-3 bg-white border border-gray-200 rounded text-sm font-medium text-charcoal hover:border-charcoal hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
                  aria-label={lang === 'ar' ? 'تسجيل الدخول باستخدام Google' : 'Sign in with Google'}
               >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                     <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                     <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                     <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                     <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>{lang === 'ar' ? 'تسجيل الدخول باستخدام Google' : 'Sign in with Google'}</span>
               </button>
            </form>
            
            {/* Auth mode switcher */}
            <div className="mt-8 space-y-4">
               <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-gray-400">{isLogin ? t('newToApp') : t('alreadyHaveAccount')}</span>
                  <button 
                     onClick={() => { setAuthMode(isLogin ? 'register' : 'login'); setError(''); }} 
                     className="font-bold text-charcoal hover:text-al-adaam uppercase tracking-wider transition-colors"
                  >
                     {isLogin ? t('signUp') : t('backToLogin')}
                  </button>
               </div>
            </div>
            
            {/* Demo credentials */}
            <div className="mt-12 pt-8 border-t border-gray-100">
               <details className="group">
                  <summary className="text-[10px] text-dune font-mono uppercase tracking-widest cursor-pointer list-none flex items-center gap-2 hover:text-charcoal transition-colors">
                     <span>Demo Credentials</span>
                     <svg className="w-3 h-3 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </summary>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                     {['admin', 'manager', 'sub', 'user1'].map(u => (
                       <button 
                         key={u}
                         onClick={() => { setUsername(u); setPassword('password'); }}
                         className="text-left p-2 bg-gray-50 hover:bg-gray-100 rounded border border-gray-100 text-xs font-mono transition-colors"
                       >
                         <span className="block font-bold text-charcoal">{u}</span>
                         <span className="text-[10px] text-gray-400">pass: password</span>
                       </button>
                     ))}
                  </div>
               </details>
            </div>
         </div>
      </div>
    </div>
  );
};
