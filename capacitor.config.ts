import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.studiogoud.suri',
  appName: 'Suri',
  webDir: 'dist',
  backgroundColor: '#0f2a4a',
  android: {
    allowMixedContent: false,
    backgroundColor: '#0f2a4a',
  },
  ios: {
    contentInset: 'never',
    backgroundColor: '#0f2a4a',
  },
};

export default config;
