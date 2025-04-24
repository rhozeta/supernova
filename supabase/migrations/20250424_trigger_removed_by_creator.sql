-- Trigger to set removed_by_creator=true in link_refs when a link is archived by its creator
CREATE OR REPLACE FUNCTION set_removed_by_creator()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted = TRUE THEN
    UPDATE link_refs
    SET removed_by_creator = TRUE
    WHERE original_link_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_removed_by_creator ON links;
CREATE TRIGGER trg_set_removed_by_creator
AFTER UPDATE OF deleted ON links
FOR EACH ROW
WHEN (NEW.deleted = TRUE AND OLD.deleted IS DISTINCT FROM NEW.deleted)
EXECUTE FUNCTION set_removed_by_creator();

-- Optional: Also handle restore (set removed_by_creator=false if link is unarchived)
CREATE OR REPLACE FUNCTION unset_removed_by_creator()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted = FALSE THEN
    UPDATE link_refs
    SET removed_by_creator = FALSE
    WHERE original_link_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_unset_removed_by_creator ON links;
CREATE TRIGGER trg_unset_removed_by_creator
AFTER UPDATE OF deleted ON links
FOR EACH ROW
WHEN (NEW.deleted = FALSE AND OLD.deleted IS DISTINCT FROM NEW.deleted)
EXECUTE FUNCTION unset_removed_by_creator();
