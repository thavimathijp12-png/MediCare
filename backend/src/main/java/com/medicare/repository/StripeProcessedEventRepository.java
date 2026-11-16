package com.medicare.repository;

import com.medicare.entity.StripeProcessedEvent;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StripeProcessedEventRepository extends JpaRepository<StripeProcessedEvent, String> {
}
