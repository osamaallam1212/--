import type { ExpoConfig } from "expo/config";

// Math Book to Word — إعدادات تطبيق أندرويد
const config: ExpoConfig = {
  name: "Math Book Word",
  slug: "mathbook-word",
  version: "1.0.0",
  orientation: "default",
  icon: "./assets/images/icon.png",
  scheme: "mathbook",
  userInterfaceStyle: "automatic",
  backgroundColor: "#f7f8fc",
  android: {
    package: "com.mathbook.word",
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
      backgroundColor: "#3aa51d",
    },
    predictiveBackGestureEnabled: false,
    softwareKeyboardLayoutMode: "resize",
    permissions: [
      "android.permission.INTERNET",
      "android.permission.POST_NOTIFICATIONS",
      "android.permission.VIBRATE",
      "android.permission.WAKE_LOCK",
      "android.permission.RECEIVE_BOOT_COMPLETED",
    ],
  },
  ios: {
    bundleIdentifier: "com.mathbook.word",
    supportsTablet: true,
  },
  plugins: [
    "expo-asset",
    "./plugins/with-sajel-recorder",
    [
      "expo-notifications",
      {
        icon: "./assets/images/android-icon-monochrome.png",
        color: "#4c6ef5",
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 160,
        resizeMode: "contain",
        backgroundColor: "#f7f8fc",
        dark: { backgroundColor: "#000000" },
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          buildArchs: ["armeabi-v7a", "arm64-v8a"],
          minSdkVersion: 24,
        },
      },
    ],
  ],
};

export default config;
