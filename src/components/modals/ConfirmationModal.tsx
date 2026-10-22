import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: React.ReactNode; // Content/description of the confirmation
  confirmText?: string;
  cancelText?: string;
  confirmButtonVariant?: 'primary' | 'danger' | 'warning' | 'secondary';
  isLoading?: boolean;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  children,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmButtonVariant = 'primary',
  isLoading = false,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const getButtonClasses = () => {
    switch (confirmButtonVariant) {
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 focus:ring-red-500';
      case 'warning':
        return 'bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-400';
      case 'secondary':
        return 'bg-gray-500 hover:bg-gray-600 focus:ring-gray-400';
      case 'primary':
      default:
        return 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-gray-700">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <div className="flex items-center space-x-2">
            {confirmButtonVariant === 'danger' && <AlertTriangle className="w-6 h-6 text-red-500" />}
            {confirmButtonVariant === 'warning' && <AlertTriangle className="w-6 h-6 text-yellow-400" />}
            <h2 className="text-xl font-semibold text-white">{title}</h2>
          </div>
          <button onClick={onClose} disabled={isLoading} className="text-gray-400 hover:text-white disabled:opacity-50">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 text-gray-300">
          {children}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-gray-700 space-x-3">
          <button 
            onClick={onClose} 
            disabled={isLoading}
            className="px-4 py-2 rounded-md bg-gray-600 text-gray-200 hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-500 disabled:opacity-50"
           >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm} 
            disabled={isLoading}
            className={`px-4 py-2 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-wait flex items-center justify-center ${getButtonClasses()}`}
          >
            {isLoading ? (
                <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                </>
            ) : (
                confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
} 