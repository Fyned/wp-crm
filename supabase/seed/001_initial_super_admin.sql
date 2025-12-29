-- =====================================================
-- Initial Super Admin Setup
-- Run this AFTER deploying migrations
-- =====================================================

-- NOTE: In production, create super admin via Supabase Dashboard
-- This is for development/testing purposes only

-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard -> Authentication -> Users
-- 2. Click "Add user" manually
-- 3. Set email: superadmin@system.local
-- 4. Set password: (your secure password)
-- 5. In user metadata, add:
--    {
--      "username": "superadmin",
--      "role": "super_admin"
--    }
-- 6. The trigger will auto-create the profile

-- For CLI setup (development only):
/*
INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    role,
    aud,
    created_at,
    updated_at
)
VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'superadmin@system.local',
    crypt('CHANGE_THIS_PASSWORD', gen_salt('bf')),
    NOW(),
    jsonb_build_object(
        'username', 'superadmin',
        'role', 'super_admin'
    ),
    'authenticated',
    'authenticated',
    NOW(),
    NOW()
)
ON CONFLICT (email) DO NOTHING;
*/

-- Verify super admin profile was created
-- SELECT * FROM profiles WHERE role = 'super_admin';
