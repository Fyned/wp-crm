-- =====================================================
-- Evolution API Adaptation
-- Minor updates to work with Evolution API instead of WAHA
-- =====================================================

-- No major schema changes needed!
-- Evolution API uses the same webhook event structure
-- Just updating some field descriptions for clarity

-- Update sessions table comment
COMMENT ON COLUMN sessions.waha_metadata IS 'Evolution API instance metadata (previously WAHA)';

-- Rename for clarity (optional - can keep as is for backwards compatibility)
-- ALTER TABLE sessions RENAME COLUMN waha_metadata TO evolution_metadata;

-- No changes needed to messages table
-- The waha_message_id column works perfectly with Evolution API
-- (Both use WhatsApp's message ID structure)

-- Add index for Evolution API queries
CREATE INDEX IF NOT EXISTS idx_messages_session_timestamp
ON messages(session_id, timestamp DESC);

-- Add function to get instance name from session
CREATE OR REPLACE FUNCTION get_instance_name(p_session_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_session_name TEXT;
BEGIN
    SELECT session_name INTO v_session_name
    FROM sessions
    WHERE id = p_session_id;

    RETURN v_session_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Evolution API Status Mapping
-- Evolution uses slightly different status names
-- =====================================================

-- Function to map Evolution API connection states
CREATE OR REPLACE FUNCTION map_evolution_status(p_evolution_state TEXT)
RETURNS session_status AS $$
BEGIN
    RETURN CASE p_evolution_state
        WHEN 'open' THEN 'CONNECTED'::session_status
        WHEN 'connecting' THEN 'CONNECTING'::session_status
        WHEN 'close' THEN 'DISCONNECTED'::session_status
        ELSE 'FAILED'::session_status
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- Webhook Event Log (Optional - for debugging)
-- =====================================================

CREATE TABLE IF NOT EXISTS webhook_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type TEXT NOT NULL,
    instance_name TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    received_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX idx_webhook_logs_instance ON webhook_logs(instance_name);
CREATE INDEX idx_webhook_logs_received ON webhook_logs(received_at DESC);
CREATE INDEX idx_webhook_logs_processed ON webhook_logs(processed) WHERE NOT processed;

-- Auto-cleanup old webhook logs (keep last 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_logs()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM webhook_logs
    WHERE received_at < NOW() - INTERVAL '7 days';

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Evolution API Health Metrics
-- =====================================================

CREATE OR REPLACE VIEW session_health AS
SELECT
    s.id,
    s.session_name,
    s.phone_number,
    s.status,
    s.last_connected_at,
    s.last_message_timestamp,
    COUNT(DISTINCT c.id) as total_contacts,
    COUNT(m.id) as total_messages,
    COUNT(m.id) FILTER (WHERE m.created_at > NOW() - INTERVAL '24 hours') as messages_last_24h,
    COUNT(m.id) FILTER (WHERE m.from_me = FALSE AND m.ack != 'READ') as unread_count,
    CASE
        WHEN s.status = 'CONNECTED' AND s.last_connected_at > NOW() - INTERVAL '5 minutes' THEN 'healthy'
        WHEN s.status = 'CONNECTED' AND s.last_connected_at > NOW() - INTERVAL '1 hour' THEN 'warning'
        ELSE 'unhealthy'
    END as health_status
FROM sessions s
LEFT JOIN contacts c ON c.session_id = s.id
LEFT JOIN messages m ON m.session_id = s.id
GROUP BY s.id, s.session_name, s.phone_number, s.status, s.last_connected_at, s.last_message_timestamp;

-- Grant access to view
GRANT SELECT ON session_health TO authenticated;

-- =====================================================
-- Performance Optimization
-- =====================================================

-- Partial index for active sessions only
CREATE INDEX IF NOT EXISTS idx_sessions_active
ON sessions(id, session_name)
WHERE status = 'CONNECTED';

-- Index for recent messages queries
CREATE INDEX IF NOT EXISTS idx_messages_recent
ON messages(session_id, contact_id, timestamp DESC)
WHERE timestamp > NOW() - INTERVAL '30 days';

-- =====================================================
-- Migration Complete
-- =====================================================

-- Log migration
DO $$
BEGIN
    RAISE NOTICE 'Evolution API adaptation migration completed successfully';
    RAISE NOTICE 'Schema is fully compatible with Evolution API';
    RAISE NOTICE 'No data migration needed - existing data works as-is';
END $$;
