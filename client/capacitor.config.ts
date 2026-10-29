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
      // Android 12+ conserva lo splash di sistema durante l'avvio.
      // Nessuna durata extra imposta da DEMOS, né animazioni di uscita artificiali.
      launchShowDuration: 0,
      launchAutoHide: true,
      launchFadeOutDuration: 0,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
};

export default config;
