package com.medicare.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record PatientProfileUpdateRequest(
        @NotBlank(message = "Patient name is required")
        @Size(min = 2, max = 120, message = "Name must be between 2 and 120 characters")
        String name,
        @NotBlank(message = "Phone number is required")
        @Pattern(regexp = "(?=.*\\d)[+()0-9 .-]{7,40}", message = "A valid phone number is required")
        String phone,
        @Size(max = 500, message = "Address must not exceed 500 characters")
        String address,
        @Size(max = 8, message = "Blood group must not exceed 8 characters")
        String bloodGroup,
        @NotNull(message = "Age is required")
        @Min(value = 0, message = "Age cannot be negative")
        @Max(value = 130, message = "Please enter a valid age")
        Integer age,
        @NotBlank(message = "Gender is required")
        @Size(max = 24, message = "Gender must not exceed 24 characters")
        String gender,
        @Size(max = 500, message = "Condition must not exceed 500 characters")
        String condition) {
}
