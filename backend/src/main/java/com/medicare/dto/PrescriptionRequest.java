package com.medicare.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PrescriptionRequest(
        @NotBlank @Size(max = 120) String medication,
        @NotBlank @Size(max = 80) String strength,
        @NotBlank @Size(max = 120) String dose,
        @NotBlank @Size(max = 80) String route,
        @NotBlank @Size(max = 120) String frequency,
        @NotBlank @Size(max = 120) String duration,
        @Min(0) @Max(99) int refills,
        @NotBlank @Size(max = 32) String status) {
}
