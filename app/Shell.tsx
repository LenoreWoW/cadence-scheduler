import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { Button } from './ui/Button';

export const Shell: React.FC = () => {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const role = user?.role;

  const links = [
    { to: '/', label: 'Home', end: true, show: true },
    { to: '/requests', label: 'Requests', show: role !== 'guest' },
    { to: '/schedule', label: 'Schedule', show: true },
    { to: '/book', label: 'Book', show: true },
  ].filter((l) => l.show);

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-40 surface-2 border-b border-[color:var(--border)] backdrop-blur">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-5 h-16">
          <NavLink to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-al-adaam text-white grid place-items-center font-semibold">C</div>
            <span className="font-semibold tracking-tight text-lg">Cadence</span>
          </NavLink>
          <nav className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'bg-al-adaam/10 text-al-adaam' : 'text-muted hover:text-[color:var(--text)]'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {user && <NavLink to="/profile" className="hidden sm:block text-sm text-muted">{user.name}</NavLink>}
            <Button variant="ghost" onClick={async () => { await logout(); nav('/login'); }}>Sign out</Button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
};
