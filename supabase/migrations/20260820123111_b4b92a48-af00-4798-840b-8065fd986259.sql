CREATE TABLE public.ev_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL UNIQUE,
  user_name TEXT,
  memory_facts TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.ev_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.ev_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  expression TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ev_messages_session_created_idx ON public.ev_messages (session_id, created_at);

GRANT ALL ON public.ev_sessions TO service_role;
GRANT ALL ON public.ev_messages TO service_role;

ALTER TABLE public.ev_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ev_messages ENABLE ROW LEVEL SECURITY;