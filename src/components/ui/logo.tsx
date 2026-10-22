import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn } from '../../lib/utils';
import gopherLogo from './logo-light.png'; // Gopher logo for all themes

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'icon' | 'full';
  showText?: boolean;
  textClassName?: string;
}

const sizeClasses = {
  sm: 'h-5 w-5',
  md: 'h-6 w-6', 
  lg: 'h-8 w-8',
  xl: 'h-10 w-10'
};

export function Logo({ 
  className, 
  size = 'md', 
  variant = 'icon',
  showText = false,
  textClassName 
}: LogoProps) {
  const { theme } = useTheme();
  
  // Use the same gopher logo for all themes
  const logoSrc = gopherLogo;

  return (
    <div className={cn("flex items-center", className)}>
      <img 
        src={logoSrc}
        alt="Gofr Agents"
        className={cn(
          sizeClasses[size],
          "object-contain transition-opacity duration-200"
        )}
      />
      {(variant === 'full' || showText) && (
        <span className={cn(
          "ml-2 font-semibold text-foreground",
          size === 'sm' && "text-sm",
          size === 'md' && "text-base",
          size === 'lg' && "text-lg", 
          size === 'xl' && "text-xl",
          textClassName
        )}>
          Gofr Agents
        </span>
      )}
    </div>
  );
}

// Alternative SVG-based logo for better scalability
export function LogoSVG({ 
  className, 
  size = 'md',
  variant = 'icon',
  showText = false,
  textClassName 
}: LogoProps) {
  return (
    <div className={cn("flex items-center", className)}>
      <svg 
        width={size === 'sm' ? 24 : size === 'md' ? 32 : size === 'lg' ? 40 : 48}
        height={size === 'sm' ? 24 : size === 'md' ? 32 : size === 'lg' ? 40 : 48}
        viewBox="0 0 32 32" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="text-icon-agents"
      >
        {/* Dog head outline */}
        <path 
          d="M16 4C12.5 4 9.5 6.5 8.5 9.5C7.5 10 7 10.5 7 11.5C7 12.5 7.5 13 8.5 13.5C8.2 14.5 8 15.5 8 16.5C8 21.5 11.5 25.5 16 25.5C20.5 25.5 24 21.5 24 16.5C24 15.5 23.8 14.5 23.5 13.5C24.5 13 25 12.5 25 11.5C25 10.5 24.5 10 23.5 9.5C22.5 6.5 19.5 4 16 4Z" 
          stroke="currentColor" 
          strokeWidth="2" 
          fill="none"
        />
        
        {/* Eyes */}
        <circle cx="13" cy="14" r="2" fill="currentColor"/>
        <circle cx="19" cy="14" r="2" fill="currentColor"/>
        
        {/* Nose */}
        <path 
          d="M16 17C16.5 17 17 17.5 17 18C17 18.5 16.5 19 16 19C15.5 19 15 18.5 15 18C15 17.5 15.5 17 16 17Z" 
          fill="currentColor"
        />
        
        {/* Mouth */}
        <path 
          d="M16 19C14.5 20.5 13 21 11.5 20.5" 
          stroke="currentColor" 
          strokeWidth="1.5" 
          strokeLinecap="round" 
          fill="none"
        />
        <path 
          d="M16 19C17.5 20.5 18.5 21 20.5 20.5" 
          stroke="currentColor" 
          strokeWidth="1.5" 
          strokeLinecap="round" 
          fill="none"
        />
        
        {/* Ears */}
        <ellipse cx="10" cy="10" rx="3" ry="5" fill="currentColor" opacity="0.8"/>
        <ellipse cx="22" cy="10" rx="3" ry="5" fill="currentColor" opacity="0.8"/>
      </svg>
      
      {(variant === 'full' || showText) && (
        <span className={cn(
          "ml-2 font-semibold text-foreground",
          size === 'sm' && "text-sm",
          size === 'md' && "text-base",
          size === 'lg' && "text-lg", 
          size === 'xl' && "text-xl",
          textClassName
        )}>
          Gofr Agents
        </span>
      )}
    </div>
  );
}
