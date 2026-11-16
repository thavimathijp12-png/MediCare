package com.medicare.dto;

import com.medicare.entity.VitalSignType;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record PatientVitalDto(
        Long id,
        VitalSignType type,
        BigDecimal value,
        String unit,
        String author,
        LocalDateTime recordedAt) {
}
