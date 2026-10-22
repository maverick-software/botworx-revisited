// Suppress non-critical ARIA warnings during development
// These warnings don't affect functionality but can clutter the console

// Suppress Radix UI Dialog ARIA warnings
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  const message = args[0];
  
  // Skip Radix UI Dialog ARIA warnings
  if (typeof message === 'string') {
    if (message.includes('Missing `Description` or `aria-describedby={undefined}` for {DialogContent}')) {
      return;
    }
    if (message.includes('aria-hidden on an element because its descendant retained focus')) {
      return;
    }
  }
  
  // Allow all other warnings
  originalWarn.apply(console, args);
};

export {};
