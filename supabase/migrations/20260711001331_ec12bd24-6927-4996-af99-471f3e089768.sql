
-- Restrict Realtime channel subscriptions so authenticated users can only
-- subscribe to topics scoped to their own user id. Prevents cross-user
-- notification eavesdropping via broadcast/presence/postgres_changes topics.

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth users receive only own notification topics" ON realtime.messages;

CREATE POLICY "auth users receive only own notification topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND realtime.topic() LIKE 'notifications:' || auth.uid()::text || ':%'
);

DROP POLICY IF EXISTS "no anon realtime subscriptions" ON realtime.messages;
