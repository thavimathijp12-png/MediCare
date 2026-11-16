package com.medicare.controller;

import com.medicare.dto.AppointmentDto;
import com.medicare.entity.Role;
import com.medicare.service.AppointmentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/appointments")
public class AppointmentController {

    private final AppointmentService appointmentService;

    public AppointmentController(AppointmentService appointmentService) {
        this.appointmentService = appointmentService;
    }

    @GetMapping
    public ResponseEntity<List<AppointmentDto>> getAllAppointments(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String department,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(appointmentService.getAllForStaff(
                query, status, department, userDetails.getUsername(), roleOf(userDetails)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<AppointmentDto> getAppointmentById(
            @PathVariable String id,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(appointmentService.getByIdForStaff(
                id, userDetails.getUsername(), roleOf(userDetails)));
    }

    @PostMapping
    public ResponseEntity<AppointmentDto> bookAppointment(
            @Valid @RequestBody AppointmentDto dto,
            @AuthenticationPrincipal UserDetails userDetails) {
        Role requestRole = userDetails == null ? null : roleOf(userDetails);
        AppointmentDto booked = requestRole == Role.PATIENT
                ? appointmentService.bookForPatient(dto, userDetails.getUsername())
                : appointmentService.book(dto, requestRole);
        return ResponseEntity.status(HttpStatus.CREATED).body(booked);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'RECEPTIONIST')")
    public ResponseEntity<AppointmentDto> updateAppointment(
            @PathVariable String id,
            @Valid @RequestBody AppointmentDto dto) {
        return ResponseEntity.ok(appointmentService.updateDetails(id, dto));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'RECEPTIONIST')")
    public ResponseEntity<AppointmentDto> updateAppointmentStatus(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        String status = body != null ? body.get("status") : null;
        if (status == null || status.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(appointmentService.updateStatus(id, status.trim()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'RECEPTIONIST')")
    public ResponseEntity<Void> cancelAppointment(@PathVariable String id) {
        appointmentService.cancel(id);
        return ResponseEntity.noContent().build();
    }

    private Role roleOf(UserDetails userDetails) {
        return AuthorityUtils.authorityListToSet(userDetails.getAuthorities()).stream()
                .map(authority -> Role.valueOf(authority.substring("ROLE_".length())))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Authenticated account has no assigned role."));
    }
}

