import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Bot, ArrowRight, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';

// Define the structure for form data
interface FormData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  mobile?: string;
  companyName?: string;
  title?: string;
  usageReason: string; // Changed to string for radio button selection
  usageReasonOther?: string;
  hopesGoals?: string;
}

export function RegisterPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    usageReason: 'personal', // Default selection
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupEnabled, setSignupEnabled] = useState<boolean | null>(null); // null = checking
  const navigate = useNavigate();
  const { user, loading: authLoading, signUp, updateProfile } = useAuth();
  const initialCheckDoneRef = useRef(false); // Ref to track initial check

  console.log(`[RegisterPage Render] Current Step: ${currentStep}, User: ${user ? user.id : 'null'}, AuthLoading: ${authLoading}, InitialCheckDone: ${initialCheckDoneRef.current}`);

  // Effect 0: Check if signup is enabled
  useEffect(() => {
    const checkSignupStatus = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-signup-status');
        
        if (error) {
          console.error('Error checking signup status:', error);
          setSignupEnabled(true); // Default to enabled on error
          return;
        }

        setSignupEnabled(data.enabled);
      } catch (err) {
        console.error('Failed to check signup status:', err);
        setSignupEnabled(true); // Default to enabled on error
      }
    };

    checkSignupStatus();
  }, []);

  // Effect 1: Check on mount if user is *already* logged in
  useEffect(() => {
    // Only perform the check logic once after initial auth state is resolved
    if (!initialCheckDoneRef.current && !authLoading) {
      // Mark check as done immediately after auth is resolved
      initialCheckDoneRef.current = true; 
      console.log('[RegisterPage Effect 1] Initial auth loaded. Marking check as done.');

      // Now, check if user exists at this initial point
      if (user) {
        // Check if we are not already on step 4 (completion step)
        if (currentStep < 4) { 
            console.log('RegisterPage initial mount with existing user (and not step 4), redirecting.');
            navigate('/agents', { replace: true });
        }
      }
    }
    // This effect runs when authLoading changes, ensuring the check runs once after loading is false.
  }, [authLoading, user, currentStep, navigate]); 

  // Effect 2: Handle redirection *after* completing step 3
  useEffect(() => {
    if (currentStep === 4) {
      if (user) { 
          console.log('Registration complete (step 4), redirecting after delay.');
          const timer = setTimeout(() => {
              navigate('/agents', { replace: true });
          }, 2000); 
          return () => clearTimeout(timer);
      } else {
          console.warn('Reached step 4 but user is not defined. Cannot redirect.');
          setError('Registration completed, but there was an issue retrieving your session. Please try logging in.');
      }
    }
  }, [currentStep, user, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const nextStep = () => {
    console.log('[RegisterPage] nextStep called');
    setCurrentStep(prev => {
        const next = prev + 1;
        console.log(`[RegisterPage] Updating step from ${prev} to ${next}`);
        return next;
    });
  }
  const prevStep = () => setCurrentStep(prev => prev - 1);

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    console.log('[RegisterPage] handleStep1Submit: Calling signUp...');
    try {
      await signUp(formData.email, formData.password, formData.fullName);
      console.log('[RegisterPage] handleStep1Submit: signUp successful. Calling nextStep...');
      nextStep(); 
    } catch (err: any) {
        console.error("Registration Step 1 Error:", err);
        setError(err.message || 'An error occurred during sign up.');
    } finally {
        setLoading(false);
    }
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
        const profileData = {
            mobile: formData.mobile || null, // Send null if empty
            company_name: formData.companyName || null,
            title: formData.title || null,
        };
        await updateProfile(profileData); // Call updateProfile from context
        nextStep(); // Proceed to step 3 on success
    } catch (err: any) {
        console.error("Registration Step 2 Error:", err);
        setError(err.message || 'Failed to save contact details.');
    } finally {
        setLoading(false);
    }
  };

  const handleStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
        const profileData = {
            usage_reason: formData.usageReason === 'other' 
              ? formData.usageReasonOther 
              : formData.usageReason,
            hopes_goals: formData.hopesGoals || null,
        };
        await updateProfile(profileData); // Call updateProfile from context
        nextStep(); // Proceed to step 4 (completion) on success
    } catch (err: any) {
        console.error("Registration Step 3 Error:", err);
        setError(err.message || 'Failed to save usage details.');
    } finally {
        setLoading(false);
    }
  };

  // Shared button styles
  const buttonBaseClasses = "py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50";
  const primaryButtonClasses = `text-white bg-indigo-600 hover:bg-indigo-700 ${buttonBaseClasses}`;
  const secondaryButtonClasses = `text-indigo-700 bg-indigo-100 hover:bg-indigo-200 ${buttonBaseClasses}`;

  // Input field styles
  const inputClasses = "appearance-none relative block w-full px-3 py-2 border border-gray-700 placeholder-gray-500 text-white bg-gray-800 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm";
  const radioLabelClasses = "ml-2 block text-sm font-medium text-gray-300";

  // Show loading state while checking signup status
  if (signupEnabled === null) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-lg w-full space-y-8 p-10 bg-gray-850 rounded-xl shadow-lg">
          <div className="flex flex-col items-center">
            <Bot className="w-12 h-12 text-indigo-500 mb-4" />
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-2"></div>
            <p className="text-gray-400">Checking registration status...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show disabled message if signup is disabled
  if (signupEnabled === false) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-lg w-full space-y-8 p-10 bg-gray-850 rounded-xl shadow-lg">
          <div className="flex flex-col items-center mb-8">
            <Bot className="w-12 h-12 text-indigo-500 mb-4" />
            <h2 className="text-center text-3xl font-extrabold text-white mb-4">
              Registration Unavailable
            </h2>
          </div>
          
          <div className="bg-yellow-500/10 border border-yellow-500 text-yellow-400 p-4 rounded-md flex items-start">
            <AlertCircle className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold mb-2">New user registrations are currently disabled.</p>
              <p className="text-sm">Please contact the system administrator if you need access to the platform.</p>
            </div>
          </div>

          <div className="text-center mt-6">
            <button
              onClick={() => navigate('/login')}
              className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
            >
              ← Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg w-full space-y-8 p-10 bg-gray-850 rounded-xl shadow-lg">
        
        <div className="flex flex-col items-center mb-8">
          <Bot className="w-12 h-12 text-indigo-500 mb-4" />
          <h2 className="text-center text-3xl font-extrabold text-white mb-2">
            Create your Gofr Agents Account
          </h2>
          <p className="text-sm text-gray-400">Step {currentStep} of 3</p> 
          {/* TODO: Add progress bar/indicator */} 
        </div>

        {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded-md text-sm text-center">
              {error}
            </div>
        )}

        {/* Step 1: Account Creation */} 
        {currentStep === 1 && (
          <form onSubmit={handleStep1Submit} className="space-y-6">
            <h3 className="text-xl font-semibold text-white text-center">Account Details</h3>
            <div>
              <label htmlFor="fullName" className="sr-only">Full Name</label>
              <input id="fullName" name="fullName" type="text" required className={inputClasses} placeholder="Full Name" value={formData.fullName} onChange={handleInputChange} />
            </div>
            <div>
              <label htmlFor="email" className="sr-only">Email address</label>
              <input id="email" name="email" type="email" autoComplete="email" required className={inputClasses} placeholder="Email address" value={formData.email} onChange={handleInputChange} />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input id="password" name="password" type="password" autoComplete="new-password" required className={inputClasses} placeholder="Password" value={formData.password} onChange={handleInputChange} />
            </div>
             <div>
              <label htmlFor="confirmPassword" className="sr-only">Confirm Password</label>
              <input id="confirmPassword" name="confirmPassword" type="password" required className={inputClasses} placeholder="Confirm Password" value={formData.confirmPassword} onChange={handleInputChange} />
            </div>
            <div className="flex justify-end">
                <button type="submit" disabled={loading} className={`${primaryButtonClasses} inline-flex items-center`}>
                    {loading ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <ArrowRight className="mr-2 h-5 w-5"/>}
                    Next: Contact Info
                </button>
            </div>
          </form>
        )}

        {/* Step 2: Contact & Company (Placeholder UI) */} 
        {currentStep === 2 && (
           <form onSubmit={handleStep2Submit} className="space-y-6">
             <h3 className="text-xl font-semibold text-white text-center">Contact & Company</h3>
             <p className="text-gray-400 text-center text-sm">Help us understand your background (optional).</p>
             {/* TODO: Add Mobile, Company, Title inputs */}
             <div>
                 <label htmlFor="mobile" className="sr-only">Mobile (Optional)</label>
                 <input id="mobile" name="mobile" type="tel" className={inputClasses} placeholder="Mobile (Optional)" value={formData.mobile || ''} onChange={handleInputChange} />
             </div>
             <div>
                 <label htmlFor="companyName" className="sr-only">Company Name (Optional)</label>
                 <input id="companyName" name="companyName" type="text" className={inputClasses} placeholder="Company Name (Optional)" value={formData.companyName || ''} onChange={handleInputChange} />
             </div>
             <div>
                 <label htmlFor="title" className="sr-only">Job Title (Optional)</label>
                 <input id="title" name="title" type="text" className={inputClasses} placeholder="Job Title (Optional)" value={formData.title || ''} onChange={handleInputChange} />
             </div>
             <div className="flex justify-between">
                 <button type="button" onClick={prevStep} disabled={loading} className={`${secondaryButtonClasses} inline-flex items-center`}>
                     <ArrowLeft className="mr-2 h-5 w-5"/> Previous
                 </button>
                 <button type="submit" disabled={loading} className={`${primaryButtonClasses} inline-flex items-center`}>
                     {loading ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <ArrowRight className="mr-2 h-5 w-5"/>}
                     Next: Platform Usage
                 </button>
             </div>
           </form>
        )}

        {/* Step 3: Platform Usage (Placeholder UI) */} 
        {currentStep === 3 && (
           <form onSubmit={handleStep3Submit} className="space-y-6">
             <h3 className="text-xl font-semibold text-white text-center">Platform Usage</h3>
             <p className="text-gray-400 text-center text-sm">Tell us how you plan to use Gofr Agents.</p>
             
             {/* Usage Reason Radio Buttons */}
             <div className="mt-4">
               <label className="block text-sm font-medium text-gray-300 mb-3">How do you plan to use Gofr Agents?</label>
               <div className="space-y-3">
                 <div className="flex items-start">
                   <div className="flex items-center h-5">
                     <input
                       id="usageReason-personal"
                       name="usageReason"
                       type="radio"
                       value="personal"
                       checked={formData.usageReason === 'personal'}
                       onChange={handleInputChange}
                       className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-600 bg-gray-700"
                     />
                   </div>
                   <label htmlFor="usageReason-personal" className={radioLabelClasses}>
                     Personal productivity and projects
                   </label>
                 </div>
                 
                 <div className="flex items-start">
                   <div className="flex items-center h-5">
                     <input
                       id="usageReason-work"
                       name="usageReason"
                       type="radio"
                       value="work"
                       checked={formData.usageReason === 'work'}
                       onChange={handleInputChange}
                       className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-600 bg-gray-700"
                     />
                   </div>
                   <label htmlFor="usageReason-work" className={radioLabelClasses}>
                     Professional work at my company
                   </label>
                 </div>
                 
                 <div className="flex items-start">
                   <div className="flex items-center h-5">
                     <input
                       id="usageReason-business"
                       name="usageReason"
                       type="radio"
                       value="business"
                       checked={formData.usageReason === 'business'}
                       onChange={handleInputChange}
                       className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-600 bg-gray-700"
                     />
                   </div>
                   <label htmlFor="usageReason-business" className={radioLabelClasses}>
                     Building client solutions or products
                   </label>
                 </div>
                 
                 <div className="flex items-start">
                   <div className="flex items-center h-5">
                     <input
                       id="usageReason-education"
                       name="usageReason"
                       type="radio"
                       value="education"
                       checked={formData.usageReason === 'education'}
                       onChange={handleInputChange}
                       className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-600 bg-gray-700"
                     />
                   </div>
                   <label htmlFor="usageReason-education" className={radioLabelClasses}>
                     Educational or research purposes
                   </label>
                 </div>
                 
                 <div className="flex items-start">
                   <div className="flex items-center h-5">
                     <input
                       id="usageReason-other"
                       name="usageReason"
                       type="radio"
                       value="other"
                       checked={formData.usageReason === 'other'}
                       onChange={handleInputChange}
                       className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-600 bg-gray-700"
                     />
                   </div>
                   <label htmlFor="usageReason-other" className={radioLabelClasses}>
                     Other
                   </label>
                 </div>
                 
                 {/* Conditional text field for "Other" reason */}
                 {formData.usageReason === 'other' && (
                   <div className="ml-6 mt-2">
                     <label htmlFor="usageReasonOther" className="sr-only">Please specify</label>
                     <input 
                       id="usageReasonOther" 
                       name="usageReasonOther" 
                       type="text" 
                       required
                       className={inputClasses} 
                       placeholder="Please specify your usage reason" 
                       value={formData.usageReasonOther || ''} 
                       onChange={handleInputChange} 
                     />
                   </div>
                 )}
               </div>
             </div>

              <div>
                  <label htmlFor="hopesGoals" className="block text-sm font-medium text-gray-300 mb-1">What do you hope Gofr Agents will help you achieve?</label>
                  <textarea id="hopesGoals" name="hopesGoals" rows={4} className={inputClasses} placeholder="e.g., Automate customer support, build custom AI assistants for clients..." value={formData.hopesGoals || ''} onChange={handleInputChange}></textarea>
              </div>
             <div className="flex justify-between">
                 <button type="button" onClick={prevStep} disabled={loading} className={`${secondaryButtonClasses} inline-flex items-center`}>
                    <ArrowLeft className="mr-2 h-5 w-5"/> Previous
                 </button>
                 <button type="submit" disabled={loading} className={`${primaryButtonClasses} inline-flex items-center`}>
                    {loading ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : 'Finish Registration'}
                 </button>
             </div>
           </form>
        )}

         {/* Step 4: Completion - Just display message, effect handles redirect */} 
         {currentStep === 4 && (
            <div className="text-center space-y-4">
                <h3 className="text-2xl font-semibold text-green-400">Registration Complete!</h3>
                <p className="text-gray-300">Redirecting you to the agents page...</p>
            </div>
         )}

      </div>
    </div>
  );
} 