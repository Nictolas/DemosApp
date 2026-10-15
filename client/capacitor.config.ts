import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'community.demos',
  appName: 'DEMOS',
  webDir: 'dist',
  server: {
    // Usa un'origine HTTPS coerente con il relying party DEMOS. Evita che la
    // WebView nativa venga scambiata per localhost di sviluppo e mantiene
    // demos.community / api.demos.community nello stesso site.
    hostname: 'demos.community',
    androidScheme: 'https',
    // In sviluppo, puoi usare:
    // url: 'http://localhost:3000',
    // cleartext: true
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['alert', 'sound'],
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
};

export default config;
