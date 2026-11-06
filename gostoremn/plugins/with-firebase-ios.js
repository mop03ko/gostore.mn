const { withPlugins } = require("expo/config-plugins");
const path = require("node:path");
// Only the iOS Firebase app has been registered. Use RNFB's iOS config mods;
// applying its Android plugin would require a different google-services.json.
const { withFirebaseAppDelegate, withIosGoogleServicesFile, withIosDisableSPM } =
  require(path.join(path.dirname(require.resolve("@react-native-firebase/app/package.json")), "plugin/build/ios"));

module.exports = function withFirebaseIos(config) {
  return withPlugins(config, [withFirebaseAppDelegate, withIosGoogleServicesFile, withIosDisableSPM]);
};
