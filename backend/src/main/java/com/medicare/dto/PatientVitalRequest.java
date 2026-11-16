package com.medicare.dto;

import com.medicare.entity.VitalSignType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record PatientVitalRequest(
        @NotNull VitalSignType type,
        @NotNull @DecimalMin(value = "0.001") @Digits(integer = 5, fraction = 3) BigDecimal value) {
}
