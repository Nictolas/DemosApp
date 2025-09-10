import React from 'react';
import { useNavbarHeight } from '@/hooks/useNavbarHeight';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const PageContainer: React.FC<PageContainerProps> = ({ 
  children, 
  className = '' 
}) => {
  const navbarHeight = useNavbarHeight();

  return (
    <div 
      className={`page-with-navbar ${className}`}
      style={{
        paddingBottom: `calc(${navbarHeight}px + env(safe-area-inset-bottom))`
      }}
    >
      {children}
    </div>
  );
};
