// Points at the deployed backend by default. Set EXPO_PUBLIC_API_BASE in
// .env.local (e.g. http://10.0.2.2:3000 for the Android emulator reaching a
// local `npm run dev` server on the host machine) to test against a local
// booking-app instance without deploying to Vercel first.
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://bookwithai.app';
