// Preview-only Android identity override. Expo evaluates this on top of the
// static app.json (the `config` param below IS app.json's already-resolved
// "expo" object) -- production/development builds pass straight through
// unmodified. Only EAS's own preview profile (which sets
// EAS_BUILD_PROFILE=preview during config resolution) gets a distinct
// applicationId/name, so the preview APK can install side-by-side with the
// real production app on the same device instead of conflicting with it.
//
// NOTE: google-services.json only registers a Firebase Android client for
// the production package (app.bookwithai.app) -- the preview package below
// has no matching Firebase client, so push notifications will not register
// in preview builds until a second Firebase Android app is added for
// app.bookwithai.app.preview. Accepted as a known limitation for this
// SmartFill test build (not fixed here).
module.exports = ({ config }) => {
  if (process.env.EAS_BUILD_PROFILE !== 'preview') {
    return config;
  }

  return {
    ...config,
    name: 'Book With AI Preview',
    android: {
      ...config.android,
      package: 'app.bookwithai.app.preview',
    },
  };
};
