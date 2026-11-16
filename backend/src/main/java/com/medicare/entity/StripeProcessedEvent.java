package com.medicare.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "stripe_processed_events")
public class StripeProcessedEvent {

    @Id
    @Column(name = "event_id", length = 255)
    private String eventId;

    @Column(name = "processed_at", nullable = false)
    private Instant processedAt = Instant.now();

    protected StripeProcessedEvent() {
    }

    public StripeProcessedEvent(String eventId) {
        this.eventId = eventId;
        this.processedAt = Instant.now();
    }
}
