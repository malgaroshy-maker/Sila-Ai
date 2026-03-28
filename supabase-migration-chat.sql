-- Create chat_sessions table
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'New Conversation',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for user email filtering
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_email ON public.chat_sessions(user_email);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    metadata JSONB, -- For storing suggested actions/metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for session message fetching
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON public.chat_messages(session_id);

-- Enable RLS
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_sessions
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own sessions' AND tablename = 'chat_sessions') THEN
        CREATE POLICY "Users can view their own sessions" ON public.chat_sessions
            FOR SELECT USING (user_email = auth.email());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own sessions' AND tablename = 'chat_sessions') THEN
        CREATE POLICY "Users can insert their own sessions" ON public.chat_sessions
            FOR INSERT WITH CHECK (user_email = auth.email());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own sessions' AND tablename = 'chat_sessions') THEN
        CREATE POLICY "Users can update their own sessions" ON public.chat_sessions
            FOR UPDATE USING (user_email = auth.email());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own sessions' AND tablename = 'chat_sessions') THEN
        CREATE POLICY "Users can delete their own sessions" ON public.chat_sessions
            FOR DELETE USING (user_email = auth.email());
    END IF;
END $$;

-- RLS Policies for chat_messages (via session ownership)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own messages' AND tablename = 'chat_messages') THEN
        CREATE POLICY "Users can view their own messages" ON public.chat_messages
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.chat_sessions 
                    WHERE id = chat_messages.session_id 
                    AND user_email = auth.email()
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own messages' AND tablename = 'chat_messages') THEN
        CREATE POLICY "Users can insert their own messages" ON public.chat_messages
            FOR INSERT WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.chat_sessions 
                    WHERE id = chat_messages.session_id 
                    AND user_email = auth.email()
                )
            );
    END IF;
END $$;
