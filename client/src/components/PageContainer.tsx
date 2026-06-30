import React from "react";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  className = "",
}) => {
  return (
    <div className={`flex-1 min-h-0 flex flex-col w-full ${className}`}>{children}</div>
  );
};
