-- =====================================================
-- Row Level Security (RLS) Policies
-- Implements Hierarchical RBAC
-- =====================================================

-- =====================================================
-- 1. PROFILES TABLE RLS
-- =====================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Super Admin: See everyone
CREATE POLICY "Super admins can view all profiles"
    ON profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Admin: See only their created users + themselves
CREATE POLICY "Admins can view their created users"
    ON profiles FOR SELECT
    USING (
        id = auth.uid() -- Can see themselves
        OR
        created_by_admin_id = auth.uid() -- Can see users they created
        OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- User: Can only see themselves
CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    USING (id = auth.uid());

-- Super Admin: Create admins
CREATE POLICY "Super admins can create admins"
    ON profiles FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Admin: Create team members
CREATE POLICY "Admins can create team members"
    ON profiles FOR INSERT
    WITH CHECK (
        created_by_admin_id = auth.uid()
        AND role = 'team_member'
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
        )
    );

-- Update own profile
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid() AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

-- Admin: Update created users
CREATE POLICY "Admins can update their created users"
    ON profiles FOR UPDATE
    USING (
        created_by_admin_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Delete (only super admin or creating admin)
CREATE POLICY "Admins can delete their created users"
    ON profiles FOR DELETE
    USING (
        created_by_admin_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- =====================================================
-- 2. TEAMS TABLE RLS
-- =====================================================

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Super Admin: See all teams
CREATE POLICY "Super admins can view all teams"
    ON teams FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Admin: See only their teams
CREATE POLICY "Admins can view their teams"
    ON teams FOR SELECT
    USING (
        created_by_admin_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Team Member: See teams they belong to
CREATE POLICY "Team members can view their teams"
    ON teams FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM team_members
            WHERE team_id = teams.id AND user_id = auth.uid()
        )
    );

-- Create teams (Admin and Super Admin only)
CREATE POLICY "Admins can create teams"
    ON teams FOR INSERT
    WITH CHECK (
        created_by_admin_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
        )
    );

-- Update own teams
CREATE POLICY "Admins can update their teams"
    ON teams FOR UPDATE
    USING (
        created_by_admin_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Delete own teams
CREATE POLICY "Admins can delete their teams"
    ON teams FOR DELETE
    USING (
        created_by_admin_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- =====================================================
-- 3. TEAM MEMBERS TABLE RLS
-- =====================================================

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- View: Admin can see their team members, users can see their memberships
CREATE POLICY "View team memberships"
    ON team_members FOR SELECT
    USING (
        user_id = auth.uid() -- Can see own memberships
        OR
        EXISTS ( -- Admin can see their team's members
            SELECT 1 FROM teams
            WHERE teams.id = team_members.team_id
            AND teams.created_by_admin_id = auth.uid()
        )
        OR
        EXISTS ( -- Super admin sees all
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Insert: Only admins can add members to their teams
CREATE POLICY "Admins can add team members"
    ON team_members FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM teams
            WHERE teams.id = team_members.team_id
            AND teams.created_by_admin_id = auth.uid()
        )
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = team_members.user_id
            AND created_by_admin_id = auth.uid() -- Can only add users they created
        )
    );

-- Delete: Admin can remove members from their teams
CREATE POLICY "Admins can remove team members"
    ON team_members FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM teams
            WHERE teams.id = team_members.team_id
            AND teams.created_by_admin_id = auth.uid()
        )
    );

-- =====================================================
-- 4. SESSIONS TABLE RLS
-- =====================================================

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Super Admin: See all sessions
CREATE POLICY "Super admins can view all sessions"
    ON sessions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Admin: See sessions they created
CREATE POLICY "Admins can view their sessions"
    ON sessions FOR SELECT
    USING (
        created_by_admin_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Team Member: See assigned sessions
CREATE POLICY "Users can view assigned sessions"
    ON sessions FOR SELECT
    USING (
        user_can_access_session(id, auth.uid())
    );

-- Create sessions (Admin and Super Admin only)
CREATE POLICY "Admins can create sessions"
    ON sessions FOR INSERT
    WITH CHECK (
        created_by_admin_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
        )
    );

-- Update sessions
CREATE POLICY "Admins can update their sessions"
    ON sessions FOR UPDATE
    USING (
        created_by_admin_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Delete sessions
CREATE POLICY "Admins can delete their sessions"
    ON sessions FOR DELETE
    USING (
        created_by_admin_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- =====================================================
-- 5. SESSION ASSIGNMENTS TABLE RLS
-- =====================================================

ALTER TABLE session_assignments ENABLE ROW LEVEL SECURITY;

-- View assignments
CREATE POLICY "View session assignments"
    ON session_assignments FOR SELECT
    USING (
        assigned_to_user_id = auth.uid() -- Can see own assignments
        OR
        EXISTS ( -- Admin can see their session assignments
            SELECT 1 FROM sessions
            WHERE sessions.id = session_assignments.session_id
            AND sessions.created_by_admin_id = auth.uid()
        )
        OR
        EXISTS ( -- Super admin sees all
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Create assignments (Admin only, for their sessions)
CREATE POLICY "Admins can assign their sessions"
    ON session_assignments FOR INSERT
    WITH CHECK (
        assigned_by_admin_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM sessions
            WHERE sessions.id = session_assignments.session_id
            AND sessions.created_by_admin_id = auth.uid()
        )
    );

-- Delete assignments
CREATE POLICY "Admins can remove assignments"
    ON session_assignments FOR DELETE
    USING (
        assigned_by_admin_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM sessions
            WHERE sessions.id = session_assignments.session_id
            AND sessions.created_by_admin_id = auth.uid()
        )
    );

-- =====================================================
-- 6. CONTACTS TABLE RLS
-- =====================================================

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- View contacts for accessible sessions
CREATE POLICY "View contacts for accessible sessions"
    ON contacts FOR SELECT
    USING (
        user_can_access_session(session_id, auth.uid())
    );

-- System can insert contacts
CREATE POLICY "System can insert contacts"
    ON contacts FOR INSERT
    WITH CHECK (
        user_can_access_session(session_id, auth.uid())
    );

-- Update contacts
CREATE POLICY "Update contacts for accessible sessions"
    ON contacts FOR UPDATE
    USING (
        user_can_access_session(session_id, auth.uid())
    );

-- =====================================================
-- 7. MESSAGES TABLE RLS
-- =====================================================

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- View messages for accessible sessions
CREATE POLICY "View messages for accessible sessions"
    ON messages FOR SELECT
    USING (
        user_can_access_session(session_id, auth.uid())
    );

-- Insert messages (webhook or authorized users)
CREATE POLICY "Insert messages for accessible sessions"
    ON messages FOR INSERT
    WITH CHECK (
        user_can_access_session(session_id, auth.uid())
    );

-- Update message ack status
CREATE POLICY "Update message ack for accessible sessions"
    ON messages FOR UPDATE
    USING (
        user_can_access_session(session_id, auth.uid())
    );

-- =====================================================
-- 8. MEDIA FILES TABLE RLS
-- =====================================================

ALTER TABLE media_files ENABLE ROW LEVEL SECURITY;

-- View media for accessible messages
CREATE POLICY "View media for accessible messages"
    ON media_files FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM messages
            WHERE messages.id = media_files.message_id
            AND user_can_access_session(messages.session_id, auth.uid())
        )
    );

-- Insert media
CREATE POLICY "Insert media for accessible messages"
    ON media_files FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM messages
            WHERE messages.id = media_files.message_id
            AND user_can_access_session(messages.session_id, auth.uid())
        )
    );

-- Update media upload status
CREATE POLICY "Update media for accessible messages"
    ON media_files FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM messages
            WHERE messages.id = media_files.message_id
            AND user_can_access_session(messages.session_id, auth.uid())
        )
    );

-- =====================================================
-- 9. SYNC LOGS TABLE RLS
-- =====================================================

ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- View sync logs for accessible sessions
CREATE POLICY "View sync logs for accessible sessions"
    ON sync_logs FOR SELECT
    USING (
        user_can_access_session(session_id, auth.uid())
    );

-- Insert sync logs
CREATE POLICY "Insert sync logs for accessible sessions"
    ON sync_logs FOR INSERT
    WITH CHECK (
        user_can_access_session(session_id, auth.uid())
    );

-- Update sync logs
CREATE POLICY "Update sync logs for accessible sessions"
    ON sync_logs FOR UPDATE
    USING (
        user_can_access_session(session_id, auth.uid())
    );

-- =====================================================
-- STORAGE POLICIES (Supabase Storage)
-- =====================================================

-- Create storage bucket for WhatsApp media
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Users can only access media for their sessions
CREATE POLICY "Users can view media for their sessions"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'whatsapp-media'
        AND EXISTS (
            SELECT 1 FROM media_files mf
            JOIN messages m ON m.id = mf.message_id
            WHERE mf.storage_path = name
            AND user_can_access_session(m.session_id, auth.uid())
        )
    );

CREATE POLICY "System can upload media"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'whatsapp-media'
        AND auth.role() = 'authenticated'
    );
