import React from 'react';
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/react';
import { ChevronDownIcon, CheckIcon } from './icons';

export interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}

// Themed select (Headless UI Listbox) — replaces the native <select> so the
// dropdown matches the app's theme/dark/RTL instead of the OS's oversized popup.
export const Select: React.FC<SelectProps> = ({ value, onChange, options, placeholder, ariaLabel, className = '' }) => {
  const selected = options.find((o) => o.value === value);
  return (
    <Listbox value={value} onChange={onChange}>
      <ListboxButton
        aria-label={ariaLabel}
        className={`ring-focus surface-2 flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm ${className}`}
      >
        <span className={`truncate text-start ${selected ? '' : 'text-muted'}`}>{selected ? selected.label : placeholder}</span>
        <ChevronDownIcon size={16} className="shrink-0 text-muted" />
      </ListboxButton>
      <ListboxOptions
        anchor="bottom"
        transition
        className="z-50 max-h-72 w-[var(--button-width)] overflow-auto rounded-xl surface p-1.5 [--anchor-gap:6px] [box-shadow:var(--shadow)] focus:outline-none transition data-[closed]:opacity-0"
      >
        {options.map((o) => (
          <ListboxOption
            key={o.value}
            value={o.value}
            className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm data-[focus]:bg-[color:var(--surface-2)] data-[selected]:text-al-adaam data-[selected]:font-medium"
          >
            <span className="truncate text-start">{o.label}</span>
            {o.value === value && <CheckIcon size={16} className="shrink-0 text-al-adaam" />}
          </ListboxOption>
        ))}
      </ListboxOptions>
    </Listbox>
  );
};
