import React from 'react';
import { useDeviceSpecificFixes } from '@/hooks/useDeviceSpecificFixes';

export const DeviceDebugInfo: React.FC = () => {
  const deviceInfo = useDeviceSpecificFixes();

  // Mostra solo in modalità sviluppo
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 bg-black bg-opacity-75 text-white p-4 rounded-lg text-xs z-50 max-w-xs">
      <h3 className="font-bold mb-2">Device Debug Info</h3>
      <div className="space-y-1">
        <div><strong>iPhone 15 Pro Max:</strong> {deviceInfo.isIPhone15ProMax ? '✅' : '❌'}</div>
        <div><strong>Redmi:</strong> {deviceInfo.isRedmi ? '✅' : '❌'}</div>
        <div><strong>Android:</strong> {deviceInfo.isAndroid ? '✅' : '❌'}</div>
        <div><strong>iOS:</strong> {deviceInfo.isIOS ? '✅' : '❌'}</div>
        <div><strong>Device Type:</strong> {deviceInfo.deviceType}</div>
        <div><strong>Needs Fix:</strong> {deviceInfo.needsSpecialFix ? '✅' : '❌'}</div>
        <div><strong>Screen:</strong> {window.screen.width}x{window.screen.height}</div>
        <div><strong>Viewport:</strong> {window.innerWidth}x{window.innerHeight}</div>
        <div><strong>User Agent:</strong> {navigator.userAgent.substring(0, 30)}...</div>
      </div>
    </div>
  );
};
