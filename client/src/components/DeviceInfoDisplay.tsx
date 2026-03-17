import React from 'react';
import { useResponsiveLayoutContext } from './ResponsiveLayoutProvider';

export const DeviceInfoDisplay: React.FC = () => {
  const { deviceInfo, layoutConfig } = useResponsiveLayoutContext();

  // Mostra solo in modalità sviluppo
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 bg-black bg-opacity-75 text-white p-4 rounded-lg text-xs z-50 max-w-xs">
      <h3 className="font-bold mb-2">Device Info</h3>
      <div className="space-y-1">
        <div><strong>Type:</strong> {deviceInfo.deviceType}</div>
        <div><strong>Brand:</strong> {deviceInfo.brand || 'Unknown'}</div>
        <div><strong>Model:</strong> {deviceInfo.model || 'Unknown'}</div>
        <div><strong>OS:</strong> {deviceInfo.isAndroid ? 'Android' : deviceInfo.isIOS ? 'iOS' : 'Other'}</div>
        <div><strong>Screen:</strong> {deviceInfo.screenWidth}x{deviceInfo.screenHeight}</div>
        <div><strong>Viewport:</strong> {window.innerWidth}x{window.innerHeight}</div>
        <div><strong>Orientation:</strong> {deviceInfo.orientation}</div>
        <div><strong>Has Notch:</strong> {deviceInfo.hasNotch ? 'Yes' : 'No'}</div>
        <div><strong>Safe Area Bottom:</strong> {deviceInfo.safeAreaInsets.bottom}px</div>
        <hr className="my-2" />
        <div><strong>Button Height:</strong> {layoutConfig.menuButtonHeight}px</div>
        <div><strong>Button Min:</strong> {layoutConfig.menuButtonMinHeight}px</div>
        <div><strong>Button Max:</strong> {layoutConfig.menuButtonMaxHeight}px</div>
        <div><strong>Container Padding:</strong> {layoutConfig.containerPaddingBottom}px</div>
      </div>
    </div>
  );
};
