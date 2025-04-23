-- Add metadata fields to the links table
ALTER TABLE public.links 
ADD COLUMN IF NOT EXISTS page_title TEXT,
ADD COLUMN IF NOT EXISTS page_description TEXT,
ADD COLUMN IF NOT EXISTS page_image TEXT,
ADD COLUMN IF NOT EXISTS page_favicon TEXT;

-- Create a function to fetch metadata for existing links
CREATE OR REPLACE FUNCTION public.update_link_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update metadata if it's not already set
  IF NEW.page_title IS NULL OR NEW.page_title = '' THEN
    -- We can't actually fetch metadata here in the database
    -- This is just a placeholder - the actual fetching will be done in the application
    NEW.page_title := 'Pending...';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to update metadata when a link is created
DROP TRIGGER IF EXISTS update_link_metadata_trigger ON public.links;
CREATE TRIGGER update_link_metadata_trigger
BEFORE INSERT ON public.links
FOR EACH ROW
EXECUTE FUNCTION public.update_link_metadata();
