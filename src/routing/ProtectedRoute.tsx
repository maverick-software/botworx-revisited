import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext'; // Adjusted path
import LoadingSpinner from '../components/LoadingSpinner'; // Adjusted path

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth(); 

  // Log the state immediately upon render
  console.log(`[ProtectedRoute V5 - Render] loading: ${loading}, user: ${user ? user.id : null}`);

  if (loading) {
    console.log('[ProtectedRoute V5] Decision: Still loading auth state, showing spinner.');
    return <LoadingSpinner />; 
  }

  // If loading is finished, check the user state definitively.
  if (!user) { 
    console.log('[ProtectedRoute V5] Decision: Loading finished, user is null. ===> REDIRECTING TO /login NOW! <===');
    return <Navigate to="/login" replace />;
  }
  
  // Loading finished and user exists.
  console.log('[ProtectedRoute V5] Decision: Loading finished, user exists. Rendering children.');
  return <>{children}</>; 
}; 