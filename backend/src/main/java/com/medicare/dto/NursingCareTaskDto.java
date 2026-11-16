package com.medicare.dto;

import com.medicare.entity.CareTaskStatus;

import java.time.LocalDateTime;

public record NursingCareTaskDto(
        Long id,
        String description,
        CareTaskStatus status,
        String createdBy,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
