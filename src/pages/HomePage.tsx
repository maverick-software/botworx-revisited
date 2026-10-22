import React from 'react';
import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <div className="text-center">
      <h1 className="text-4xl font-bold mb-4">Welcome to Gofr Agents</h1>
      <p className="mb-8">Your platform for managing AI agents.</p>
      <div>
        <Link 
          to="/login"
          className="px-6 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 mr-4"
        >
          Login
        </Link>
        {/* Add a link to signup/register if applicable */}
        {/* <Link 
          to="/register"
          className="px-6 py-2 rounded-md bg-gray-600 text-white hover:bg-gray-700"
        >
          Sign Up
        </Link> */}
      </div>
    </div>
  );
} 