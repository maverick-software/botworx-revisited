import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import AdminLayout from '../layouts/AdminLayout';

interface AdminRouteProps {
  // Props if needed
}

export function AdminRoute({}: AdminRouteProps) {
  const { user, isAdmin, loading, rolesLoading } = useAuth();

  // Check if we're still loading authentication or roles
  const isLoading = loading || rolesLoading;
  
  console.log(`[AdminRoute] State: isLoading=${isLoading}, user=${user?.id}, isAdmin=${isAdmin}, loading=${loading}, rolesLoading=${rolesLoading}`);
  
  if (isLoading) {
    console.log('[AdminRoute] Decision: Still loading authentication or roles. Showing loading spinner.');
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Checking permissions...</div>
      </div>
    );
  }

  if (!user) {
    console.log('[AdminRoute] Decision: No user found. Redirecting to /login.');
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    console.warn('[AdminRoute] Decision: User is not an admin. Redirecting to /agents.');
    return <Navigate to="/agents" replace />;
  }

  console.log('[AdminRoute] Decision: User is admin. Rendering AdminLayout with Outlet.');
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  );
} 