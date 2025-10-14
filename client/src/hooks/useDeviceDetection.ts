import { useState, useEffect } from 'react';

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isAndroid: boolean;
  isIOS: boolean;
  isSafari: boolean;
  isChrome: boolean;
  screenWidth: number;
  screenHeight: number;
  viewportHeight: number;
  devicePixelRatio: number;
  orientation: 'portrait' | 'landscape';
  hasNotch: boolean;
  safeAreaInsets: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  deviceType: 'small-mobile' | 'mobile' | 'tablet' | 'desktop';
  brand?: string;
  model?: string;
}

export const useDeviceDetection = (): DeviceInfo => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    isAndroid: false,
    isIOS: false,
    isSafari: false,
    isChrome: false,
    screenWidth: 0,
    screenHeight: 0,
    viewportHeight: 0,
    devicePixelRatio: 1,
    orientation: 'portrait',
    hasNotch: false,
    safeAreaInsets: { top: 0, bottom: 0, left: 0, right: 0 },
    deviceType: 'desktop'
  });

  useEffect(() => {
    const detectDevice = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const devicePixelRatio = window.devicePixelRatio || 1;

      // Rilevamento sistema operativo
      const isAndroid = userAgent.includes('android');
      const isIOS = /iphone|ipad|ipod/.test(userAgent);
      const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent);
      const isChrome = /chrome/.test(userAgent);

      // Rilevamento tipo dispositivo
      const isMobile = viewportWidth < 768;
      const isTablet = viewportWidth >= 768 && viewportWidth < 1024;
      const isDesktop = viewportWidth >= 1024;

      // Orientamento
      const orientation = viewportHeight > viewportWidth ? 'portrait' : 'landscape';

      // Rilevamento notch (solo per iOS)
      const hasNotch = isIOS && (
        // iPhone X e successivi
        (screenHeight === 812 && screenWidth === 375) || // iPhone X, XS
        (screenHeight === 896 && screenWidth === 414) || // iPhone XR, XS Max
        (screenHeight === 844 && screenWidth === 390) || // iPhone 12, 12 Pro
        (screenHeight === 926 && screenWidth === 428) || // iPhone 12 Pro Max
        (screenHeight === 932 && screenWidth === 430) || // iPhone 14 Pro Max
        (screenHeight === 852 && screenWidth === 393) || // iPhone 14 Pro
        (screenHeight === 932 && screenWidth === 430) || // iPhone 15 Pro Max
        (screenHeight === 852 && screenWidth === 393)    // iPhone 15 Pro
      );

      // Safe area insets (approssimativi)
      const safeAreaInsets = {
        top: hasNotch ? 44 : 0,
        bottom: hasNotch ? 34 : 0,
        left: 0,
        right: 0
      };

      // Rilevamento brand e modello (approssimativo)
      let brand: string | undefined;
      let model: string | undefined;

      if (isAndroid) {
        if (userAgent.includes('samsung')) brand = 'Samsung';
        else if (userAgent.includes('xiaomi')) brand = 'Xiaomi';
        else if (userAgent.includes('huawei')) brand = 'Huawei';
        else if (userAgent.includes('oneplus')) brand = 'OnePlus';
        else if (userAgent.includes('pixel')) brand = 'Google';
        else brand = 'Android';
      } else if (isIOS) {
        brand = 'Apple';
        if (userAgent.includes('iphone')) model = 'iPhone';
        else if (userAgent.includes('ipad')) model = 'iPad';
      }

      // Classificazione tipo dispositivo
      let deviceType: DeviceInfo['deviceType'] = 'desktop';
      if (isMobile) {
        if (viewportHeight < 600) deviceType = 'small-mobile';
        else deviceType = 'mobile';
      } else if (isTablet) {
        deviceType = 'tablet';
      }

      setDeviceInfo({
        isMobile,
        isTablet,
        isDesktop,
        isAndroid,
        isIOS,
        isSafari,
        isChrome,
        screenWidth,
        screenHeight,
        viewportHeight,
        devicePixelRatio,
        orientation,
        hasNotch,
        safeAreaInsets,
        deviceType,
        brand,
        model
      });
    };

    // Rilevamento iniziale
    detectDevice();

    // Listener per cambiamenti
    const handleResize = () => {
      setTimeout(detectDevice, 100); // Delay per permettere al browser di aggiornare le dimensioni
    };

    const handleOrientationChange = () => {
      setTimeout(detectDevice, 500); // Delay maggiore per il cambio orientamento
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  return deviceInfo;
};
