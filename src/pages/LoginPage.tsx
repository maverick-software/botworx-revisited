import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { X, Eye, EyeOff } from 'lucide-react';

function LoginPage() {
  const googleAuthEnabled = import.meta.env.VITE_GOOGLE_AUTH_ENABLED !== 'false';
  const [step, setStep] = useState<'email' | 'password' | 'name' | 'create-password'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isExistingUser, setIsExistingUser] = useState<boolean | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordMatchError, setPasswordMatchError] = useState(false);
  const { signIn, signUp, error, clearError } = useAuth();
  const navigate = useNavigate();

  // Password validation rules
  const passwordValidation = {
    minLength: password.length >= 8,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };

  useEffect(() => {
    clearError();
  }, [clearError]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckingEmail(true);
    clearError();
    
    try {
      console.log('[LoginPage] Checking if email exists:', email);
      
      // Call edge function to check if email exists
      const { data, error } = await supabase.functions.invoke('check-email-exists', {
        body: { email }
      });

      if (error) {
        console.error('[LoginPage] Error checking email:', error);
        // On error, default to login flow
        setIsExistingUser(true);
        setStep('password');
        return;
      }

      console.log('[LoginPage] Email check result:', data);

      if (data.exists) {
        // User exists - go to login
        console.log('[LoginPage] User exists, showing password login');
        setIsExistingUser(true);
        setStep('password');
      } else {
        // User doesn't exist - go to signup
        console.log('[LoginPage] New user, showing signup flow');
        setIsExistingUser(false);
        setStep('name');
      }
    } catch (err: any) {
      console.error('[LoginPage] Error checking email:', err);
      // Default to login flow on error
      setIsExistingUser(true);
      setStep('password');
    } finally {
      setCheckingEmail(false);
    }
  };

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Move to password creation step
    setStep('create-password');
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signIn(email, password);
      // If successful, AuthContext will handle redirect
    } catch (err: any) {
      console.error('[LoginPage] Sign in error:', err);
      
      // Check if error indicates user doesn't exist
      if (err?.message?.includes('Invalid login credentials')) {
        // Could be wrong password OR user doesn't exist
        // Show generic error for security (don't expose user existence)
        // But if user repeatedly fails, they might need to sign up
      }
    }
  };

  const handleCreatePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setPasswordMatchError(true);
      return;
    }
    
    setPasswordMatchError(false);
    
    try {
      await signUp(email, password, firstName, lastName);
      // After successful signup, user will be redirected by AuthContext
    } catch (err) {
      console.error('Sign up error:', err);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        }
      });
      if (error) throw error;
    } catch (err: any) {
      console.error('Google login error:', err);
    }
  };


  const handleClose = () => {
    navigate('/');
  };

  const handleBack = () => {
    if (step === 'password' || step === 'name') {
      // Go back to email
      setStep('email');
      setPassword('');
      setConfirmPassword('');
      setFirstName('');
      setLastName('');
      setIsExistingUser(null);
    } else if (step === 'create-password') {
      // Go back to name
      setStep('name');
      setPassword('');
      setConfirmPassword('');
    }
    clearError();
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-[440px] bg-[#2C2C2C] rounded-2xl shadow-2xl p-8 relative">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-[26px] font-semibold text-white mb-3">
            {step === 'name' ? 'Nice to meet you! What is your name?' : 'Log in or sign up'}
          </h1>
          {step !== 'name' && (
            <p className="text-[15px] text-gray-300 leading-relaxed px-2">
              You'll get smarter responses and can upload files, images, and more.
            </p>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm text-center">
            {error}
          </div>
        )}

        {step === 'email' ? (
          <>
            {/* Email Form */}
            <form onSubmit={handleEmailSubmit} className="space-y-4 mb-6">
              <div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-[52px] px-4 py-3.5 bg-[#3C3C3C] border border-gray-600 rounded-[26px] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent transition-all"
                  placeholder="Email address"
                />
              </div>

              {/* Continue Button */}
              <Button
                type="submit"
                disabled={checkingEmail}
                className="w-full h-[52px] bg-white hover:bg-gray-100 text-gray-900 font-medium py-3.5 rounded-[26px] transition-colors shadow-sm"
              >
                {checkingEmail ? 'Checking...' : 'Login or Sign up'}
              </Button>
            </form>

            {googleAuthEnabled && (
              <>
            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-[#2C2C2C] text-gray-400">OR</span>
              </div>
            </div>

            {/* OAuth Buttons */}
            <div className="space-y-2">
              {/* Google Login */}
              <Button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full bg-transparent hover:bg-white/5 text-white font-normal py-3.5 h-[52px] rounded-[26px] transition-colors border border-gray-600 flex items-center justify-center gap-3"
                variant="outline"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </Button>
            </div>
              </>
            )}
          </>
        ) : step === 'password' ? (
          <>
            {/* Back to Email */}
            <button
              onClick={handleBack}
              className="mb-6 text-sm text-gray-400 hover:text-gray-300 flex items-center gap-2"
            >
              ← Back
            </button>

            {/* Password Form - Login */}
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  className="w-full h-[52px] px-4 py-3.5 pr-12 bg-[#3C3C3C] border border-gray-600 rounded-[26px] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent transition-all"
                  placeholder="Password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Log in Button */}
              <Button
                type="submit"
                className="w-full h-[52px] bg-white hover:bg-gray-100 text-gray-900 font-medium py-3.5 rounded-[26px] transition-colors shadow-sm"
              >
                Log in
              </Button>
            </form>

            {/* Forgot password link and create account */}
            <div className="text-center mt-4 space-y-2">
              <button
                type="button"
                className="text-sm text-gray-400 hover:text-gray-300 transition-colors block mx-auto"
              >
                Forgot password?
              </button>
              <div className="text-sm text-gray-400">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsExistingUser(false);
                    setStep('name');
                  }}
                  className="text-white hover:underline font-medium"
                >
                  Sign up
                </button>
              </div>
            </div>
          </>
        ) : step === 'name' ? (
          <>
            {/* Back to Email */}
            <button
              onClick={handleBack}
              className="mb-6 text-sm text-gray-400 hover:text-gray-300 flex items-center gap-2"
            >
              ← Back
            </button>

            {/* Name Collection Form */}
            <form onSubmit={handleNameSubmit} className="space-y-4">
              <div>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoFocus
                  className="w-full h-[52px] px-4 py-3.5 bg-[#3C3C3C] border border-gray-600 rounded-[26px] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent transition-all"
                  placeholder="First name"
                />
              </div>
              <div>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full h-[52px] px-4 py-3.5 bg-[#3C3C3C] border border-gray-600 rounded-[26px] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent transition-all"
                  placeholder="Last name"
                />
              </div>

              {/* Continue Button */}
              <Button
                type="submit"
                className="w-full h-[52px] bg-white hover:bg-gray-100 text-gray-900 font-medium py-3.5 rounded-[26px] transition-colors shadow-sm"
              >
                Continue
              </Button>
            </form>
          </>
        ) : (
          <>
            {/* Back to Name */}
            <button
              onClick={handleBack}
              className="mb-6 text-sm text-gray-400 hover:text-gray-300 flex items-center gap-2"
            >
              ← Back
            </button>

            {/* Create Password Form */}
            <form onSubmit={handleCreatePasswordSubmit} className="space-y-4">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  className="w-full h-[52px] px-4 py-3.5 pr-12 bg-[#3C3C3C] border border-gray-600 rounded-[26px] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent transition-all"
                  placeholder="Create password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Password Requirements */}
              {password.length > 0 && (
                <div className="bg-[#3C3C3C] border border-gray-600 rounded-2xl p-4 space-y-2">
                  <p className="text-xs text-gray-300 font-medium mb-2">Password Rules:</p>
                  <div className="space-y-1.5">
                    <div className={`flex items-center gap-2 text-xs ${passwordValidation.minLength ? 'text-green-400' : 'text-gray-400'}`}>
                      <span>{passwordValidation.minLength ? '✓' : '○'}</span>
                      <span>At least 8 characters</span>
                    </div>
                    <div className={`flex items-center gap-2 text-xs ${passwordValidation.hasUpperCase ? 'text-green-400' : 'text-gray-400'}`}>
                      <span>{passwordValidation.hasUpperCase ? '✓' : '○'}</span>
                      <span>One uppercase letter</span>
                    </div>
                    <div className={`flex items-center gap-2 text-xs ${passwordValidation.hasLowerCase ? 'text-green-400' : 'text-gray-400'}`}>
                      <span>{passwordValidation.hasLowerCase ? '✓' : '○'}</span>
                      <span>One lowercase letter</span>
                    </div>
                    <div className={`flex items-center gap-2 text-xs ${passwordValidation.hasNumber ? 'text-green-400' : 'text-gray-400'}`}>
                      <span>{passwordValidation.hasNumber ? '✓' : '○'}</span>
                      <span>One number</span>
                    </div>
                    <div className={`flex items-center gap-2 text-xs ${passwordValidation.hasSpecialChar ? 'text-green-400' : 'text-gray-400'}`}>
                      <span>{passwordValidation.hasSpecialChar ? '✓' : '○'}</span>
                      <span>One special character (!@#$%^&*...)</span>
                    </div>
                    <div className={`flex items-center gap-2 text-xs ${confirmPassword.length > 0 && password === confirmPassword ? 'text-green-400' : 'text-gray-400'}`}>
                      <span>{confirmPassword.length > 0 && password === confirmPassword ? '✓' : '○'}</span>
                      <span>Passwords must match</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (passwordMatchError) setPasswordMatchError(false);
                  }}
                  className="w-full h-[52px] px-4 py-3.5 pr-12 bg-[#3C3C3C] border border-gray-600 rounded-[26px] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent transition-all"
                  placeholder="Confirm password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Create Account Button */}
              <Button
                type="submit"
                className="w-full h-[52px] bg-white hover:bg-gray-100 text-gray-900 font-medium py-3.5 rounded-[26px] transition-colors shadow-sm"
              >
                Create account
              </Button>
            </form>

            {/* Terms text */}
            <div className="text-center mt-4">
              <p className="text-xs text-gray-400">
                By signing up, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default LoginPage;
