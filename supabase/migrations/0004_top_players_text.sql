-- clubs.top_players was typed uuid[] but the app has always treated it as an
-- array of display-name strings (CreateClubModal sends [user.displayName]),
-- so any real club creation with a top player set failed with
-- "invalid input syntax for type uuid" (22P02). Cast existing values to text.
alter table clubs alter column top_players type text[] using top_players::text[];
