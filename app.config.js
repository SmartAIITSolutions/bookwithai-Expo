const appJson = require('./app.json');

// Wraps app.json so googleServicesFile can come from an EAS file
// environment variable in cloud builds (the file itself is gitignored and
// never committed) while still falling back to the local file for local
// dev builds (expo run:android).
module.exports = () => {
  const config = appJson.expo;
  if (process.env.GOOGLE_SERVICES_JSON) {
    config.android.googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  }
  return { expo: config };
};
