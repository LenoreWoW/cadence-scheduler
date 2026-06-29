import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { I18nProvider, useI18n } from '../../app/lib/i18n';
import { languageService } from '../../services/languageService';

const Probe: React.FC = () => {
  const { t, lang, dir } = useI18n();
  return (
    <div>
      <span data-testid="nav">{t('nav.home')}</span>
      <span data-testid="interp">{t('meeting.with', { name: 'Sara' })}</span>
      <span data-testid="lang">{lang}</span>
      <span data-testid="dir">{dir}</span>
      <button onClick={() => languageService.toggle()}>toggle</button>
    </div>
  );
};

const renderProbe = () => render(<I18nProvider><Probe /></I18nProvider>);

describe('i18n provider', () => {
  afterEach(() => languageService.setLanguage('en'));

  it('renders English by default and interpolates placeholders', () => {
    renderProbe();
    expect(screen.getByTestId('nav')).toHaveTextContent('Home');
    expect(screen.getByTestId('interp')).toHaveTextContent('with Sara');
    expect(screen.getByTestId('lang')).toHaveTextContent('en');
    expect(screen.getByTestId('dir')).toHaveTextContent('ltr');
  });

  it('reacts to a language switch (Arabic + RTL)', () => {
    renderProbe();
    fireEvent.click(screen.getByText('toggle'));
    expect(screen.getByTestId('nav')).toHaveTextContent('الرئيسية');
    expect(screen.getByTestId('interp')).toHaveTextContent('مع Sara');
    expect(screen.getByTestId('dir')).toHaveTextContent('rtl');
  });
});
