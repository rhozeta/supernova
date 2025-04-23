-- Function: increment_click_count
-- Increments the click_count for a given short_code in the links table
create or replace function increment_click_count(link_short_code text)
returns void as $$
begin
  update links set click_count = click_count + 1 where short_code = link_short_code;
end;
$$ language plpgsql;
