# Push Notifications Setup Guide

## Step 1: Generate VAPID Keys

First, install web-push globally:
```bash
npm install -g web-push
```

Then generate keys:
```bash
web-push generate-vapid-keys
```

Save the output, we'll need them!

## Step 2: Configure Environment Variables

Create or update your `.env` and `.env.local` files:

### For Frontend (.env.local)
```env
VITE_VAPID_PUBLIC_KEY=YOUR_VAPID_PUBLIC_KEY
```

### For Supabase (Dashboard > Settings > Secrets)
Add these secrets:
- `VAPID_PUBLIC_KEY`: Your public key from step 1
- `VAPID_PRIVATE_KEY`: Your private key from step 1

## Step 3: Deploy Edge Function
You already have it! But let's deploy:
```bash
supabase functions deploy push-notifications
```

## Step 4: Create Database Triggers
We need to create triggers in Supabase to fire the edge function!
- When attendance is marked
- When marks are published
- When documents are added
```sql
-- Create trigger for attendance
create trigger send_attendance_push_notification
after insert on attendance
for each row
execute function edge_functions.fire_function('push-notifications');

-- Create trigger for marks
create trigger send_marks_push_notification
after insert on student_marks
for each row
when (new.is_published = true)
execute function edge_functions.fire_function('push-notifications');

-- Create trigger for documents
create trigger send_document_push_notification
after insert on school_documents
for each row
execute function edge_functions.fire_function('push-notifications');
```

## Step 5: Add Toggle to your dashboards!
Add the PushNotificationToggle component to your Parent and Teacher dashboards!

## How It Works!
1. User opts-in to notifications
2. Subscription is saved in push_subscriptions table
3. Database triggers fire when changes
4. Edge function sends push notifications
5. Phones vibrate/notify even when asleep!
