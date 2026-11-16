package com.medicare.dto;

import java.time.LocalDateTime;

public record PrescriptionDto(
        Long id,
        String medication,
        String strength,
        String dose,
        String route,
        String frequency,
        String duration,
        int refills,
        String status,
        String author,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
