// Wraps app.json so googleServicesFile can come from an EAS file
// environment variable in cloud builds (the file itself is gitignored and
// never committed) while still falling back to the local file for local
// dev builds (expo run:android).
//
// Also applies a preview-only Android identity override: EAS sets
// EAS_BUILD_PROFILE=preview during config resolution for the preview
// profile, so a distinct applicationId/name lets that internal test build
// install side-by-side with the real production app instead of conflicting
// with its package name. Production/development builds are unaffected.
//
// NOTE: google-services.json only registers a Firebase Android client for
// the production package (app.bookwithai.app) -- the preview package below
// has no matching Firebase client, so push notifications will not register
// in preview builds until a second Firebase Android app is added for
// app.bookwithai.app.preview. Accepted as a known limitation, not fixed here.
//
// Must accept and return the same `config` object reference from the
// context argument (not `require('./app.json')` directly, and not
// re-wrapped in `{ expo: config }`) -- expo-doctor's config-usage check
// tags the incoming object and verifies the same reference comes back out.
module.exports = ({ config }) => {
  if (process.env.GOOGLE_SERVICES_JSON) {
    config.android.googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  }
  if (process.env.EAS_BUILD_PROFILE === 'preview') {
    config.name = 'Book With AI Preview';
    config.android.package = 'app.bookwithai.app.preview';
  }
  return config;
};
