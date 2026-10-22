import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

interface MCPIconProps {
  className?: string;
  size?: number;
}

export function MCPIcon({ className, size = 16 }: MCPIconProps) {
  const { theme } = useTheme();
  
  // Use mcp-light.png (light colored icon) for dark backgrounds
  // Use mcp.png (dark colored icon) for light backgrounds
  const iconSrc = theme === 'dark' ? '/mcp.png' : '/mcp-light.png';
  
  return (
    <img
      src={iconSrc}
      alt="MCP"
      width={size}
      height={size}
      className={className}
      style={{ display: 'inline-block', opacity: 0.8 }}
    />
  );
}

