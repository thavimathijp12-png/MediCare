CREATE TABLE stripe_processed_events (
    event_id VARCHAR(255) NOT NULL PRIMARY KEY,
    processed_at TIMESTAMP NOT NULL
);
