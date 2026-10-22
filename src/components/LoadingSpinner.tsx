import React from 'react';

const LoadingSpinner: React.FC = () => {
  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center bg-background transition-opacity duration-300">
      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
    </div>
  );
};

export default LoadingSpinner; 