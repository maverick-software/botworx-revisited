import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, Users, ChevronLeft, ChevronRight, Search, Edit, PlayCircle, PauseCircle, Ban, Zap, UserPlus, UserX } from 'lucide-react';
import { EditUserRolesModal } from '../components/modals/EditUserRolesModal';
import { ConfirmationModal } from '../components/modals/ConfirmationModal';
import { TokenUsageModal } from '../components/modals/TokenUsageModal';

// Define the shape of the combined user data we expect from the function
interface AdminUser {
    id: string;
    email: string;
    created_at: string;
    last_sign_in_at?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
    roles: { id: string; name: string }[];
    is_banned?: boolean;
    banned_until?: string;
}

interface FetchResponse {
    users: AdminUser[];
    total: number;
}

const PER_PAGE = 20; // Number of users per page
const DEBOUNCE_DELAY = 500; // milliseconds

export function AdminUserManagement() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [totalUsers, setTotalUsers] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    // Signup toggle state
    const [signupEnabled, setSignupEnabled] = useState<boolean | null>(null);
    const [signupToggleLoading, setSignupToggleLoading] = useState(false);

    // --- State for Modal ---
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
    // --- End Modal State ---

    // --- State for Status Change Confirmation ---
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [confirmAction, setConfirmAction] = useState<'suspend' | 'reactivate' | null>(null);
    const [userToAction, setUserToAction] = useState<AdminUser | null>(null);
    const [isPerformingAction, setIsPerformingAction] = useState(false); // Loading state for the action itself
    // --- End Status Change State ---

    // --- State for Token Usage Modal ---
    const [isTokenUsageModalOpen, setIsTokenUsageModalOpen] = useState(false);
    const [selectedUserForUsage, setSelectedUserForUsage] = useState<AdminUser | null>(null);
    // --- End Token Usage Modal State ---

    // Fetch signup status
    const fetchSignupStatus = useCallback(async () => {
        try {
            const { data, error: functionError } = await supabase.functions.invoke('get-signup-status');
            
            if (functionError) {
                console.error('Error fetching signup status:', functionError);
                return;
            }
            
            setSignupEnabled(data.enabled);
        } catch (err: any) {
            console.error('Failed to fetch signup status:', err);
        }
    }, []);

    const fetchUsers = useCallback(async (page: number, search: string) => {
        setLoading(true);
        setError(null);
        console.log(`Fetching page ${page}, search: '${search}'`);
        try {
            const { data, error: functionError } = await supabase.functions.invoke<FetchResponse>(
                'admin-get-users',
                {
                    body: { 
                        page: page, 
                        perPage: PER_PAGE,
                        searchTerm: search
                    }
                }
            );

            if (functionError) throw new Error(functionError.message || 'Failed to fetch users');
            if (!data) throw new Error('No data received from function');

            setUsers(data.users || []);
            setTotalUsers(data.total || 0);
            setCurrentPage(page);

        } catch (err: any) {
            console.error("Error fetching users:", err);
            setError(err.message || 'An unknown error occurred');
            setUsers([]);
            setTotalUsers(0);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Fetch signup status on mount
        fetchSignupStatus();
    }, [fetchSignupStatus]);

    useEffect(() => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }

        debounceTimeoutRef.current = setTimeout(() => {
            fetchUsers(1, searchTerm);
        }, DEBOUNCE_DELAY);

        return () => {
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        };
    }, [searchTerm, fetchUsers]);

    const totalPages = Math.ceil(totalUsers / PER_PAGE);

    const handlePrevPage = () => {
        if (currentPage > 1) {
            fetchUsers(currentPage - 1, searchTerm);
        }
    };

    const handleNextPage = () => {
        if (currentPage < totalPages) {
            fetchUsers(currentPage + 1, searchTerm);
        }
    };

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value);
    };

    // --- Modal Handlers ---
    const handleEditClick = (userToEdit: AdminUser) => {
        console.log('[AdminUserManagement] handleEditClick called for user:', userToEdit);
        setEditingUser(userToEdit);
        setIsEditModalOpen(true);
    };

    const handleCloseModal = () => {
        console.log('[AdminUserManagement] handleCloseModal called');
        setIsEditModalOpen(false);
        setEditingUser(null);
    };

    const handleRolesUpdated = (userId: string, updatedRoles: { id: string; name: string }[]) => {
        console.log(`[AdminUserManagement] handleRolesUpdated called for user ${userId}`);
        setUsers(currentUsers => 
            currentUsers.map(u => 
                u.id === userId ? { ...u, roles: updatedRoles } : u
            )
        );
    };
    // --- End Modal Handlers ---

    // --- Status Action Handlers ---
    const handleStatusActionClick = (user: AdminUser, action: 'suspend' | 'reactivate') => {
        setUserToAction(user);
        setConfirmAction(action);
        setIsConfirmModalOpen(true);
    };

    const closeConfirmModal = () => {
        setIsConfirmModalOpen(false);
        setUserToAction(null);
        setConfirmAction(null);
    };

    const confirmStatusChange = async () => {
        if (!userToAction || !confirmAction) return;

        setIsPerformingAction(true);
        setError(null);
        try {
            const { error: functionError } = await supabase.functions.invoke(
                'admin-set-user-status',
                {
                    body: { 
                        userIdToUpdate: userToAction.id, 
                        action: confirmAction 
                    }
                }
            );
            if (functionError) throw new Error(functionError.message || `Failed to ${confirmAction} user`);

            console.log(`User ${userToAction.id} ${confirmAction} success`);

        } catch (err: any) {
            console.error(`Error ${confirmAction} user:`, err);
            setError(err.message || 'An unknown error occurred');
        } finally {
            setIsPerformingAction(false);
            closeConfirmModal();
        }
    };
    // --- End Status Action Handlers ---

    // --- Token Usage Modal Handlers ---
    const handleViewUsage = (user: AdminUser) => {
        setSelectedUserForUsage(user);
        setIsTokenUsageModalOpen(true);
    };

    const handleCloseTokenUsageModal = () => {
        setIsTokenUsageModalOpen(false);
        setSelectedUserForUsage(null);
    };
    // --- End Token Usage Modal Handlers ---

    // --- Signup Toggle Handlers ---
    const handleSignupToggle = async () => {
        if (signupEnabled === null) return;
        
        setSignupToggleLoading(true);
        setError(null);
        
        try {
            const { data, error: functionError } = await supabase.functions.invoke(
                'admin-toggle-signup',
                {
                    body: { enabled: !signupEnabled }
                }
            );

            if (functionError) throw new Error(functionError.message || 'Failed to toggle signup status');
            
            setSignupEnabled(!signupEnabled);
            console.log(`Signup ${!signupEnabled ? 'enabled' : 'disabled'} successfully`);
        } catch (err: any) {
            console.error('Error toggling signup status:', err);
            setError(err.message || 'Failed to toggle signup status');
        } finally {
            setSignupToggleLoading(false);
        }
    };
    // --- End Signup Toggle Handlers ---

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleString();
        } catch (e) {
            return 'Invalid Date';
        }
    };

    // Log state on render
    console.log('[AdminUserManagement] Rendering - isEditModalOpen:', isEditModalOpen, 'editingUser:', editingUser);

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center text-foreground">
                            <Users className="w-8 h-8 mr-3 text-primary" />
                            User Management
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            Manage user accounts, roles, and permissions across the platform
                        </p>
                    </div>
                    <div className="relative">
                        <input 
                            type="text"
                            placeholder="Search users (email, name...)"
                            value={searchTerm}
                            onChange={handleSearchChange}
                            className="pl-10 pr-4 py-2 rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                        />
                        <Search className="w-5 h-5 text-muted-foreground absolute left-3 top-1/2 transform -translate-y-1/2" />
                    </div>
                </div>

                {/* Signup Toggle Card */}
                <div className="mb-6 bg-card border border-border shadow-sm rounded-lg p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                {signupEnabled ? (
                                    <UserPlus className="w-6 h-6 text-green-500" />
                                ) : (
                                    <UserX className="w-6 h-6 text-destructive" />
                                )}
                                <h3 className="text-lg font-semibold text-foreground">
                                    New User Registrations
                                </h3>
                            </div>
                            <p className="text-sm text-muted-foreground ml-9">
                                {signupEnabled === null ? (
                                    'Loading signup status...'
                                ) : signupEnabled ? (
                                    'New users can currently sign up for accounts via the registration page.'
                                ) : (
                                    'New user registrations are currently disabled. Only existing users can log in.'
                                )}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex flex-col items-end">
                                <span className="text-xs font-medium text-muted-foreground mb-1">
                                    Status
                                </span>
                                <span className={`text-sm font-semibold ${signupEnabled ? 'text-green-500' : 'text-destructive'}`}>
                                    {signupEnabled === null ? '...' : signupEnabled ? 'Enabled' : 'Disabled'}
                                </span>
                            </div>
                            <button
                                onClick={handleSignupToggle}
                                disabled={signupToggleLoading || signupEnabled === null}
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                                    signupEnabled ? 'bg-green-500' : 'bg-gray-600'
                                }`}
                                role="switch"
                                aria-checked={signupEnabled || false}
                                title={signupEnabled ? 'Click to disable signups' : 'Click to enable signups'}
                            >
                                <span
                                    aria-hidden="true"
                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                        signupEnabled ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                                >
                                    {signupToggleLoading && (
                                        <div className="flex h-full w-full items-center justify-center">
                                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-primary"></div>
                                        </div>
                                    )}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 bg-destructive/10 border border-destructive/50 text-destructive p-4 rounded-lg flex items-center">
                        <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                        <span>Error: {error}</span>
                    </div>
                )}

                <div className="bg-card border border-border shadow-sm rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-border">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Roles</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Joined</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Last Sign In</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-card divide-y divide-border">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-12 text-muted-foreground">
                                            <div className="flex flex-col items-center justify-center">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
                                                <span>Loading users...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : users.length === 0 ? (
                                     <tr>
                                        <td colSpan={6} className="text-center py-12 text-muted-foreground">
                                            {searchTerm ? `No users found matching "${searchTerm}".` : "No users found."}
                                        </td>
                                    </tr>
                                ) : (
                                    users.map((user) => (
                                        <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-6 py-4 text-sm font-medium text-foreground" title={user.email}>{user.email}</td>
                                            <td className="px-6 py-4 text-sm text-foreground">{user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.username || '---'}</td>
                                            <td className="px-6 py-4 text-sm">
                                                <div className="flex flex-wrap gap-1">
                                                    {user.is_banned && (
                                                        <span className="px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                                                            Suspended
                                                        </span>
                                                    )}
                                                    {user.roles.map(role => (
                                                        <span key={role.id} className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${role.name === 'admin' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-muted text-muted-foreground border border-border'}`}>
                                                            {role.name}
                                                        </span>
                                                    ))}
                                                    {!user.is_banned && user.roles.length === 0 && <span className="text-muted-foreground italic">No roles</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{formatDate(user.created_at)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{formatDate(user.last_sign_in_at)}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                                <div className="flex items-center gap-2">
                                                                    <button 
                                                                        onClick={() => handleViewUsage(user)} 
                                                                        className="text-blue-500 hover:text-blue-600 p-1.5 rounded-md hover:bg-blue-500/10 transition-colors"
                                                                        title="View Token Usage"
                                                                    >
                                                                        <Zap size={16} />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleEditClick(user)} 
                                                                        className="text-primary hover:text-primary/80 p-1.5 rounded-md hover:bg-muted transition-colors"
                                                                        title="Edit Roles"
                                                                    >
                                                                        <Edit size={16} />
                                                                    </button>
                                                                    {user.is_banned ? (
                                                                        <button 
                                                                            onClick={() => handleStatusActionClick(user, 'reactivate')} 
                                                                            className="text-success hover:text-success/80 p-1.5 rounded-md hover:bg-success/10 transition-colors"
                                                                            title="Reactivate User"
                                                                        >
                                                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                                                        </button>
                                                                    ) : (
                                                                        <button 
                                                                            onClick={() => handleStatusActionClick(user, 'suspend')} 
                                                                            className="text-destructive hover:text-destructive/80 p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
                                                                            title="Suspend User"
                                                                        >
                                                                            <Ban size={16} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {(!searchTerm || totalUsers > PER_PAGE) && totalPages > 1 && (
                    <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
                        <span>
                            {searchTerm 
                                ? `Page ${currentPage} (Total matching approximate: ${totalUsers})` 
                                : `Page ${currentPage} of ${totalPages} (Total: ${totalUsers} users)`
                            }
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={handlePrevPage}
                                disabled={currentPage === 1 || loading}
                                className="px-4 py-2 rounded-md border border-border bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors text-foreground"
                            >
                                <ChevronLeft className="w-4 h-4" /> Prev
                            </button>
                            <button
                                onClick={handleNextPage}
                                disabled={currentPage === totalPages || loading}
                                className="px-4 py-2 rounded-md border border-border bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors text-foreground"
                            >
                                Next <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                <EditUserRolesModal 
                    user={editingUser}
                    isOpen={isEditModalOpen}
                    onClose={handleCloseModal}
                    onRolesUpdated={handleRolesUpdated}
                />
                <ConfirmationModal 
                    isOpen={isConfirmModalOpen}
                    onClose={closeConfirmModal}
                    onConfirm={confirmStatusChange}
                    title={`${confirmAction === 'suspend' ? 'Suspend' : 'Reactivate'} User?`}
                    confirmText={`${confirmAction === 'suspend' ? 'Suspend' : 'Reactivate'}`}
                    confirmButtonVariant={confirmAction === 'suspend' ? 'danger' : 'primary'}
                    isLoading={isPerformingAction}
                >
                    <p className="text-muted-foreground">
                        Are you sure you want to {confirmAction} the user <span className="font-medium text-foreground">{userToAction?.email}</span>?
                        {confirmAction === 'suspend' && 
                            <span className="block mt-2 text-sm text-warning">This will prevent the user from logging in.</span>
                        }
                         {confirmAction === 'reactivate' && 
                            <span className="block mt-2 text-sm text-success">This will allow the user to log in again.</span>
                        }
                    </p>
                </ConfirmationModal>
                {selectedUserForUsage && (
                    <TokenUsageModal
                        isOpen={isTokenUsageModalOpen}
                        onClose={handleCloseTokenUsageModal}
                        userId={selectedUserForUsage.id}
                        userEmail={selectedUserForUsage.email}
                        userName={selectedUserForUsage.first_name && selectedUserForUsage.last_name ? `${selectedUserForUsage.first_name} ${selectedUserForUsage.last_name}` : selectedUserForUsage.username}
                    />
                )}
            </div>
        </div>
    );
} 