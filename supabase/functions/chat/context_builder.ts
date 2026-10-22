import { createClient } from 'npm:@supabase/supabase-js@2.39.7'; // Needed for types?

// --- Interfaces (Duplicated from index.ts for now, consider shared types later) ---

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: string;
    agentName?: string | null;
}

export interface BasicWorkspaceMember {
    id: string;
    role: string | null;
    user_id?: string | null;
    agent_id?: string | null;
    team_id?: string | null;
    user_name?: string | null;
    agent_name?: string | null;
    team_name?: string | null;
}

export interface WorkspaceDetails {
    id: string;
    name: string;
    context_window_size: number;
    context_window_token_limit: number;
    members: BasicWorkspaceMember[];
}

export interface ContextSettings {
    messageLimit: number;
    tokenLimit: number;
}

// --- Token Counting Function ---
// TODO: Replace with a proper tokenizer library (like tiktoken) for accuracy
function estimateTokenCount(text: string): number {
    if (!text) return 0;
    // Simple approximation: characters / 4
    return Math.ceil(text.length / 4);
}

// --- Context Builder Class ---

export class ContextBuilder {
    private systemMessages: ChatMessage[] = [];
    private historyMessages: ChatMessage[] = [];
    private userMessage: ChatMessage | null = null;
    private mcpContext: string | null = null;
    private vectorContext: string | null = null;
    private readonly settings: ContextSettings;

    constructor(settings: ContextSettings) {
        this.settings = settings;
    }

    addSystemInstruction(content: string): this {
        if (content) {
            this.systemMessages.push({ role: 'system', content });
        }
        return this;
    }

    addWorkspaceContext(details: WorkspaceDetails | null): this {
        if (!details) return this;

        let workspaceContextStr = `You are in the workspace \"${details.name}\".\n`;
        if (details.members.length > 0) {
            workspaceContextStr += "Current members in this workspace:\n";
            details.members.forEach(member => {
                let memberInfo = `- `;
                if (member.agent_name) memberInfo += `Agent: ${member.agent_name}`;
                else if (member.user_name) memberInfo += `User: ${member.user_name}`;
                else if (member.team_name) memberInfo += `Team: ${member.team_name}`;
                else memberInfo += `Unknown Member (ID: ${member.id})`;
                if (member.role) memberInfo += ` (Role: ${member.role})`;
                workspaceContextStr += memberInfo + '\n';
            });
        } else {
            workspaceContextStr += "You are the only member currently listed.\n";
        }
        // TODO: Add channel context (name/topic) if available
        this.addSystemInstruction(workspaceContextStr);
        return this;
    }

    addAssistantInstruction(content: string): this {
        if (content) {
            this.addSystemInstruction(`ASSISTANT INSTRUCTIONS: ${content}`);
        }
        return this;
    }

    addVectorMemories(content: string | null): this {
        if (content) {
            // Store separately initially to ensure it's added after core instructions
            this.vectorContext = content;
        }
        return this;
    }

    addMCPContext(content: string | null): this {
        if (content) {
             // Store separately initially
            this.mcpContext = content;
        }
        return this;
    }

    // Sets the history, assuming it's already fetched and ordered chronologically
    setHistory(history: ChatMessage[]): this {
        // Limit history by message count *before* token counting
        this.historyMessages = history.slice(-this.settings.messageLimit);
        return this;
    }

    setUserInput(messageContent: string): this {
        if (!messageContent) {
            throw new Error("User input content cannot be empty.");
        }
        this.userMessage = { role: 'user', content: messageContent };
        return this;
    }

    // Builds the final context array for the LLM, applying token limits
    buildContext(): ChatMessage[] {
        if (!this.userMessage) {
            throw new Error("User input is required to build context.");
        }

        const finalMessages: ChatMessage[] = [];
        let currentTokenCount = 0;

        // --- 1. Add Core System Messages --- (Agent instructions, Workspace Info)
        for (const msg of this.systemMessages) {
            const tokens = estimateTokenCount(msg.content);
            if (currentTokenCount + tokens <= this.settings.tokenLimit) {
                finalMessages.push(msg);
                currentTokenCount += tokens;
            } else {
                console.warn("Token limit reached even before adding primary system messages.");
                break; // Stop adding if limit exceeded early
            }
        }

        // --- 2. Add Optional Context (Vector, MCP) --- (Prioritize these *before* history)
        const optionalContext: { content: string | null, name: string }[] = [
            { content: this.vectorContext, name: "Vector Context" },
            { content: this.mcpContext, name: "MCP Context" }
        ];

        for (const ctx of optionalContext) {
            if (ctx.content) {
                const tokens = estimateTokenCount(ctx.content);
                if (currentTokenCount + tokens <= this.settings.tokenLimit) {
                    finalMessages.push({ role: 'system', content: ctx.content });
                    currentTokenCount += tokens;
                } else {
                    console.warn(`Skipping ${ctx.name} due to token limit.`);
                }
            }
        }

        // --- 3. Add History (Truncated by Token Limit) --- 
        const availableTokensForHistoryAndUser = this.settings.tokenLimit - currentTokenCount;
        const userTokens = estimateTokenCount(this.userMessage.content);
        const availableTokensForHistory = availableTokensForHistoryAndUser - userTokens;

        const includedHistory: ChatMessage[] = [];
        let historyTokensUsed = 0;

        if (availableTokensForHistory > 0) {
            // Iterate history from newest to oldest
            for (let i = this.historyMessages.length - 1; i >= 0; i--) {
                const msg = this.historyMessages[i];
                // Format message for LLM (role, content, maybe name)
                const formattedMsg: ChatMessage = { role: msg.role, content: msg.content };
                // Optionally add agent name prefix for assistant messages in history
                // if (msg.role === 'assistant' && msg.agentName) {
                //     formattedMsg.content = `${msg.agentName}: ${msg.content}`;
                // }
                const msgTokens = estimateTokenCount(formattedMsg.content);

                if (historyTokensUsed + msgTokens <= availableTokensForHistory) {
                    includedHistory.unshift(formattedMsg); // Add to beginning to maintain order
                    historyTokensUsed += msgTokens;
                } else {
                    console.log(`Token limit reached for history. Stopped after adding ${includedHistory.length} messages.`);
                    break; // Stop adding history
                }
            }
            finalMessages.push(...includedHistory);
        }

        // --- 4. Add User Input --- (Ensure it fits)
        if (currentTokenCount + historyTokensUsed + userTokens <= this.settings.tokenLimit) {
             finalMessages.push(this.userMessage);
        } else {
             console.error("Token limit exceeded, cannot even fit user message!");
             // Handle this error case - maybe truncate user message or return error?
             // For now, return without user message, which is bad.
             // A better approach might be to always include user msg & truncate history more aggressively.
             // Revisit this logic if needed.
        }

        console.log(`ContextBuilder: Final messages count: ${finalMessages.length}. Tokens estimated: ${currentTokenCount + historyTokensUsed + (finalMessages.includes(this.userMessage) ? userTokens : 0)} (Limit: ${this.settings.tokenLimit}). History included: ${includedHistory.length}/${this.historyMessages.length}`);

        return finalMessages;
    }

    // Add a method to get the estimated total token count
    getTotalTokenCount(): number {
        let total = 0;
        
        // Count system messages
        for (const msg of this.systemMessages) {
            total += estimateTokenCount(msg.content);
        }
        
        // Count optional context
        if (this.vectorContext) {
            total += estimateTokenCount(this.vectorContext);
        }
        
        if (this.mcpContext) {
            total += estimateTokenCount(this.mcpContext);
        }
        
        // Count history messages
        for (const msg of this.historyMessages) {
            total += estimateTokenCount(msg.content);
        }
        
        // Count user message
        if (this.userMessage) {
            total += estimateTokenCount(this.userMessage.content);
        }
        
        return total;
    }
} 