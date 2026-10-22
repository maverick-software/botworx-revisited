import React, { Suspense } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import { ProtectedRoute } from './ProtectedRoute';
import { AdminRoute } from './AdminRoute';
import { appRoutes, RouteConfig } from './routeConfig';



// Helper function to wrap element with necessary wrappers (Protection and Layout)
const wrapElement = (route: RouteConfig) => {
  console.log(`[AppRouter] Wrapping route: ${route.path}, Layout Flag: ${route.layout}`);

  let element = <route.element />;

  // Apply protection wrappers first
  if (route.protection === 'protected') {
    element = <ProtectedRoute>{element}</ProtectedRoute>;
  } else if (route.protection === 'admin') {
    // AdminRoute might need specific handling based on nesting
    // Assuming AdminRoute handles protection and provides Outlet
    // Apply AdminRoute wrapper only to the top-level /admin entry
    if (route.path === '/admin' && route.children) {
        element = <AdminRoute>{element}</AdminRoute>;
    }
    // Child admin routes are rendered via Outlet within the parent AdminRoute
  }

  // Apply Layout wrapper if route requires it
  if (route.layout) {
    element = <Layout>{element}</Layout>;
  }

  return element;
};

export const AppRouter: React.FC = () => {
  const { user } = useAuth();

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {appRoutes.map((route) => {
          // Handle public routes with redirects if user is logged in
          if (route.protection === 'public' && (route.path === '/login' || route.path === '/register')) {
            return (
              <Route 
                key={route.path}
                path={route.path}
                element={user ? <Navigate to="/agents" replace /> : wrapElement(route)} 
              />
            );
          }
          // Handle root route redirect
          if (route.path === '/') {
              return (
                <Route
                  key={route.path}
                  path={route.path}
                  // If user is logged in, redirect to agents.
                  // If user is logged out, redirect to login.
                  element={user ? <Navigate to="/agents" replace /> : <Navigate to="/login" replace />}
                />
              );
          }

          // Handle nested admin routes
          if (route.path === '/admin' && route.children) {
            // The main element for /admin needs wrapping (including Layout if specified)
            const AdminWrapperElement = wrapElement(route); 
            return (
              <Route key={route.path} path={route.path} element={AdminWrapperElement}>
                {/* Render base element if specified, using Outlet from AdminRoute */}
                <Route index element={<route.element />} /> 
                {route.children.map(childRoute => (
                  // Child routes don't need separate Layout/AdminRoute wrappers here,
                  // only their specific element needs rendering within the Outlet.
                  // Protection check still happens via AdminRoute on parent.
                  <Route 
                    key={childRoute.path}
                    path={childRoute.path} 
                    element={<childRoute.element />} // Render child element directly
                  />
                ))}
              </Route>
            );
          }
          
          // Handle standard routes
          return (
            <Route 
              key={route.path}
              path={route.path}
              element={wrapElement(route)}
            />
          );
        })}
        
        {/* Default Catch-all route */}
        <Route path="*" element={<Navigate to={user ? "/agents" : "/login"} replace />} />
      </Routes>
    </Suspense>
  );
}; 