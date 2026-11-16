package com.medicare.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ClinicalRecordRequest(
        @NotBlank @Size(max = 500) String diagnosis,
        @NotBlank @Size(max = 5000) String clinicalNote,
        @Size(max = 2000) String allergies) {
}
