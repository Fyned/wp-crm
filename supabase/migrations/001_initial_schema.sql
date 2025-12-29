-- =====================================================
-- Corporate WhatsApp CRM - Database Schema
-- Hierarchical RBAC with Row Level Security
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. ENUMS
-- =====================================================

CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'team_member');
CREATE TYPE session_status AS ENUM ('DISCONNECTED', 'CONNECTING', 'CONNECTED', 'FAILED');
CREATE TYPE message_type AS ENUM ('text', 'image', 'video', 'audio', 'document', 'sticker', 'location', 'contact', 'voice');
CREATE TYPE message_ack AS ENUM ('PENDING', 'SERVER', 'DEVICE', 'READ', 'PLAYED');

-- =====================================================
-- 2. PROFILES TABLE
-- Custom user profiles with hierarchical structure
-- =====================================================

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role user_role NOT NULL DEFAULT 'team_member',

    -- Hierarchical ownership
    created_by_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Metadata
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT username_length CHECK (char_length(username) >= 3),
    CONSTRAINT hierarchy_check CHECK (
        (role = 'super_admin' AND created_by_admin_id IS NULL) OR
        (role = 'admin' AND created_by_admin_id IS NOT NULL) OR
        (role = 'team_member' AND created_by_admin_id IS NOT NULL)
    )
);

-- Indexes for performance
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_created_by ON profiles(created_by_admin_id);
CREATE INDEX idx_profiles_username ON profiles(username);

-- =====================================================
-- 3. TEAMS TABLE
-- =====================================================

CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,

    -- Ownership
    created_by_admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Metadata
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT team_name_length CHECK (char_length(name) >= 2)
);

CREATE INDEX idx_teams_created_by ON teams(created_by_admin_id);
CREATE INDEX idx_teams_active ON teams(is_active) WHERE is_active = TRUE;

-- =====================================================
-- 4. TEAM MEMBERS (Many-to-Many)
-- =====================================================

CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Metadata
    joined_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent duplicate memberships
    UNIQUE(team_id, user_id)
);

CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);

-- =====================================================
-- 5. SESSIONS TABLE
-- WhatsApp session management
-- =====================================================

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- WAHA session identifier
    session_name TEXT UNIQUE NOT NULL,
    phone_number TEXT,

    -- Status
    status session_status DEFAULT 'DISCONNECTED',

    -- Metadata
    waha_metadata JSONB DEFAULT '{}'::jsonb,
    last_connected_at TIMESTAMPTZ,
    last_message_timestamp TIMESTAMPTZ,

    -- Ownership
    created_by_admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT session_name_format CHECK (session_name ~ '^[a-zA-Z0-9_-]+$')
);

CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_created_by ON sessions(created_by_admin_id);
CREATE INDEX idx_sessions_session_name ON sessions(session_name);
CREATE INDEX idx_sessions_last_message ON sessions(last_message_timestamp DESC);

-- =====================================================
-- 6. SESSION ASSIGNMENTS
-- Assign sessions to users or teams
-- =====================================================

CREATE TABLE session_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,

    -- Either user OR team (not both)
    assigned_to_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    assigned_to_team_id UUID REFERENCES teams(id) ON DELETE CASCADE,

    -- Metadata
    assigned_by_admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraint: Must assign to user OR team, not both
    CONSTRAINT assignment_target CHECK (
        (assigned_to_user_id IS NOT NULL AND assigned_to_team_id IS NULL) OR
        (assigned_to_user_id IS NULL AND assigned_to_team_id IS NOT NULL)
    ),

    -- Prevent duplicate assignments
    UNIQUE(session_id, assigned_to_user_id),
    UNIQUE(session_id, assigned_to_team_id)
);

CREATE INDEX idx_session_assignments_session ON session_assignments(session_id);
CREATE INDEX idx_session_assignments_user ON session_assignments(assigned_to_user_id);
CREATE INDEX idx_session_assignments_team ON session_assignments(assigned_to_team_id);

-- =====================================================
-- 7. CONTACTS TABLE
-- Contact information for each session
-- =====================================================

CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,

    -- Contact identifiers
    phone_number TEXT NOT NULL,
    name TEXT,
    is_group BOOLEAN DEFAULT FALSE,

    -- Profile info
    profile_pic_url TEXT,

    -- Metadata from WhatsApp
    whatsapp_metadata JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique contact per session
    UNIQUE(session_id, phone_number)
);

CREATE INDEX idx_contacts_session ON contacts(session_id);
CREATE INDEX idx_contacts_phone ON contacts(phone_number);
CREATE INDEX idx_contacts_name ON contacts(name);

-- =====================================================
-- 8. MESSAGES TABLE
-- Full message archive with media support
-- =====================================================

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Session & Contact
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

    -- Message identifiers
    waha_message_id TEXT NOT NULL,

    -- Message content
    message_type message_type NOT NULL DEFAULT 'text',
    body TEXT,

    -- Direction
    from_me BOOLEAN NOT NULL,

    -- Status
    ack message_ack DEFAULT 'PENDING',

    -- Media
    has_media BOOLEAN DEFAULT FALSE,
    media_url TEXT,
    media_mimetype TEXT,
    media_size BIGINT,
    media_filename TEXT,

    -- Quoted message
    quoted_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,

    -- Raw data from WAHA
    raw_payload JSONB,

    -- Timestamps
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique message per session
    UNIQUE(session_id, waha_message_id)
);

CREATE INDEX idx_messages_session ON messages(session_id);
CREATE INDEX idx_messages_contact ON messages(contact_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX idx_messages_from_me ON messages(from_me);
CREATE INDEX idx_messages_waha_id ON messages(waha_message_id);
CREATE INDEX idx_messages_has_media ON messages(has_media) WHERE has_media = TRUE;

-- =====================================================
-- 9. MEDIA FILES TABLE
-- Separate table for media file storage tracking
-- =====================================================

CREATE TABLE media_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,

    -- Supabase Storage reference
    storage_bucket TEXT NOT NULL DEFAULT 'whatsapp-media',
    storage_path TEXT NOT NULL,

    -- File info
    filename TEXT NOT NULL,
    mimetype TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,

    -- Processing status
    uploaded BOOLEAN DEFAULT FALSE,
    upload_error TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(storage_bucket, storage_path)
);

CREATE INDEX idx_media_files_message ON media_files(message_id);
CREATE INDEX idx_media_files_uploaded ON media_files(uploaded);

-- =====================================================
-- 10. SYNC LOGS TABLE
-- Track synchronization operations
-- =====================================================

CREATE TABLE sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,

    -- Sync details
    sync_type TEXT NOT NULL, -- 'initial', 'gap_fill', 'manual'
    messages_synced INTEGER DEFAULT 0,

    -- Time range
    from_timestamp TIMESTAMPTZ,
    to_timestamp TIMESTAMPTZ,

    -- Status
    status TEXT NOT NULL, -- 'started', 'completed', 'failed'
    error_message TEXT,

    -- Timestamps
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_sync_logs_session ON sync_logs(session_id);
CREATE INDEX idx_sync_logs_started ON sync_logs(started_at DESC);

-- =====================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Check if user can access a session
CREATE OR REPLACE FUNCTION user_can_access_session(session_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_role_val user_role;
BEGIN
    SELECT role INTO user_role_val FROM profiles WHERE id = user_uuid;

    -- Super Admin can access all
    IF user_role_val = 'super_admin' THEN
        RETURN TRUE;
    END IF;

    -- Check direct assignment or team membership
    RETURN EXISTS (
        SELECT 1 FROM session_assignments sa
        WHERE sa.session_id = session_uuid
        AND (
            sa.assigned_to_user_id = user_uuid
            OR sa.assigned_to_team_id IN (
                SELECT team_id FROM team_members WHERE user_id = user_uuid
            )
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's admin hierarchy
CREATE OR REPLACE FUNCTION get_admin_hierarchy(user_uuid UUID)
RETURNS TABLE(user_id UUID) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE hierarchy AS (
        -- Base case: the user themselves
        SELECT id FROM profiles WHERE id = user_uuid

        UNION

        -- Recursive case: users created by this admin
        SELECT p.id
        FROM profiles p
        INNER JOIN hierarchy h ON p.created_by_admin_id = h.user_id
    )
    SELECT * FROM hierarchy;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
