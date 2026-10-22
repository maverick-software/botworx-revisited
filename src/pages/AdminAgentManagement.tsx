import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, Bot, ChevronLeft, ChevronRight, Search, Edit } from 'lucide-react';
import { AgentSettingsModal } from '../components/modals/AgentSettingsModal';

// Define the shape of the agent data we expect from the function
interface AgentOwner {
    id: string;
    email?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
}

interface AdminAgent {
    id: string;
    name: string;
    description?: string;
    created_at: string;
    active: boolean; // Agent's own active flag
    owner: AgentOwner | null;
    discord_status: string; // e.g., 'active', 'inactive', 'connecting'
    enabled_guild_count: number;
    total_guild_count: number;
}

interface FetchResponse {
    agents: AdminAgent[];
    total: number;
}

const PER_PAGE = 20;
const DEBOUNCE_DELAY = 500;

export function AdminAgentManagement() {
    const [agents, setAgents] = useState<AdminAgent[]>([]);
    const [totalAgents, setTotalAgents] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    // Agent Settings Modal state
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
    const [selectedAgent, setSelectedAgent] = useState<AdminAgent | null>(null);

    const fetchAgents = useCallback(async (page: number, search: string) => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: functionError } = await supabase.functions.invoke<FetchResponse>(
                'admin-get-agents',
                { body: { page: page, perPage: PER_PAGE, searchTerm: search } }
            );
            if (functionError) throw new Error(functionError.message || 'Failed to fetch agents');
            if (!data) throw new Error('No data received from function');
            setAgents(data.agents || []);
            setTotalAgents(data.total || 0);
            setCurrentPage(page);
        } catch (err: any) {
            console.error("Error fetching agents:", err);
            setError(err.message || 'An unknown error occurred');
            setAgents([]);
            setTotalAgents(0);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = setTimeout(() => {
            fetchAgents(1, searchTerm);
        }, DEBOUNCE_DELAY);
        return () => { if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current); };
    }, [searchTerm, fetchAgents]);

    const totalPages = Math.ceil(totalAgents / PER_PAGE);

    const handlePrevPage = () => { if (currentPage > 1) { fetchAgents(currentPage - 1, searchTerm); } };
    const handleNextPage = () => { if (currentPage < totalPages) { fetchAgents(currentPage + 1, searchTerm); } };
    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => { setSearchTerm(event.target.value); };
    
    const handleEditAgent = (agent: AdminAgent) => {
        setSelectedAgentId(agent.id);
        setSelectedAgent(agent);
        setIsSettingsModalOpen(true);
    };
    
    const handleCloseSettings = () => {
        setIsSettingsModalOpen(false);
        setSelectedAgentId(null);
        setSelectedAgent(null);
    };

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center text-foreground">
                            <Bot className="w-8 h-8 mr-3 text-primary" />
                            Agent Management
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            Monitor and manage AI agents, their Discord status, and configurations
                        </p>
                    </div>
                    <div className="relative">
                        <input 
                            type="text"
                            placeholder="Search agents or owners..."
                            value={searchTerm}
                            onChange={handleSearchChange}
                            className="pl-10 pr-4 py-2 rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                        />
                        <Search className="w-5 h-5 text-muted-foreground absolute left-3 top-1/2 transform -translate-y-1/2" />
                    </div>
                </div>

                {error && (
                    <div className="mb-6 bg-destructive/10 border border-destructive/50 text-destructive p-4 rounded-lg flex items-center">
                        <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                        <span>Error loading agents: {error}</span>
                    </div>
                )}

                <div className="bg-card border border-border shadow-sm rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-border rounded-lg">
                            <thead className="bg-muted/50 rounded-t-lg">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-full">Name</th>
                                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap border-l border-border">Owner</th>
                                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap border-l border-border">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-card divide-y divide-border">
                                {loading ? (
                                    <tr>
                                        <td colSpan={3} className="text-center py-12 text-muted-foreground">
                                            <div className="flex flex-col items-center justify-center">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
                                                <span>Loading agents...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : agents.length === 0 ? (
                                     <tr>
                                        <td colSpan={3} className="text-center py-12 text-muted-foreground">
                                            {searchTerm ? `No agents found matching "${searchTerm}".` : "No agents found."}
                                        </td>
                                    </tr>
                                ) : (
                                    agents.map((agent) => {
                                        return (
                                            <tr key={agent.id} className="hover:bg-muted/30 transition-colors">
                                                <td className="px-6 py-4 text-sm font-medium text-foreground w-full" title={agent.description || agent.name}>{agent.name}</td>
                                                <td className="px-6 py-4 text-sm text-foreground text-right whitespace-nowrap border-l border-border" title={agent.owner?.email}>{agent.owner?.first_name && agent.owner?.last_name ? `${agent.owner.first_name} ${agent.owner.last_name}` : agent.owner?.username || agent.owner?.email || 'Unknown'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium border-l border-border">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button 
                                                            onClick={() => handleEditAgent(agent)}
                                                            className="text-primary hover:text-primary/80 p-1.5 rounded-md hover:bg-muted transition-colors" 
                                                            title="Edit Agent"
                                                        >
                                                            <Edit size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pagination Controls */}
                {(!searchTerm || totalAgents > PER_PAGE) && totalPages > 1 && (
                    <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
                         <span>{searchTerm ? `Page ${currentPage} (Total matching approximate: ${totalAgents})` : `Page ${currentPage} of ${totalPages} (Total: ${totalAgents} agents)`}</span>
                         <div className="flex gap-2">
                            <button 
                                onClick={handlePrevPage} 
                                disabled={currentPage === 1} 
                                className="px-4 py-2 rounded-md border border-border bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors text-foreground"
                            >
                                <ChevronLeft className="w-4 h-4" /> Previous
                            </button>
                            <button 
                                onClick={handleNextPage} 
                                disabled={currentPage === totalPages} 
                                className="px-4 py-2 rounded-md border border-border bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors text-foreground"
                            >
                                Next <ChevronRight className="w-4 h-4" />
                            </button>
                         </div>
                    </div>
                )}
                
                {/* Agent Settings Modal */}
                {selectedAgentId && selectedAgent && (
                    <AgentSettingsModal
                        isOpen={isSettingsModalOpen}
                        onClose={handleCloseSettings}
                        agentId={selectedAgentId}
                        agentData={selectedAgent}
                        onAgentUpdated={() => fetchAgents(currentPage, searchTerm)}
                    />
                )}
            </div>
        </div>
    );
} 