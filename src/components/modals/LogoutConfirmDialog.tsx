/**
 * Logout Confirmation Dialog
 * Displays a confirmation modal when user attempts to log out
 * Matches the design shown in the reference image
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface LogoutConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  userEmail?: string;
}

export function LogoutConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  userEmail,
}: LogoutConfirmDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[440px] bg-card border-border">
        <DialogHeader className="text-center">
          <DialogTitle className="text-[22px] font-semibold text-center text-card-foreground">
            Are you sure you want to log out?
          </DialogTitle>
          {userEmail && (
            <DialogDescription className="text-center text-muted-foreground pt-2 text-[15px]">
              Log out of Gofr Chat as {userEmail}?
            </DialogDescription>
          )}
        </DialogHeader>
        
        <DialogFooter className="flex flex-col gap-3 sm:flex-col sm:space-x-0 pt-4">
          <Button
            onClick={onConfirm}
            className="w-full h-[52px] bg-primary hover:bg-primary/90 text-primary-foreground border-0 shadow-sm font-medium rounded-[26px]"
            variant="default"
          >
            Log out
          </Button>
          <Button
            onClick={onClose}
            className="w-full h-[52px] bg-transparent hover:bg-accent text-foreground font-medium rounded-[26px] border-0"
            variant="ghost"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

