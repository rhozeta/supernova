-- Add qubits column to profiles table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'profiles' 
                  AND column_name = 'qubits') THEN
        ALTER TABLE public.profiles
        ADD COLUMN qubits INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Create updated_at function if it doesn't exist
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create rewards table
CREATE TABLE IF NOT EXISTS public.rewards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    qubit_cost INTEGER NOT NULL CHECK (qubit_cost > 0),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add RLS policies
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

-- Allow creators to view all rewards
CREATE POLICY "Anyone can view active rewards" ON public.rewards
    FOR SELECT
    USING (active = true);

-- Allow creators to manage their own rewards
CREATE POLICY "Creators can manage their own rewards" ON public.rewards
    FOR ALL
    USING (auth.uid() = creator_id);

-- Add updated_at trigger
CREATE TRIGGER set_rewards_updated_at
    BEFORE UPDATE ON public.rewards
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Create reward claims table for tracking claimed rewards
CREATE TABLE IF NOT EXISTS public.reward_claims (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reward_id UUID NOT NULL REFERENCES public.rewards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'fulfilled', 'cancelled')),
    UNIQUE(reward_id, user_id)
);

-- Add RLS policies for reward claims
ALTER TABLE public.reward_claims ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own claims
CREATE POLICY "Users can view their own claims" ON public.reward_claims
    FOR SELECT
    USING (auth.uid() = user_id);

-- Allow users to create claims for active rewards if they have enough qubits
CREATE POLICY "Users can claim rewards" ON public.reward_claims
    FOR INSERT
    WITH CHECK (
        -- Check if reward exists and is active
        EXISTS (
            SELECT 1 FROM public.rewards r
            WHERE r.id = reward_id
            AND r.active = true
        )
        -- Check if user has enough qubits earned from this creator's links
        AND EXISTS (
            SELECT 1
            FROM (
                SELECT COALESCE(SUM(lr.click_count), 0) as earned_qubits
                FROM public.link_refs lr
                JOIN public.links l ON l.id = lr.original_link_id
                WHERE lr.user_id = auth.uid()
                AND l.user_id = (
                    SELECT creator_id FROM public.rewards
                    WHERE id = reward_id
                )
            ) q
            WHERE q.earned_qubits >= (
                SELECT qubit_cost FROM public.rewards r
                WHERE r.id = reward_id
            )
        )
    );

-- Allow creators to update claims for their rewards
CREATE POLICY "Creators can update claims for their rewards" ON public.reward_claims
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.rewards r
            WHERE r.id = reward_claims.reward_id
            AND r.creator_id = auth.uid()
        )
    );

-- Grant necessary permissions
GRANT ALL ON public.rewards TO authenticated;
GRANT ALL ON public.reward_claims TO authenticated;
