package com.medicare.dto;

import com.medicare.entity.CareTaskStatus;
import jakarta.validation.constraints.NotNull;

public record CareTaskStatusRequest(@NotNull CareTaskStatus status) {
}
