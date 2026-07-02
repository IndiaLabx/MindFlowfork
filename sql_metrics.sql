-- Check for existing live session metrics if they exist
SELECT
    event_type,
    COUNT(*) as total_events,
    MIN(created_at) as first_event,
    MAX(created_at) as last_event
FROM analytics_events
WHERE event_type ILIKE '%live%' OR event_type ILIKE '%talk%' OR event_type ILIKE '%audio%'
GROUP BY event_type;
