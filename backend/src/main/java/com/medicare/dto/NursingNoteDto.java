package com.medicare.dto;

import java.time.LocalDateTime;

public record NursingNoteDto(
        Long id,
        String content,
        String author,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
