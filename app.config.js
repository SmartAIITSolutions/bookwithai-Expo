// Wraps app.json so googleServicesFile can come from an EAS file
// environment variable in cloud builds (the file itself is gitignored and
// never committed) while still falling back to the local file for local
// dev builds (expo run:android).
//
// Must accept and return the same `config` object reference from the
// context argument (not `require('./app.json')` directly, and not
// re-wrapped in `{ expo: config }`) -- expo-doctor's config-usage check
// tags the incoming object and verifies the same reference comes back out.
module.exports = ({ config }) => {
  if (process.env.GOOGLE_SERVICES_JSON) {
    config.android.googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  }
  return config;
};
