import React from 'react';
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useI18n, roleLabelKey } from '../lib/i18n';
import { themeService } from '../../services/themeService';
import { ChevronDownIcon, UserIcon, GlobeIcon, MoonIcon, SunIcon, LogOutIcon } from './icons';

const initials = (name: string): string =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';

// Single account control: avatar + name → dropdown with profile, language,
// dark-mode and sign-out (replaces the loose name/language/sign-out trio).
export const AccountMenu: React.FC = () => {
  const { user, logout } = useAuth();
  const { t, lang, toggle: toggleLang } = useI18n();
  const nav = useNavigate();
  const [dark, setDark] = React.useState(() => themeService.isDarkMode());
  React.useEffect(() => {
    const unsub = themeService.subscribe(() => setDark(themeService.isDarkMode()));
    return () => { unsub(); };
  }, []);

  if (!user) return null;
  const roleKey = roleLabelKey(user.role);

  const itemCls =
    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-start data-[focus]:bg-[color:var(--surface-2)]';

  return (
    <Menu as="div" className="relative">
      <MenuButton data-testid="account-button" className="ring-focus flex items-center gap-2 rounded-full py-1 ps-1 pe-2.5 hover:bg-[color:var(--surface-2)] transition-colors">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-al-adaam text-white text-xs font-semibold select-none">
          {initials(user.name)}
        </span>
        <span className="hidden sm:block text-sm font-medium max-w-[10rem] truncate">{user.name}</span>
        <ChevronDownIcon size={16} className="text-muted hidden sm:block" />
      </MenuButton>

      <MenuItems
        anchor="bottom end"
        transition
        className="z-50 mt-2 w-60 origin-top surface rounded-xl p-1.5 [box-shadow:var(--shadow)] focus:outline-none transition data-[closed]:scale-95 data-[closed]:opacity-0"
      >
        <div className="px-3 pt-2 pb-3 border-b border-[color:var(--border)] mb-1.5">
          <p className="font-medium truncate">{user.name}</p>
          <p className="text-muted text-xs mt-0.5">{roleKey ? t(roleKey) : user.role}</p>
        </div>

        <MenuItem>
          <button data-testid="account-profile" className={itemCls} onClick={() => nav('/profile')}>
            <UserIcon size={18} className="text-muted" />
            {t('nav.profile')}
          </button>
        </MenuItem>

        <MenuItem>
          <button className={itemCls} onClick={() => themeService.toggle()}>
            {dark ? <SunIcon size={18} className="text-muted" /> : <MoonIcon size={18} className="text-muted" />}
            {dark ? t('account.lightMode') : t('profile.darkMode')}
          </button>
        </MenuItem>

        <MenuItem>
          <button data-testid="account-language" className={itemCls} onClick={() => toggleLang()}>
            <GlobeIcon size={18} className="text-muted" />
            <span className="flex-1 text-start">{t('profile.language')}</span>
            <span className="text-muted text-xs">{lang === 'en' ? 'العربية' : 'English'}</span>
          </button>
        </MenuItem>

        <div className="my-1.5 border-t border-[color:var(--border)]" />

        <MenuItem>
          <button data-testid="account-signout" className={`${itemCls} text-bad`} onClick={async () => { await logout(); nav('/login'); }}>
            <LogOutIcon size={18} />
            {t('common.signOut')}
          </button>
        </MenuItem>
      </MenuItems>
    </Menu>
  );
};
