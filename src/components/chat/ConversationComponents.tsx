import React from 'react';
import { Plus } from 'lucide-react';
import { useConversations } from '../../hooks/useConversations';

interface ConversationSelectorProps {
  agentId: string;
  userId: string | null;
  selectedConversationId: string | null;
  onSelect: (id: string | null) => void;
}

export function ConversationSelector({ agentId, userId, selectedConversationId, onSelect }: ConversationSelectorProps) {
  const { items, createConversation } = useConversations(agentId, userId);
  return (
    <div className="flex items-center space-x-2">
      <select
        className="text-xs bg-accent/50 rounded px-2 py-1 text-foreground"
        value={selectedConversationId || ''}
        onChange={(e) => onSelect(e.target.value || null)}
      >
        <option value="">All conversations</option>
        {items.map((c) => (
          <option key={c.conversation_id} value={c.conversation_id}>
            {c.title || c.conversation_id.slice(0, 8)}
          </option>
        ))}
      </select>
      <button
        className="p-1.5 hover:bg-accent rounded-lg transition-colors"
        title="New conversation"
        onClick={async () => {
          const id = await createConversation(null);
          onSelect(id);
        }}
      >
        <Plus className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}

interface SidebarConversationsProps {
  agentId: string;
  userId: string | null;
  selectedConversationId: string | null;
  onSelect: (id: string | null) => void;
}

export function SidebarConversations({ agentId, userId, selectedConversationId, onSelect }: SidebarConversationsProps) {
  const { items, renameConversation, archiveConversation, createConversation } = useConversations(agentId, userId);
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-2 pb-2">
        <button
          className="w-full text-xs border border-border rounded-md px-2 py-1 hover:bg-accent"
          onClick={async () => {
            const id = await createConversation('New Conversation');
            onSelect(id);
          }}
        >
          + New conversation
        </button>
      </div>
      {items.map((c) => {
        const isActive = c.conversation_id === selectedConversationId;
        return (
          <div key={c.conversation_id} className={`px-3 py-2 cursor-pointer text-sm flex items-center justify-between ${isActive ? 'bg-accent' : 'hover:bg-accent/50'}`} onClick={() => onSelect(c.conversation_id)}>
            <div className="flex-1 min-w-0 pr-2">
              <div className="truncate font-medium">{c.title || c.conversation_id.slice(0, 8)}</div>
              {c.last_message && (
                <div className="truncate text-xs text-muted-foreground/80">{c.last_message}</div>
              )}
            </div>
            {c.last_message_at && (
              <div className="text-[10px] text-muted-foreground/70 ml-2 whitespace-nowrap">
                {new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
            <div className="flex items-center space-x-2 opacity-70">
              <button
                className="text-[11px] hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  const title = prompt('Rename conversation', c.title || '') || undefined;
                  if (title !== undefined) renameConversation(c.conversation_id, title);
                }}
              >
                Rename
              </button>
              <button
                className="text-[11px] hover:underline text-red-500"
                onClick={(e) => {
                  e.stopPropagation();
                  archiveConversation(c.conversation_id);
                }}
              >
                Archive
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
