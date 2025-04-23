-- Add metadata columns to the links table
ALTER TABLE public.links 
ADD COLUMN IF NOT EXISTS page_title TEXT,
ADD COLUMN IF NOT EXISTS page_description TEXT,
ADD COLUMN IF NOT EXISTS page_image TEXT,
ADD COLUMN IF NOT EXISTS page_favicon TEXT;
