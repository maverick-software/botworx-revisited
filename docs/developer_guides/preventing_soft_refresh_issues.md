# Preventing Soft Refresh Issues

This guide explains how to prevent the "soft refresh" issue where modal data is lost when users tab away and return to the page.

## The Problem

The soft refresh issue occurs when:

1. User opens a modal and starts filling in data
2. User tabs away to another browser tab/window
3. User returns to the original tab
4. Modal data is lost due to aggressive state reset mechanisms

This happens because of overly aggressive `useEffect` hooks that listen to location changes, document visibility changes, or window focus/blur events and unnecessarily reset component state.

## The Solution

We've created several hooks to address this issue:

### 1. `useModalSoftRefreshProtection`

Use this hook in pages that contain modals to prevent state loss:

```typescript
import { useModalSoftRefreshProtection } from '../hooks/useSoftRefreshProtection';

export function MyPageWithModal() {
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Protect modal state from soft refresh
  const closeModal = () => {
    setShowModal(false);
    setSelectedItem(null);
  };
  
  useModalSoftRefreshProtection(
    showModal,
    closeModal,
    {
      allowedPaths: ['/my-page'], // Modal stays open on these paths
      debug: false // Set to true for debugging
    }
  );

  // Rest of component...
}
```

### 2. `useModalState`

Use this hook inside modal components to maintain form state:

```typescript
import { useModalState } from '../hooks/useModalState';

export function MyModal({ isOpen, onClose }) {
  const {
    state: formData,
    updateState: setFormData,
    resetState
  } = useModalState({
    name: '',
    email: '',
    settings: {}
  }, {
    preserveOnHidden: true, // Keep state when tab is hidden
    preserveOnBlur: true,   // Keep state when window loses focus
    onCleanup: () => {
      console.log('Modal cleaned up');
    }
  });

  // Form data will persist even when tabbing away!
}
```

### 3. `useFormModalState`

Specialized hook for form modals:

```typescript
import { useFormModalState } from '../hooks/useModalState';

export function FormModal({ isOpen, onClose }) {
  const {
    formData,
    errors,
    updateFormField,
    setFieldError,
    clearErrors
  } = useFormModalState(
    {
      name: '',
      email: '',
      phone: ''
    },
    {
      preserveOnHidden: true,
      onCleanup: () => clearErrors()
    }
  );

  const handleFieldChange = (field, value) => {
    updateFormField(field, value); // Automatically clears errors
  };

  // Form state persists across tab switches!
}
```

### 4. `useDocumentVisibility`

For components that need to react to visibility changes without losing state:

```typescript
import { useDocumentVisibility } from '../hooks/useDocumentVisibility';

export function MyComponent() {
  const { isVisible, isSafeToUpdate } = useDocumentVisibility({ debug: true });

  useEffect(() => {
    // Only make expensive API calls when page is visible
    if (isSafeToUpdate()) {
      fetchData();
    }
  }, [isSafeToUpdate]);
}
```

## Migration Guide

### Old Pattern (Problematic)

```typescript
// ❌ This causes soft refresh issues
useEffect(() => {
  setShowModal(false);
  setSelectedItem(null);
}, [location.pathname, location.search, location.hash]); // Too aggressive!
```

### New Pattern (Fixed)

```typescript
// ✅ This prevents soft refresh issues  
const closeModal = () => {
  setShowModal(false);
  setSelectedItem(null);
};

useModalSoftRefreshProtection(
  showModal,
  closeModal,
  { allowedPaths: ['/current-page'] }
);
```

## Best Practices

1. **Only listen to `location.pathname`** - Don't listen to `search` or `hash` changes
2. **Use the protection hooks** - They handle edge cases properly
3. **Test with tab switching** - Always verify modal data persists when tabbing away
4. **Enable debug mode** - Set `debug: true` during development to see what's happening
5. **Preserve form state** - Use `useFormModalState` for forms that users might be filling out

## Common Pitfalls

1. **Listening to all location changes** - This closes modals on minor URL changes
2. **Resetting state on visibility changes** - Users expect their data to persist
3. **Not handling focus/blur properly** - Can cause state loss on window switching
4. **Over-aggressive cleanup** - Only clean up when truly necessary

## Testing

To test if your component has soft refresh issues:

1. Open the modal and enter some data
2. Switch to another browser tab
3. Switch back to the original tab
4. Check if the data is still there

If data is lost, implement one of the protection hooks above.
