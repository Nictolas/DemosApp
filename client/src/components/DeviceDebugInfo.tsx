import React from 'react';
import { useDeviceDetection } from '@/hooks/useDeviceDetection';

export const DeviceDebugInfo: React.FC = () => {
  const deviceInfo = useDeviceDetection();

  // Mostra solo in modalità sviluppo
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div 
      style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '8px',
        borderRadius: '4px',
        fontSize: '10px',
        fontFamily: 'monospace',
        zIndex: 10000,
        maxWidth: '200px',
        lineHeight: '1.2',
      }}
    >
      <div><strong>Device Debug:</strong></div>
      <div>Class: {deviceInfo.deviceClass}</div>
      <div>Mobile: {deviceInfo.isMobile ? 'Yes' : 'No'}</div>
      <div>Android: {deviceInfo.isAndroid ? 'Yes' : 'No'}</div>
      <div>iOS: {deviceInfo.isIOS ? 'Yes' : 'No'}</div>
      <div>Notch: {deviceInfo.hasNotch ? 'Yes' : 'No'}</div>
      <div>Size: {deviceInfo.screenWidth}x{deviceInfo.screenHeight}</div>
      <div>Navbar: {getComputedStyle(document.documentElement).getPropertyValue('--navbar-height')}</div>
      <div>Safe Area: {getComputedStyle(document.documentElement).getPropertyValue('--safe-area-bottom')}</div>
    </div>
  );
};