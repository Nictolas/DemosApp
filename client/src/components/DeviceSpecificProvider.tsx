import React from 'react';
import { useDeviceSpecificFixes } from '@/hooks/useDeviceSpecificFixes';

interface DeviceSpecificProviderProps {
  children: React.ReactNode;
}

export const DeviceSpecificProvider: React.FC<DeviceSpecificProviderProps> = ({ children }) => {
  // Questo hook applica automaticamente le classi CSS necessarie
  useDeviceSpecificFixes();

  return <>{children}</>;
};
