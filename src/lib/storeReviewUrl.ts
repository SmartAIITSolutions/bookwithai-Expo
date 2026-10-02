import { Platform, Linking } from 'react-native';

const ANDROID_PACKAGE = 'app.bookwithai.app';
const IOS_APP_STORE_ID = '6793853590';

const IOS_REVIEW_DEEP_LINK = `itms-apps://apps.apple.com/app/id${IOS_APP_STORE_ID}?action=write-review`;
const IOS_REVIEW_FALLBACK  = `https://apps.apple.com/app/id${IOS_APP_STORE_ID}?action=write-review`;
const ANDROID_REVIEW_DEEP_LINK = `market://details?id=${ANDROID_PACKAGE}&showAllReviews=true`;
const ANDROID_REVIEW_FALLBACK  = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}&showAllReviews=true`;

// Prefers the deep link straight into the Store app's review screen;
// falls back to the plain https URL (opens the store app anyway on both
// platforms, just without landing already-scrolled to the review box).
export async function resolveStoreReviewUrl(): Promise<string> {
  const deepLink = Platform.OS === 'ios' ? IOS_REVIEW_DEEP_LINK : ANDROID_REVIEW_DEEP_LINK;
  const fallback = Platform.OS === 'ios' ? IOS_REVIEW_FALLBACK : ANDROID_REVIEW_FALLBACK;
  try {
    const canOpen = await Linking.canOpenURL(deepLink);
    return canOpen ? deepLink : fallback;
  } catch {
    return fallback;
  }
}
