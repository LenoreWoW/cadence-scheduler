import React from 'react';
import { MotionConfig } from 'motion/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { queryClient } from './lib/queryClient';
import { I18nProvider } from './lib/i18n';
import { AuthProvider, useAuth } from './lib/auth';
import { Shell } from './Shell';
import { Home } from './routes/Home';
import { Login } from './routes/Login';
import { Book } from './routes/Book';
import { Requests } from './routes/Requests';
import { Schedule } from './routes/Schedule';
import { Profile } from './routes/Profile';

const Protected: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

export const App: React.FC = () => (
  <MotionConfig reducedMotion="user">
  <I18nProvider>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Protected><Shell /></Protected>}>
            <Route index element={<Home />} />
            <Route path="book" element={<Book />} />
            <Route path="requests" element={<Requests />} />
            <Route path="schedule" element={<Schedule />} />
            <Route path="profile" element={<Profile />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </QueryClientProvider>
  </I18nProvider>
  </MotionConfig>
);
