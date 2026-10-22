-- Create gmail_operation_logs table for tracking Gmail API operations
CREATE TABLE IF NOT EXISTS public.gmail_operation_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    operation_type TEXT NOT NULL,
    operation_params JSONB,
    operation_result JSONB,
    status TEXT NOT NULL CHECK (status IN ('success', 'error', 'unauthorized')),
    error_message TEXT,
    quota_consumed INTEGER DEFAULT 0,
    execution_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_gmail_operation_logs_user_id ON public.gmail_operation_logs(user_id);
CREATE INDEX idx_gmail_operation_logs_agent_id ON public.gmail_operation_logs(agent_id);
CREATE INDEX idx_gmail_operation_logs_created_at ON public.gmail_operation_logs(created_at DESC);
CREATE INDEX idx_gmail_operation_logs_status ON public.gmail_operation_logs(status);

-- Enable RLS
ALTER TABLE public.gmail_operation_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only view their own Gmail operation logs
CREATE POLICY "Users can view own gmail operation logs" ON public.gmail_operation_logs
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Users can insert their own Gmail operation logs
CREATE POLICY "Users can insert own gmail operation logs" ON public.gmail_operation_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Service role can do everything
CREATE POLICY "Service role has full access to gmail operation logs" ON public.gmail_operation_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.gmail_operation_logs TO service_role;
GRANT SELECT, INSERT ON public.gmail_operation_logs TO authenticated; 