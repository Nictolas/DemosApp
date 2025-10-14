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
      className={`min-h-screen flex flex-col ${className}`}
    >
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
};
