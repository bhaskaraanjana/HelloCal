import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hellocal.app',
  appName: 'HelloCal',
  webDir: 'dist',
  backgroundColor: '#0a0b10',
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#0a0b10',
      androidSplashResourceName: 'splash',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0b10',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'native',
    },
  },
  android: {
    backgroundColor: '#0a0b10',
  },
  ios: {
    backgroundColor: '#0a0b10',
    contentInset: 'always',
  },
};

export default config;
