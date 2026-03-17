import { useEffect, useState } from 'react';

export interface DeviceSpecificInfo {
  isIPhone15ProMax: boolean;
  isRedmi: boolean;
  isAndroid: boolean;
  isIOS: boolean;
  deviceType: 'iphone15promax' | 'redmi' | 'android' | 'ios' | 'other';
  needsSpecialFix: boolean;
}

export const useDeviceSpecificFixes = (): DeviceSpecificInfo => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceSpecificInfo>({
    isIPhone15ProMax: false,
    isRedmi: false,
    isAndroid: false,
    isIOS: false,
    deviceType: 'other',
    needsSpecialFix: false
  });

  useEffect(() => {
    const detectDevice = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;
      
      // Rilevamento iPhone 15 Pro Max
      const isIPhone15ProMax = (
        /iphone/.test(userAgent) &&
        (
          (screenHeight === 932 && screenWidth === 430) || // iPhone 15 Pro Max
          (screenHeight === 430 && screenWidth === 932) || // iPhone 15 Pro Max landscape
          // Aggiungi altri identificatori se necessario
          userAgent.includes('iphone') && screenHeight >= 900
        )
      );
      
      // Rilevamento Redmi
      const isRedmi = userAgent.includes('redmi') || userAgent.includes('xiaomi');
      
      // Rilevamento Android generico
      const isAndroid = userAgent.includes('android');
      
      // Rilevamento iOS generico
      const isIOS = /iphone|ipad|ipod/.test(userAgent);
      
      let deviceType: DeviceSpecificInfo['deviceType'] = 'other';
      if (isIPhone15ProMax) deviceType = 'iphone15promax';
      else if (isRedmi) deviceType = 'redmi';
      else if (isAndroid) deviceType = 'android';
      else if (isIOS) deviceType = 'ios';
      
      const needsSpecialFix = isIPhone15ProMax || isRedmi;
      
      setDeviceInfo({
        isIPhone15ProMax,
        isRedmi,
        isAndroid,
        isIOS,
        deviceType,
        needsSpecialFix
      });
      
      // Applica classi CSS specifiche al body
      const body = document.body;
      body.classList.remove('device-iphone15promax', 'device-redmi', 'device-android', 'device-ios');
      
      if (isIPhone15ProMax) body.classList.add('device-iphone15promax');
      if (isRedmi) body.classList.add('device-redmi');
      if (isAndroid) body.classList.add('device-android');
      if (isIOS) body.classList.add('device-ios');
    };

    detectDevice();
    
    // Rileva anche al cambio orientamento
    const handleOrientationChange = () => {
      setTimeout(detectDevice, 500);
    };
    
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', detectDevice);
    
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', detectDevice);
    };
  }, []);

  return deviceInfo;
};
