const variants = require("./variants.cjs"),
  projects = require("./projects.json");
module.exports = () => {
  const variant = process.env.APP_VARIANT;
  if (!Object.hasOwn(variants, variant || ""))
    throw Error("Set APP_VARIANT=admin or warehouse explicitly.");
  const v = variants[variant],
    project = projects[variant];
  return {
    name: v.name,
    slug: v.slug,
    owner: "morozkonkts-team",
    version: "1.0.0",
    orientation: "default",
    icon: v.icon,
    userInterfaceStyle: "light",
    ios: {
      bundleIdentifier: v.bundleIdentifier,
      supportsTablet: true,
      buildNumber: "1",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription:
          "Захиалгын QR код уншуулах, агуулахын барааны зураг авахад камер ашиглана.",
        NSPhotoLibraryUsageDescription:
          "Барааны болон агуулахын зургийг сонгож оруулахад ашиглана.",
      },
    },
    plugins: [
      [
        "expo-camera",
        {
          cameraPermission:
            "Захиалгын QR код уншуулах, барааны зураг авахад камер ашиглана.",
          recordAudioAndroid: false,
          microphonePermission: false,
        },
      ],
    ],
    extra: {
      variant,
      ...v,
      ...(project ? { eas: { projectId: project } } : {}),
    },
  };
};
