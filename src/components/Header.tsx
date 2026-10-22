import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function Header() {
  // const { isAdmin } = useAuth(); // Removed isAdmin check here
  // const [isDropdownOpen, setIsDropdownOpen] = useState(false); // Removed dropdown state
  // const dropdownRef = useRef<HTMLDivElement>(null); // Removed dropdown ref
  // const triggerRef = useRef<HTMLButtonElement>(null); // Removed trigger ref

  // Removed useEffect for dropdown

  return (
    <header className="absolute top-0 right-0 p-4 z-20">
      {/* Admin button and dropdown removed from here */}
      
      {/* Add other header elements here if needed in the future (e.g., User Menu, Notifications) */}
    </header>
  );
}