import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.2'
import webpush from 'https://esm.sh/web-push@3.6.7'

Deno.serve(async (req) => {
  try {
    // 1. Setup Supabase System Client (Using Service Role Key)
    // We do NOT pass the user's Authorization header here so we can bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Setup Web Push with VAPID keys from secrets
    webpush.setVapidDetails(
      'mailto:support@edutrackug.com',
      Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
      Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
    )

    const payload = await req.json()
    const { record, table } = payload

    console.log(`Push Node Triggered: ${table} | Record: ${record.id}`)

    let title = ''
    let body = ''
    let url = '/parent'
    let targetPhone = ''

    // 1. Identify Target Parent and Child
    if (table === 'attendance') {
      const { data: student } = await supabase
        .from('students')
        .select('full_name, parent_phone')
        .eq('id', record.student_id)
        .single()

      if (!student) throw new Error('Student not found')

      title = 'Attendance Update'
      body = `${student.full_name} has been marked ${record.status} today.`
      targetPhone = student.parent_phone
    } else if (table === 'student_marks') {
      const { data: student } = await supabase
        .from('students')
        .select('full_name, parent_phone')
        .eq('id', record.student_id)
        .single()

      if (!student) throw new Error('Student not found')

      const { data: subject } = await supabase
        .from('subjects')
        .select('name')
        .eq('id', record.subject_id)
        .single()

      title = 'New Marks Submitted'
      body = `${student.full_name} scored ${record.marks}/${record.max_marks} in ${subject.name}.`
      targetPhone = student.parent_phone
    }

    if (!targetPhone) {
      console.log('No target phone found for this record')
      return new Response(JSON.stringify({ message: 'No target parent found' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      })
    }

    // 2. Find parent's push subscriptions (using phone number node)
    const { data: parent } = await supabase
      .from('users')
      .select('id')
      .eq('phone_number', targetPhone)
      .eq('role', 'parent')
      .single()

    if (!parent) {
      console.log(`Parent user with phone ${targetPhone} not found in system`)
      return new Response(JSON.stringify({ message: 'Parent user not found' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      })
    }

    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', parent.id)

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`No active push subscriptions found for parent ${parent.id}`)
      return new Response(JSON.stringify({ message: 'No push subscriptions found' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      })
    }

    console.log(`Sending ${subscriptions.length} pings to parent node...`)

    // 3. Send Push Notifications
    const pushPromises = subscriptions.map(sub => 
      webpush.sendNotification(
        sub.subscription,
        JSON.stringify({ title, body, url })
      ).catch(err => {
        console.error('Ping Failure:', err)
        // Cleanup expired subscriptions would go here
      })
    )

    await Promise.all(pushPromises)

    return new Response(JSON.stringify({ success: true, pings: subscriptions.length }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Edge Function Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
