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
      className={`page-with-navbar ${className}`}
      style={{
        paddingBottom: isAndroid 
          ? `calc(${navbarHeight}px + 3rem)` 
          : `calc(${navbarHeight}px + env(safe-area-inset-bottom))`
      }}
    >
      {children}
    </div>
  );
};
