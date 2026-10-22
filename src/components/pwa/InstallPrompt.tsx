import React, { useState, useEffect } from 'react';
import { X, Download, Smartphone } from 'lucide-react';
import { useInstallPrompt, dismissInstallPrompt, wasInstallPromptDismissed, isIOSSafari } from '../../utils/pwa';

export function InstallPrompt() {
  const { isInstallable, promptInstall, isInstalled } = useInstallPrompt();
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Don't show if already installed or recently dismissed
    if (isInstalled || wasInstallPromptDismissed()) {
      return;
    }

    // Show prompt after a short delay for better UX
    const timer = setTimeout(() => {
      if (isInstallable || isIOSSafari()) {
        setShowPrompt(true);
      }
    }, 3000); // Wait 3 seconds before showing

    return () => clearTimeout(timer);
  }, [isInstallable, isInstalled]);

  const handleInstall = async () => {
    if (isIOSSafari()) {
      // Show iOS instructions
      setShowIOSInstructions(true);
    } else {
      // Trigger install prompt
      const installed = await promptInstall();
      if (installed) {
        setShowPrompt(false);
      }
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    dismissInstallPrompt();
  };

  const handleCloseInstructions = () => {
    setShowIOSInstructions(false);
    handleDismiss();
  };

  // Don't render if shouldn't show
  if (!showPrompt || isInstalled) {
    return null;
  }

  // iOS Instructions Modal
  if (showIOSInstructions) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-card rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Install Gofr Agents</h2>
            <button
              onClick={handleCloseInstructions}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4 text-sm text-foreground">
            <p>To install Gofr Agents on your iPhone or iPad:</p>
            
            <ol className="space-y-3 list-decimal list-inside">
              <li>Tap the <strong>Share</strong> button <span className="inline-block">📤</span> at the bottom of Safari</li>
              <li>Scroll down and tap <strong>"Add to Home Screen"</strong> <span className="inline-block">➕</span></li>
              <li>Tap <strong>"Add"</strong> in the top right corner</li>
            </ol>

            <p className="text-muted-foreground text-xs">
              The app will appear on your home screen and work just like a native app!
            </p>
          </div>

          <button
            onClick={handleCloseInstructions}
            className="mt-6 w-full bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium hover:bg-primary/90 transition-colors"
          >
            Got it!
          </button>
        </div>
      </div>
    );
  }

  // Install Prompt Banner
  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 animate-slide-up">
      <div className="bg-card border border-border rounded-lg shadow-lg p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            {isIOSSafari() ? (
              <Smartphone className="text-primary" size={20} />
            ) : (
              <Download className="text-primary" size={20} />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground mb-1">
              Install Gofr Agents
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Install our app for a better experience with offline access and faster loading.
            </p>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleInstall}
                className="flex-1 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                {isIOSSafari() ? 'Show Instructions' : 'Install'}
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Not Now
              </button>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

