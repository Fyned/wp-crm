-- =====================================================
-- Additional Database Functions and Triggers
-- =====================================================

-- =====================================================
-- 1. AUTO-CREATE PROFILE ON USER SIGNUP
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, role, created_by_admin_id)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'team_member'),
        (NEW.raw_user_meta_data->>'created_by_admin_id')::uuid
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 2. UPDATE SESSION LAST MESSAGE TIMESTAMP
-- =====================================================

CREATE OR REPLACE FUNCTION update_session_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE sessions
    SET last_message_timestamp = NEW.timestamp
    WHERE id = NEW.session_id
    AND (last_message_timestamp IS NULL OR last_message_timestamp < NEW.timestamp);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_message_insert_update_session
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_session_last_message();

-- =====================================================
-- 3. AUTO-CREATE CONTACT IF NOT EXISTS
-- =====================================================

CREATE OR REPLACE FUNCTION ensure_contact_exists(
    p_session_id UUID,
    p_phone_number TEXT,
    p_name TEXT DEFAULT NULL,
    p_is_group BOOLEAN DEFAULT FALSE
)
RETURNS UUID AS $$
DECLARE
    v_contact_id UUID;
BEGIN
    -- Try to find existing contact
    SELECT id INTO v_contact_id
    FROM contacts
    WHERE session_id = p_session_id
    AND phone_number = p_phone_number;

    -- Create if not exists
    IF v_contact_id IS NULL THEN
        INSERT INTO contacts (session_id, phone_number, name, is_group)
        VALUES (p_session_id, p_phone_number, p_name, p_is_group)
        RETURNING id INTO v_contact_id;
    ELSE
        -- Update name if provided and different
        IF p_name IS NOT NULL THEN
            UPDATE contacts
            SET name = p_name, updated_at = NOW()
            WHERE id = v_contact_id AND (name IS NULL OR name != p_name);
        END IF;
    END IF;

    RETURN v_contact_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. GET UNREAD MESSAGE COUNT
-- =====================================================

CREATE OR REPLACE FUNCTION get_unread_count(
    p_session_id UUID,
    p_contact_id UUID
)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM messages
        WHERE session_id = p_session_id
        AND contact_id = p_contact_id
        AND from_me = FALSE
        AND ack != 'READ'
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. MARK MESSAGES AS READ
-- =====================================================

CREATE OR REPLACE FUNCTION mark_messages_read(
    p_session_id UUID,
    p_contact_id UUID
)
RETURNS INTEGER AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    UPDATE messages
    SET ack = 'READ'
    WHERE session_id = p_session_id
    AND contact_id = p_contact_id
    AND from_me = FALSE
    AND ack != 'READ';

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. GET CHAT LIST (WITH LAST MESSAGE)
-- =====================================================

CREATE OR REPLACE FUNCTION get_chat_list(p_session_id UUID)
RETURNS TABLE (
    contact_id UUID,
    phone_number TEXT,
    name TEXT,
    is_group BOOLEAN,
    profile_pic_url TEXT,
    last_message_body TEXT,
    last_message_timestamp TIMESTAMPTZ,
    last_message_from_me BOOLEAN,
    unread_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH latest_messages AS (
        SELECT DISTINCT ON (m.contact_id)
            m.contact_id,
            m.body,
            m.timestamp,
            m.from_me
        FROM messages m
        WHERE m.session_id = p_session_id
        ORDER BY m.contact_id, m.timestamp DESC
    )
    SELECT
        c.id,
        c.phone_number,
        c.name,
        c.is_group,
        c.profile_pic_url,
        lm.body,
        lm.timestamp,
        lm.from_me,
        COUNT(m.id) FILTER (WHERE m.from_me = FALSE AND m.ack != 'READ') as unread_count
    FROM contacts c
    LEFT JOIN latest_messages lm ON lm.contact_id = c.id
    LEFT JOIN messages m ON m.contact_id = c.id AND m.session_id = p_session_id
    WHERE c.session_id = p_session_id
    GROUP BY c.id, c.phone_number, c.name, c.is_group, c.profile_pic_url,
             lm.body, lm.timestamp, lm.from_me
    ORDER BY lm.timestamp DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. GET MESSAGES FOR CHAT (PAGINATED)
-- =====================================================

CREATE OR REPLACE FUNCTION get_chat_messages(
    p_session_id UUID,
    p_contact_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    waha_message_id TEXT,
    message_type message_type,
    body TEXT,
    from_me BOOLEAN,
    ack message_ack,
    has_media BOOLEAN,
    media_url TEXT,
    media_mimetype TEXT,
    media_filename TEXT,
    timestamp TIMESTAMPTZ,
    quoted_message_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id,
        m.waha_message_id,
        m.message_type,
        m.body,
        m.from_me,
        m.ack,
        m.has_media,
        m.media_url,
        m.media_mimetype,
        m.media_filename,
        m.timestamp,
        m.quoted_message_id
    FROM messages m
    WHERE m.session_id = p_session_id
    AND m.contact_id = p_contact_id
    ORDER BY m.timestamp DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. SEARCH MESSAGES
-- =====================================================

CREATE OR REPLACE FUNCTION search_messages(
    p_session_id UUID,
    p_search_query TEXT,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    contact_id UUID,
    contact_name TEXT,
    body TEXT,
    timestamp TIMESTAMPTZ,
    from_me BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id,
        m.contact_id,
        c.name,
        m.body,
        m.timestamp,
        m.from_me
    FROM messages m
    JOIN contacts c ON c.id = m.contact_id
    WHERE m.session_id = p_session_id
    AND m.body ILIKE '%' || p_search_query || '%'
    ORDER BY m.timestamp DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 9. GET SESSION STATISTICS
-- =====================================================

CREATE OR REPLACE FUNCTION get_session_stats(p_session_id UUID)
RETURNS TABLE (
    total_messages BIGINT,
    total_contacts BIGINT,
    unread_messages BIGINT,
    messages_today BIGINT,
    media_messages BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(m.id),
        COUNT(DISTINCT m.contact_id),
        COUNT(m.id) FILTER (WHERE m.from_me = FALSE AND m.ack != 'READ'),
        COUNT(m.id) FILTER (WHERE m.timestamp >= CURRENT_DATE),
        COUNT(m.id) FILTER (WHERE m.has_media = TRUE)
    FROM messages m
    WHERE m.session_id = p_session_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 10. CLEAN OLD SYNC LOGS (Maintenance)
-- =====================================================

CREATE OR REPLACE FUNCTION clean_old_sync_logs()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM sync_logs
    WHERE started_at < NOW() - INTERVAL '30 days';

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (requires pg_cron extension)
-- SELECT cron.schedule('clean-sync-logs', '0 2 * * *', 'SELECT clean_old_sync_logs()');
