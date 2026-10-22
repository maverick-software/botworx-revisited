import React from 'react';

interface PublicLayoutProps {
  children: React.ReactNode;
}

const PublicLayout: React.FC<PublicLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen">
      {/* Minimal structure, maybe a centered container? */}
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {children} 
        </div>
      </main>
    </div>
  );
};

export default PublicLayout; 