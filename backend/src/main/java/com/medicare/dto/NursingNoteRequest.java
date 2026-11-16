package com.medicare.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record NursingNoteRequest(
        @NotBlank @Size(max = 10000) String content) {
}
