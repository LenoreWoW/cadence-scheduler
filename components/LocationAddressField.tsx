/**
 * LocationAddressField
 *
 * Inline input for the meeting's physical location address. Rendered inside
 * BookingModal (and PublicBookingPage) when `meetingFormat === 'in-person'`.
 * For the public booking flow the link itself may provide a fixed address;
 * in that case the field shows the address as read-only display text.
 */

import React from 'react';
import { Language } from '../types';

interface Props {
  value: string;
  onChange: (next: string) => void;
  /** When set, this is treated as the immutable address from the booking link. */
  presetAddress?: string | null;
  lang: Language;
  required?: boolean;
}

export const LocationAddressField: React.FC<Props> = ({
  value,
  onChange,
  presetAddress,
  lang,
  required = false,
}) => {
  const isRTL = lang === 'ar';
  const hasPreset = !!presetAddress && presetAddress.trim().length > 0;

  return (
    <div className="mt-3" dir={isRTL ? 'rtl' : 'ltr'}>
      <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-2">
        {isRTL ? 'العنوان' : 'Address'}
        {required && !hasPreset && <span className="text-al-adaam"> *</span>}
      </label>

      {hasPreset ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 flex items-start gap-2">
          <svg
            className="w-4 h-4 mt-0.5 text-gray-500 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-charcoal whitespace-pre-line">{presetAddress}</p>
            <p className="text-[11px] text-gray-400 mt-1">
              {isRTL ? 'العنوان محدد بواسطة المضيف.' : 'Address provided by the host.'}
            </p>
          </div>
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          placeholder={isRTL ? 'الطابق، رقم المكتب، المعالم...' : 'Floor, room number, landmarks…'}
          required={required}
          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538] resize-none"
        />
      )}
    </div>
  );
};

export default LocationAddressField;
