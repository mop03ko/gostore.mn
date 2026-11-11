// Configure generated native targets through an Expo plugin, never hand-edit ios/.
const { withXcodeProject } = require('../gostoremn/node_modules/expo/config-plugins');

module.exports = function withMacSigning(config) {
  if (!process.env.GOSTORE_PROFILE_UUID) throw new Error('Missing signing profile UUID');
  return withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const targets = project.pbxNativeTargetSection();
    const lists = project.pbxXCConfigurationList();
    const configurations = project.pbxXCBuildConfigurationSection();
    let count = 0;
    for (const [key, target] of Object.entries(targets)) {
      if (key.endsWith('_comment') || String(target.productType).replaceAll('"', '') !== 'com.apple.product-type.application') continue;
      for (const entry of lists[target.buildConfigurationList].buildConfigurations) {
        const settings = configurations[entry.value].buildSettings;
        settings.DEVELOPMENT_TEAM = '8P6PVVWKUB';
        settings.CODE_SIGN_STYLE = 'Manual';
        settings.CODE_SIGN_IDENTITY = '"Apple Distribution"';
        settings['CODE_SIGN_IDENTITY[sdk=iphoneos*]'] = '"Apple Distribution"';
        settings.PROVISIONING_PROFILE_SPECIFIER = process.env.GOSTORE_PROFILE_UUID;
      }
      count++;
    }
    if (count !== 1) throw new Error(`Expected one application target, got ${count}`);
    return mod;
  });
};
