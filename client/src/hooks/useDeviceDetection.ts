import { useState, useEffect } from 'react';

interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isAndroid: boolean;
  isIOS: boolean;
  hasNotch: boolean;
  deviceClass: string;
  screenHeight: number;
  screenWidth: number;
}

export const useDeviceDetection = (): DeviceInfo => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    isAndroid: false,
    isIOS: false,
    hasNotch: false,
    deviceClass: 'unknown',
    screenHeight: 0,
    screenWidth: 0,
  });

  useEffect(() => {
    const detectDevice = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const screenHeight = window.innerHeight;
      const screenWidth = window.innerWidth;
      
      // Rileva sistema operativo
      const isAndroid = /android/.test(userAgent);
      const isIOS = /iphone|ipad|ipod/.test(userAgent);
      
      // Rileva tipo di dispositivo basato su dimensioni
      const isMobile = screenWidth <= 767;
      const isTablet = screenWidth >= 768 && screenWidth <= 1023;
      const isDesktop = screenWidth >= 1024;
      
      // Rileva dispositivi con notch (iPhone X e successivi)
      const hasNotch = isIOS && (
        screenHeight >= 812 || // iPhone X, XS, 11 Pro, 12 mini
        screenHeight >= 844 || // iPhone 12, 12 Pro
        screenHeight >= 926 || // iPhone 12 Pro Max
        screenHeight >= 932    // iPhone 14 Pro Max
      );
      
      // Determina classe dispositivo
      let deviceClass = 'unknown';
      if (isMobile) {
        if (isAndroid) {
          deviceClass = 'android-mobile';
        } else if (isIOS) {
          deviceClass = hasNotch ? 'ios-mobile-notch' : 'ios-mobile';
        } else {
          deviceClass = 'mobile';
        }
      } else if (isTablet) {
        deviceClass = 'tablet';
      } else if (isDesktop) {
        deviceClass = 'desktop';
      }
      
      setDeviceInfo({
        isMobile,
        isTablet,
        isDesktop,
        isAndroid,
        isIOS,
        hasNotch,
        deviceClass,
        screenHeight,
        screenWidth,
      });
    };

    // Rileva dispositivo al mount
    detectDevice();
    
    // Rileva cambiamenti di orientamento
    const handleResize = () => {
      detectDevice();
    };
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return deviceInfo;
};