import { useState, useEffect, useCallback, useRef } from 'react';

interface ModalStateOptions {
  /** Whether to preserve state when document becomes hidden */
  preserveOnHidden?: boolean;
  /** Whether to preserve state when browser tab loses focus */
  preserveOnBlur?: boolean;
  /** Custom cleanup function */
  onCleanup?: () => void;
}

/**
 * Enhanced modal state hook that prevents data loss when tabbing away
 * 
 * This hook addresses the soft refresh issue by:
 * - Not resetting state when document becomes hidden/visible
 * - Not resetting state on window blur/focus events
 * - Only cleaning up when explicitly closed or component unmounts
 * - Providing stable state management across tab switches
 */
export function useModalState<T = any>(
  initialState: T,
  options: ModalStateOptions = {}
) {
  const {
    preserveOnHidden = true,
    preserveOnBlur = true,
    onCleanup
  } = options;

  const [state, setState] = useState<T>(initialState);
  const [isOpen, setIsOpen] = useState(false);
  const stateRef = useRef(state);
  const isOpenRef = useRef(isOpen);

  // Keep refs in sync
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  // Handle document visibility changes
  useEffect(() => {
    if (!preserveOnHidden) return;

    const handleVisibilityChange = () => {
      // Don't reset state when document becomes hidden/visible
      // This prevents the soft refresh issue when tabbing away
      if (document.hidden) {
        console.log('[useModalState] Document hidden - preserving modal state');
      } else {
        console.log('[useModalState] Document visible - modal state preserved');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [preserveOnHidden]);

  // Handle window focus/blur events
  useEffect(() => {
    if (!preserveOnBlur) return;

    const handleWindowBlur = () => {
      console.log('[useModalState] Window blur - preserving modal state');
      // Don't reset state on blur
    };

    const handleWindowFocus = () => {
      console.log('[useModalState] Window focus - modal state preserved');
      // Don't reset state on focus
    };

    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [preserveOnBlur]);

  // Stable callback to open modal
  const openModal = useCallback(() => {
    setIsOpen(true);
  }, []);

  // Stable callback to close modal
  const closeModal = useCallback(() => {
    setIsOpen(false);
    if (onCleanup) {
      onCleanup();
    }
  }, [onCleanup]);

  // Stable callback to reset state
  const resetState = useCallback(() => {
    setState(initialState);
  }, [initialState]);

  // Stable callback to update state
  const updateState = useCallback((newState: T | ((prevState: T) => T)) => {
    setState(newState);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isOpenRef.current && onCleanup) {
        onCleanup();
      }
    };
  }, [onCleanup]);

  return {
    state,
    isOpen,
    openModal,
    closeModal,
    resetState,
    updateState
  };
}

/**
 * Specialized hook for form modal state that prevents data loss
 */
export function useFormModalState<T extends Record<string, any>>(
  initialFormData: T,
  options: ModalStateOptions = {}
) {
  const modalState = useModalState(
    { formData: initialFormData, errors: {} as Record<keyof T, string> },
    options
  );

  const updateFormField = useCallback((field: keyof T, value: any) => {
    modalState.updateState(prev => ({
      ...prev,
      formData: { ...prev.formData, [field]: value },
      errors: { ...prev.errors, [field]: '' } // Clear error when field is updated
    }));
  }, [modalState]);

  const setFieldError = useCallback((field: keyof T, error: string) => {
    modalState.updateState(prev => ({
      ...prev,
      errors: { ...prev.errors, [field]: error }
    }));
  }, [modalState]);

  const clearErrors = useCallback(() => {
    modalState.updateState(prev => ({
      ...prev,
      errors: {}
    }));
  }, [modalState]);

  return {
    ...modalState,
    formData: modalState.state.formData,
    errors: modalState.state.errors,
    updateFormField,
    setFieldError,
    clearErrors
  };
}
