package com.medicare.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ContactInquiryRequest(
        @NotBlank @Size(max = 120) String name,
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Pattern(regexp = "(?=.*\\d)[+()0-9 .-]{7,24}") String phone,
        @NotBlank @Size(max = 100) String department,
        @NotBlank @Size(max = 2000) String message) {
}
