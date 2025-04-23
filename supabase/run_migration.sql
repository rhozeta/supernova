-- Run this script in the Supabase SQL Editor to create the link_clicks table and related functions

-- Create a new table to track individual link clicks
CREATE TABLE IF NOT EXISTS public.link_clicks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  link_id UUID NOT NULL REFERENCES public.links(id) ON DELETE CASCADE,
  clicked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  referrer TEXT,
  user_agent TEXT,
  ip_address TEXT,
  country TEXT
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS link_clicks_link_id_idx ON public.link_clicks(link_id);
CREATE INDEX IF NOT EXISTS link_clicks_clicked_at_idx ON public.link_clicks(clicked_at);

-- Add a function to increment a counter atomically
CREATE OR REPLACE FUNCTION public.increment_counter(row_id UUID)
RETURNS INTEGER AS $$
DECLARE
  current_count INTEGER;
BEGIN
  SELECT click_count INTO current_count FROM public.links WHERE id = row_id;
  IF current_count IS NULL THEN
    current_count := 0;
  END IF;
  RETURN current_count + 1;
END;
$$ LANGUAGE plpgsql;

-- Add a function to update the click_count in the links table
CREATE OR REPLACE FUNCTION public.update_link_click_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.links
  SET click_count = (SELECT COUNT(*) FROM public.link_clicks WHERE link_id = NEW.link_id)
  WHERE id = NEW.link_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update click_count when a new click is recorded
DROP TRIGGER IF EXISTS update_link_click_count_trigger ON public.link_clicks;
CREATE TRIGGER update_link_click_count_trigger
AFTER INSERT ON public.link_clicks
FOR EACH ROW
EXECUTE FUNCTION public.update_link_click_count();

-- Add a function to handle link clicks
CREATE OR REPLACE FUNCTION public.handle_link_click(link_short_code TEXT)
RETURNS void AS $$
DECLARE
  link_id UUID;
BEGIN
  -- Get the link ID
  SELECT id INTO link_id FROM public.links WHERE short_code = link_short_code;
  
  -- Insert into link_clicks
  IF link_id IS NOT NULL THEN
    INSERT INTO public.link_clicks (link_id, clicked_at) 
    VALUES (link_id, NOW());
  END IF;
END;
$$ LANGUAGE plpgsql;
