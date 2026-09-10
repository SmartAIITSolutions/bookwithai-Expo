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
// google-services.json only registers a Firebase Android client for the
// production package (app.bookwithai.app) -- there is no client for
// app.bookwithai.app.preview. Pointing the preview build at that file
// anyway does not degrade gracefully: expo prebuild applies the Google
// Services gradle plugin whenever googleServicesFile is set, and that
// plugin HARD-FAILS the Gradle build with "No matching client found for
// package name 'app.bookwithai.app.preview'" (confirmed via a real EAS
// build log, not assumed). So for the preview profile, googleServicesFile
// is omitted entirely -- prebuild then never applies the plugin at all,
// and the build succeeds. Accepted, known limitation: push notifications
// will not register in preview builds until a second Firebase Android app
// is registered for the preview package.
//
// Must accept and return the same `config` object reference from the
// context argument (not `require('./app.json')` directly, and not
// re-wrapped in `{ expo: config }`) -- expo-doctor's config-usage check
// tags the incoming object and verifies the same reference comes back out.
module.exports = ({ config }) => {
  const isPreview = process.env.EAS_BUILD_PROFILE === 'preview';

  if (isPreview) {
    delete config.android.googleServicesFile;
    config.name = 'Book With AI Preview';
    config.android.package = 'app.bookwithai.app.preview';
    return config;
  }

  if (process.env.GOOGLE_SERVICES_JSON) {
    config.android.googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  }
  return config;
};
