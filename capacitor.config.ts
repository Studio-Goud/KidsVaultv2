import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.studiogoud.suri',
  appName: 'Suri',
  webDir: 'dist',
  backgroundColor: '#0f2a4a',
  android: {
    allowMixedContent: false,
    // Android 15 and later draw the app under the status and navigation bars. Whether the WebView
    // then reports those bars through env(safe-area-inset-*) depends on its version, so Capacitor
    // keeps the page clear of them itself; `safeArea()` sees zero and nothing ends up under a bar.
    adjustMarginsForEdgeToEdge: 'auto',
    backgroundColor: '#0f2a4a',
  },
  ios: {
    contentInset: 'never',
    backgroundColor: '#0f2a4a',
  },
};

export default config;
