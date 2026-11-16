package com.medicare.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record NursingCareTaskRequest(
        @NotBlank @Size(max = 500) String description) {
}
