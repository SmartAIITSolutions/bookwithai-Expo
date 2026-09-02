// i18n foundation (L1) — modular namespace resources, one JSON file per
// feature area per language (src/locales/<lang>/<namespace>.json), matching
// the app's own customer/owner/shared route-group boundaries rather than
// one giant unmaintainable dictionary. Only a small, controlled seed set of
// keys exists per namespace in L1 -- full migration is L2-L7.

import enCommon from '@/locales/en/common.json';
import enAuth from '@/locales/en/auth.json';
import enOnboarding from '@/locales/en/onboarding.json';
import enBooking from '@/locales/en/booking.json';
import enCalendar from '@/locales/en/calendar.json';
import enOwner from '@/locales/en/owner.json';
import enSanaa from '@/locales/en/sanaa.json';
import enStaff from '@/locales/en/staff.json';
import enLegal from '@/locales/en/legal.json';
import enErrors from '@/locales/en/errors.json';
import enNotifications from '@/locales/en/notifications.json';

import esCommon from '@/locales/es/common.json';
import esAuth from '@/locales/es/auth.json';
import esOnboarding from '@/locales/es/onboarding.json';
import esBooking from '@/locales/es/booking.json';
import esCalendar from '@/locales/es/calendar.json';
import esOwner from '@/locales/es/owner.json';
import esSanaa from '@/locales/es/sanaa.json';
import esStaff from '@/locales/es/staff.json';
import esLegal from '@/locales/es/legal.json';
import esErrors from '@/locales/es/errors.json';
import esNotifications from '@/locales/es/notifications.json';

// Namespace list is the one place a future namespace (e.g. splitting
// `owner` further, or adding one for a new feature area) gets registered --
// i18next's `ns` init option reads straight from this.
export const NAMESPACES = [
  'common', 'auth', 'onboarding', 'booking', 'calendar', 'owner', 'sanaa', 'staff', 'legal', 'errors', 'notifications',
] as const;
export type Namespace = typeof NAMESPACES[number];

export const enResources = {
  common: enCommon, auth: enAuth, onboarding: enOnboarding, booking: enBooking,
  calendar: enCalendar, owner: enOwner, sanaa: enSanaa, staff: enStaff, legal: enLegal, errors: enErrors,
  notifications: enNotifications,
};

export const resources = {
  en: enResources,
  es: {
    common: esCommon, auth: esAuth, onboarding: esOnboarding, booking: esBooking,
    calendar: esCalendar, owner: esOwner, sanaa: esSanaa, staff: esStaff, legal: esLegal, errors: esErrors,
    notifications: esNotifications,
  },
} as const;
