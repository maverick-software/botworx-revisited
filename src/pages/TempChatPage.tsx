import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { MessageCircle, Send, AlertCircle, Clock, User } from 'lucide-react';

// Create Supabase client for public access (no auth required)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface TempChatLink {
  id: string;
  title: string;
  description?: string;
  welcome_message?: string;
  agent_name: string;
  expires_at: string;
  max_messages_per_session: number;
  session_timeout_minutes: number;
  is_active: boolean;
}

interface ChatSession {
  id: string;
  session_token: string;
  message_count: number;
  status: 'active' | 'ended' | 'expired';
}

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
}

export const TempChatPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [linkData, setLinkData] = useState<TempChatLink | null>(null);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Validate token and get link data
  useEffect(() => {
    if (!token) {
      setError('Invalid chat link');
      setIsLoading(false);
      return;
    }

    validateAndInitialize();
  }, [token]);

  const validateAndInitialize = async () => {
    try {
      setIsLoading(true);
      
      // Call temporary-chat-api to validate the token
      const response = await fetch(`${supabaseUrl.replace('/rest/v1', '')}/functions/v1/temporary-chat-api/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token })
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || 'Invalid or expired chat link');
        return;
      }

      setLinkData(result.data.link);
      
      // Create a new chat session
      await createChatSession();

    } catch (err) {
      console.error('Error validating chat link:', err);
      setError('Failed to connect to chat. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const createChatSession = async () => {
    try {
      console.log('Creating chat session for token:', token?.substring(0, 8) + '...');
      
      const response = await fetch(`${supabaseUrl.replace('/rest/v1', '')}/functions/v1/temporary-chat-api/create-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ link_token: token })
      });

      const result = await response.json();
      console.log('Session creation result:', result);
      console.log('Result structure:', JSON.stringify(result, null, 2));

      if (result.success) {
        // Handle both possible response formats
        const sessionData = result.data?.session || result.session || result;
        setSession(sessionData);
        console.log('Session set successfully:', sessionData);
        
        // ✅ NEW: Prioritize initial_agent_message over welcome_message
        // The initial_agent_message is automatically sent by the database and is more context-specific
        if (sessionData.initial_agent_message && sessionData.should_send_initial !== false) {
          console.log('Adding initial agent message from session');
          setMessages([{
            id: 'initial-greeting',
            content: sessionData.initial_agent_message,
            role: 'assistant',
            timestamp: new Date().toISOString()
          }]);
        } else if (linkData?.welcome_message) {
          // Fallback to welcome_message if no initial_agent_message
          console.log('Adding welcome message from link data');
          setMessages([{
            id: 'welcome',
            content: linkData.welcome_message,
            role: 'assistant',
            timestamp: new Date().toISOString()
          }]);
        }
      } else {
        console.error('Session creation failed:', result.error);
        console.error('Full error response:', JSON.stringify(result, null, 2));
        setError(result.error || 'Failed to create chat session');
      }
    } catch (err) {
      console.error('Error creating chat session:', err);
      setError('Failed to create chat session');
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !session || isSending) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: inputMessage.trim(),
      role: 'user',
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsSending(true);

    try {
      // Send message to temporary-chat-handler
      // Note: We need to include the anon key even for public functions due to Supabase gateway requirements
      console.log('Sending message with session token:', session.session_token.substring(0, 8) + '...');
      console.log('Using URL:', `${supabaseUrl.replace('/rest/v1', '')}/functions/v1/temporary-chat-handler`);
      
      const response = await fetch(`${supabaseUrl.replace('/rest/v1', '')}/functions/v1/temporary-chat-handler`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          session_token: session.session_token,
          message: userMessage.content
        })
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const result = await response.json();
      console.log('Chat response structure:', result);

      // The chat function returns the response directly, not nested under data.response
      if (result.success !== false) {
        // Extract the assistant's response from the result
        // The response could be in result.response, result.message, or result itself could be the message
        const responseContent = result.response || result.message || result.content || 
                               (typeof result === 'string' ? result : 'I received your message.');
        
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          content: responseContent,
          role: 'assistant',
          timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (err) {
      console.error('Error sending message:', err);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        content: 'Sorry, I encountered an error. Please try again.',
        role: 'assistant',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Connecting to chat...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Chat Unavailable</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">
            This link may have expired or is no longer active.
          </p>
        </div>
      </div>
    );
  }

  const isExpired = linkData && new Date(linkData.expires_at) < new Date();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <MessageCircle className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{linkData?.title}</h1>
              <p className="text-sm text-gray-500 flex items-center">
                <User className="h-4 w-4 mr-1" />
                Chat with {linkData?.agent_name}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500 flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              {isExpired ? 'Expired' : 'Active'}
            </p>
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <div className="max-w-4xl mx-auto h-[calc(100vh-80px)] flex flex-col">
        {linkData?.description && (
          <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
            <p className="text-blue-800 text-sm">{linkData.description}</p>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-900'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <p
                  className={`text-xs mt-1 ${
                    message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                  }`}
                >
                  {new Date(message.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          
          {isSending && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        {!isExpired && session && (
          <div className="border-t border-gray-200 bg-white p-4">
            <div className="flex space-x-3">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={1}
                disabled={isSending}
              />
              <button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isSending}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Send className="h-4 w-4" />
                <span>Send</span>
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Session: {session.message_count}/{linkData?.max_messages_per_session} messages used
            </p>
          </div>
        )}

        {isExpired && (
          <div className="border-t border-gray-200 bg-gray-50 p-4 text-center">
            <p className="text-gray-500">This chat session has expired.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TempChatPage;
