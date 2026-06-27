-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add endpoint column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'push_subscriptions' 
                 AND column_name = 'endpoint') THEN
    ALTER TABLE push_subscriptions 
    ADD COLUMN endpoint TEXT GENERATED ALWAYS AS (subscription->>'endpoint') STORED;
  END IF;
END
$$;

-- Create unique index if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_subscription
  ON push_subscriptions(user_id, endpoint);

-- Enable RLS if not already enabled
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables 
                 WHERE tablename = 'push_subscriptions' 
                 AND rowsecurity = true) THEN
    ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
  END IF;
END
$$;

-- Create policies only if they don't exist
DO $$
BEGIN
  -- Policy for users to manage their own subscriptions
  IF NOT EXISTS (SELECT 1 FROM pg_policies 
                 WHERE tablename = 'push_subscriptions' 
                 AND policyname = 'Users can manage their own push subscriptions') THEN
    CREATE POLICY "Users can manage their own push subscriptions"
      ON push_subscriptions
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Policy for service role to view all
  IF NOT EXISTS (SELECT 1 FROM pg_policies 
                 WHERE tablename = 'push_subscriptions' 
                 AND policyname = 'Service role can view all subscriptions') THEN
    CREATE POLICY "Service role can view all subscriptions"
      ON push_subscriptions
      FOR SELECT
      USING (true);
  END IF;
END
$$;
