-- Create helper function to get earned qubits
CREATE OR REPLACE FUNCTION get_earned_qubits(user_id UUID, creator_id UUID)
RETURNS INTEGER AS $$
DECLARE
    earned INTEGER;
BEGIN
    SELECT COALESCE(SUM(lr.click_count), 0) INTO earned
    FROM public.link_refs lr
    JOIN public.links l ON l.id = lr.original_link_id
    WHERE lr.user_id = $1
    AND l.user_id = $2;
    
    RETURN earned;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing RLS policy for reward claims
DROP POLICY IF EXISTS "Users can claim rewards" ON public.reward_claims;

-- Create updated RLS policy for claiming rewards with detailed checks
CREATE POLICY "Users can claim rewards" ON public.reward_claims
    FOR INSERT
    WITH CHECK (
        -- User can only claim their own rewards
        (
            auth.uid() = user_id
            AND
            -- Log the check
            (
                SELECT true
                FROM (SELECT auth.uid() as auth_id) t
                WHERE t.auth_id = user_id
            )
        )
        AND
        -- Check if reward exists and is active
        (
            EXISTS (
                SELECT 1 FROM public.rewards r
                WHERE r.id = reward_id
                AND r.active = true
                AND r.creator_id = creator_id
            )
        )
        AND
        -- Check if user has enough qubits earned from this creator
        (
            get_earned_qubits(auth.uid(), creator_id) >= (
                SELECT qubit_cost FROM public.rewards r
                WHERE r.id = reward_id
            )
        )
    );

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_earned_qubits TO authenticated;
