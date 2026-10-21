import { defineConfig } from '@capacitor/cli';

export default defineConfig({
  appId: 'edu.sksu.campuscoop',
  appName: 'CampusCoop',
  webDir: '../gen',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1C2B3A',
      androidSpinnerStyle: 'large',
      iosSpinnerStyle: 'large',
      spinnerColor: '#5EB8FF',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1C2B3A',
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
    },
  },
});
