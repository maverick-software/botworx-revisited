import React from 'react';
import { Link } from 'react-router-dom';

const UnauthorizedPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col justify-center items-center text-center py-12 px-4 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-extrabold text-red-600 dark:text-red-500">403</h1>
      <h2 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">Access Denied</h2>
      <p className="mt-2 text-base text-gray-600 dark:text-gray-400">
        You do not have permission to access this page.
      </p>
      <div className="mt-6">
        <Link
          to="/agents" // Or link back, or to login
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Go Back to Agents
        </Link>
      </div>
    </div>
  );
};

export default UnauthorizedPage; 