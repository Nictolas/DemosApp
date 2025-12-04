import React, { useEffect } from 'react';
import { useNavbarHeight } from '@/hooks/useNavbarHeight';
import { useMobileFix } from '@/hooks/useMobileFix';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const PageContainer: React.FC<PageContainerProps> = ({ 
  children, 
  className = '' 
}) => {
  const { navbarHeight, isAndroid } = useNavbarHeight();
  
  // Applica correzioni specifiche per mobile
  useMobileFix();

  return (
    <div 
      className={`min-h-screen flex flex-col w-full ${className}`}
      style={{ 
        minHeight: '100%',
        position: 'relative',
        zIndex: 1
      }}
    >
      <div className="flex-1 w-full">
        {children}
      </div>
    </div>
  );
};
