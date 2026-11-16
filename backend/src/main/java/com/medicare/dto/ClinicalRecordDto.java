package com.medicare.dto;

import java.time.LocalDateTime;

public record ClinicalRecordDto(
        Long id,
        String diagnosis,
        String clinicalNote,
        String allergies,
        String author,
        LocalDateTime recordedAt,
        LocalDateTime updatedAt) {
}
