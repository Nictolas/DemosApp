import React, { useEffect } from 'react';
import { useNavbarHeight } from '@/hooks/useNavbarHeight';
import { useMobileFix } from '@/hooks/useMobileFix';
import { useResponsiveLayoutContext } from './ResponsiveLayoutProvider';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const PageContainer: React.FC<PageContainerProps> = ({ 
  children, 
  className = '' 
}) => {
  const { navbarHeight, isAndroid } = useNavbarHeight();
  const { layoutConfig, getResponsiveClass } = useResponsiveLayoutContext();
  
  // Applica correzioni specifiche per mobile
  useMobileFix();

  return (
    <div 
      className={getResponsiveClass(`min-h-screen page-with-navbar flex flex-col ${className}`, "container")}
      style={{
        paddingBottom: `${layoutConfig.containerPaddingBottom}px`,
        minHeight: `calc(100vh - ${layoutConfig.navbarHeight}px - var(--safe-area-inset-bottom))`
      }}
    >
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
};
