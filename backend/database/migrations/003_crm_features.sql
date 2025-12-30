-- Migration: CRM Features (Notes, Labels, Assignments, Media)
-- Description: Adds professional CRM features for WhatsApp management

-- =====================================================
-- 1. SESSION METADATA (Custom names, notes, labels)
-- =====================================================
CREATE TABLE IF NOT EXISTS session_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  custom_label VARCHAR(255), -- User-defined session name
  notes TEXT, -- Admin notes about this session
  tags TEXT[] DEFAULT '{}', -- Tags for organization
  color VARCHAR(7) DEFAULT '#10B981', -- Color code for UI
  is_favorite BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id)
);

CREATE INDEX idx_session_metadata_session_id ON session_metadata(session_id);
CREATE INDEX idx_session_metadata_tags ON session_metadata USING GIN(tags);

-- =====================================================
-- 2. CONTACT METADATA (Custom names, notes, labels)
-- =====================================================
CREATE TABLE IF NOT EXISTS contact_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  custom_name VARCHAR(255), -- User-defined contact name (local only)
  notes TEXT, -- Notes about this contact
  tags TEXT[] DEFAULT '{}', -- Tags for organization
  importance VARCHAR(20) DEFAULT 'normal', -- 'high', 'normal', 'low'
  last_note_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contact_id, session_id)
);

CREATE INDEX idx_contact_metadata_contact_id ON contact_metadata(contact_id);
CREATE INDEX idx_contact_metadata_session_id ON contact_metadata(session_id);
CREATE INDEX idx_contact_metadata_tags ON contact_metadata USING GIN(tags);
CREATE INDEX idx_contact_metadata_importance ON contact_metadata(importance);

-- =====================================================
-- 3. CHAT ASSIGNMENTS (Multi-user access control)
-- =====================================================
CREATE TABLE IF NOT EXISTS chat_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  assigned_to_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_to_team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  assigned_by_admin_id UUID NOT NULL REFERENCES profiles(id),
  permissions JSONB DEFAULT '{"can_view": true, "can_send": true, "can_manage": false}',
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Optional: assignment expiration
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(contact_id, assigned_to_user_id),
  CHECK (assigned_to_user_id IS NOT NULL OR assigned_to_team_id IS NOT NULL)
);

CREATE INDEX idx_chat_assignments_contact_id ON chat_assignments(contact_id);
CREATE INDEX idx_chat_assignments_user_id ON chat_assignments(assigned_to_user_id);
CREATE INDEX idx_chat_assignments_team_id ON chat_assignments(assigned_to_team_id);
CREATE INDEX idx_chat_assignments_active ON chat_assignments(is_active);

-- =====================================================
-- 4. MESSAGE MEDIA (Images, Videos, Documents)
-- =====================================================
CREATE TABLE IF NOT EXISTS message_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  media_type VARCHAR(50) NOT NULL, -- 'image', 'video', 'audio', 'document', 'sticker'
  file_url TEXT, -- Supabase storage URL or Evolution API URL
  file_name VARCHAR(255),
  file_size BIGINT, -- in bytes
  mime_type VARCHAR(100),
  thumbnail_url TEXT, -- For videos and images
  width INTEGER, -- For images/videos
  height INTEGER, -- For images/videos
  duration INTEGER, -- For audio/video (in seconds)
  download_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'downloading', 'completed', 'failed'
  storage_path TEXT, -- Path in Supabase storage
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_message_media_message_id ON message_media(message_id);
CREATE INDEX idx_message_media_type ON message_media(media_type);
CREATE INDEX idx_message_media_status ON message_media(download_status);

-- =====================================================
-- 5. SYNC STATE (Track message synchronization)
-- =====================================================
CREATE TABLE IF NOT EXISTS sync_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  last_synced_at TIMESTAMPTZ,
  last_message_timestamp BIGINT, -- Unix timestamp of last synced message
  sync_status VARCHAR(50) DEFAULT 'idle', -- 'idle', 'syncing', 'completed', 'failed'
  sync_type VARCHAR(50), -- 'initial', 'gap_fill', 'continuous'
  total_chats_synced INTEGER DEFAULT 0,
  total_messages_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id)
);

CREATE INDEX idx_sync_state_session_id ON sync_state(session_id);
CREATE INDEX idx_sync_state_status ON sync_state(sync_status);

-- =====================================================
-- 6. CHAT GROUPS (For organizing chats)
-- =====================================================
CREATE TABLE IF NOT EXISTS chat_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES profiles(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#3B82F6',
  icon VARCHAR(50), -- Emoji or icon name
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_groups_session_id ON chat_groups(session_id);
CREATE INDEX idx_chat_groups_user_id ON chat_groups(created_by_user_id);

-- =====================================================
-- 7. CHAT GROUP MEMBERS (Many-to-many)
-- =====================================================
CREATE TABLE IF NOT EXISTS chat_group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, contact_id)
);

CREATE INDEX idx_chat_group_members_group_id ON chat_group_members(group_id);
CREATE INDEX idx_chat_group_members_contact_id ON chat_group_members(contact_id);

-- =====================================================
-- 8. RPC FUNCTIONS
-- =====================================================

-- Function: Get assigned chats for a user
CREATE OR REPLACE FUNCTION get_assigned_chats(p_user_id UUID, p_session_id UUID)
RETURNS TABLE (
  contact_id UUID,
  phone_number VARCHAR,
  name VARCHAR,
  custom_name VARCHAR,
  notes TEXT,
  tags TEXT[],
  importance VARCHAR,
  permissions JSONB,
  last_message_body TEXT,
  last_message_timestamp TIMESTAMPTZ,
  unread_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS contact_id,
    c.phone_number,
    c.name,
    cm.custom_name,
    cm.notes,
    cm.tags,
    cm.importance,
    ca.permissions,
    (SELECT body FROM messages WHERE contact_id = c.id ORDER BY timestamp DESC LIMIT 1) AS last_message_body,
    (SELECT timestamp FROM messages WHERE contact_id = c.id ORDER BY timestamp DESC LIMIT 1) AS last_message_timestamp,
    (SELECT COUNT(*)::INTEGER FROM messages WHERE contact_id = c.id AND from_me = FALSE AND ack != 'READ') AS unread_count
  FROM contacts c
  LEFT JOIN contact_metadata cm ON cm.contact_id = c.id
  INNER JOIN chat_assignments ca ON ca.contact_id = c.id
  WHERE c.session_id = p_session_id
    AND ca.assigned_to_user_id = p_user_id
    AND ca.is_active = TRUE
  ORDER BY last_message_timestamp DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- Function: Update or create session metadata
CREATE OR REPLACE FUNCTION upsert_session_metadata(
  p_session_id UUID,
  p_custom_label VARCHAR DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_tags TEXT[] DEFAULT NULL,
  p_color VARCHAR DEFAULT NULL,
  p_is_favorite BOOLEAN DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_metadata_id UUID;
BEGIN
  INSERT INTO session_metadata (session_id, custom_label, notes, tags, color, is_favorite, updated_at)
  VALUES (p_session_id, p_custom_label, p_notes, p_tags, p_color, p_is_favorite, NOW())
  ON CONFLICT (session_id) DO UPDATE SET
    custom_label = COALESCE(EXCLUDED.custom_label, session_metadata.custom_label),
    notes = COALESCE(EXCLUDED.notes, session_metadata.notes),
    tags = COALESCE(EXCLUDED.tags, session_metadata.tags),
    color = COALESCE(EXCLUDED.color, session_metadata.color),
    is_favorite = COALESCE(EXCLUDED.is_favorite, session_metadata.is_favorite),
    updated_at = NOW()
  RETURNING id INTO v_metadata_id;

  RETURN v_metadata_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Update or create contact metadata
CREATE OR REPLACE FUNCTION upsert_contact_metadata(
  p_contact_id UUID,
  p_session_id UUID,
  p_custom_name VARCHAR DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_tags TEXT[] DEFAULT NULL,
  p_importance VARCHAR DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_metadata_id UUID;
BEGIN
  INSERT INTO contact_metadata (contact_id, session_id, custom_name, notes, tags, importance, last_note_updated_at, updated_at)
  VALUES (p_contact_id, p_session_id, p_custom_name, p_notes, p_tags, p_importance, NOW(), NOW())
  ON CONFLICT (contact_id, session_id) DO UPDATE SET
    custom_name = COALESCE(EXCLUDED.custom_name, contact_metadata.custom_name),
    notes = COALESCE(EXCLUDED.notes, contact_metadata.notes),
    tags = COALESCE(EXCLUDED.tags, contact_metadata.tags),
    importance = COALESCE(EXCLUDED.importance, contact_metadata.importance),
    last_note_updated_at = NOW(),
    updated_at = NOW()
  RETURNING id INTO v_metadata_id;

  RETURN v_metadata_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Get sync state
CREATE OR REPLACE FUNCTION get_sync_state(p_session_id UUID)
RETURNS TABLE (
  last_synced_at TIMESTAMPTZ,
  last_message_timestamp BIGINT,
  sync_status VARCHAR,
  total_messages_synced INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ss.last_synced_at,
    ss.last_message_timestamp,
    ss.sync_status,
    ss.total_messages_synced
  FROM sync_state ss
  WHERE ss.session_id = p_session_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Update sync state
CREATE OR REPLACE FUNCTION update_sync_state(
  p_session_id UUID,
  p_sync_status VARCHAR,
  p_sync_type VARCHAR DEFAULT NULL,
  p_messages_count INTEGER DEFAULT 0
) RETURNS UUID AS $$
DECLARE
  v_sync_id UUID;
BEGIN
  INSERT INTO sync_state (session_id, sync_status, sync_type, started_at, updated_at)
  VALUES (p_session_id, p_sync_status, p_sync_type, NOW(), NOW())
  ON CONFLICT (session_id) DO UPDATE SET
    sync_status = EXCLUDED.sync_status,
    sync_type = COALESCE(EXCLUDED.sync_type, sync_state.sync_type),
    total_messages_synced = sync_state.total_messages_synced + p_messages_count,
    last_synced_at = CASE WHEN EXCLUDED.sync_status = 'completed' THEN NOW() ELSE sync_state.last_synced_at END,
    completed_at = CASE WHEN EXCLUDED.sync_status = 'completed' THEN NOW() ELSE sync_state.completed_at END,
    updated_at = NOW()
  RETURNING id INTO v_sync_id;

  RETURN v_sync_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 9. UPDATED TRIGGERS
-- =====================================================

-- Trigger: Update session_metadata updated_at
CREATE OR REPLACE FUNCTION update_session_metadata_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_session_metadata_updated_at
  BEFORE UPDATE ON session_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_session_metadata_timestamp();

-- Trigger: Update contact_metadata updated_at
CREATE OR REPLACE FUNCTION update_contact_metadata_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_contact_metadata_updated_at
  BEFORE UPDATE ON contact_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_metadata_timestamp();

-- =====================================================
-- 10. SAMPLE DATA (for testing)
-- =====================================================
-- Uncomment below to add sample data

-- INSERT INTO session_metadata (session_id, custom_label, notes, tags)
-- SELECT id, 'Test Session', 'Sample notes', ARRAY['customer', 'vip']
-- FROM sessions LIMIT 1;

COMMENT ON TABLE session_metadata IS 'Custom labels, notes, and tags for sessions (local to CRM)';
COMMENT ON TABLE contact_metadata IS 'Custom names, notes, and tags for contacts (local to CRM)';
COMMENT ON TABLE chat_assignments IS 'Multi-user chat assignment with permissions';
COMMENT ON TABLE message_media IS 'Media files attached to messages';
COMMENT ON TABLE sync_state IS 'Tracks message synchronization state per session';
COMMENT ON TABLE chat_groups IS 'User-defined groups for organizing chats';
COMMENT ON TABLE chat_group_members IS 'Many-to-many relationship between groups and chats';
