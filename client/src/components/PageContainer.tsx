import React from "react";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const PageContainer = React.forwardRef<HTMLDivElement, PageContainerProps>(
  function PageContainer({ children, className = "" }, ref) {
    return (
      <div ref={ref} className={`h-full w-full flex flex-col min-h-0 ${className}`}>
        {children}
      </div>
    );
  },
);
