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
    <div className={`h-full min-h-0 flex flex-col w-full ${className}`}>
      <div className="flex-1 min-h-0 w-full flex flex-col">{children}</div>
    </div>
  );
};
