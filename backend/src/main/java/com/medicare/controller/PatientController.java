package com.medicare.controller;

import com.medicare.dto.PatientDto;
import com.medicare.entity.Role;
import com.medicare.service.PatientService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/patients")
public class PatientController {

    private final PatientService patientService;

    public PatientController(PatientService patientService) {
        this.patientService = patientService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE')")
    public ResponseEntity<List<PatientDto>> getAllPatients(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String gender,
            @RequestParam(required = false) String status,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(patientService.getAllForStaff(
                query, gender, status, userDetails.getUsername(), roleOf(userDetails)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE')")
    public ResponseEntity<PatientDto> getPatientById(
            @PathVariable String id,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(patientService.getByIdForStaff(
                id, userDetails.getUsername(), roleOf(userDetails)));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'RECEPTIONIST')")
    public ResponseEntity<PatientDto> createPatient(@Valid @RequestBody PatientDto dto) {
        PatientDto saved = patientService.save(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR', 'RECEPTIONIST')")
    public ResponseEntity<PatientDto> updatePatient(
            @PathVariable String id,
            @Valid @RequestBody PatientDto dto,
            @AuthenticationPrincipal UserDetails userDetails) {
        dto.setId(id);
        PatientDto updated = patientService.saveForStaff(
                dto, userDetails.getUsername(), roleOf(userDetails));
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deletePatient(@PathVariable String id) {
        patientService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/nurses/{email}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> assignNurse(@PathVariable String id, @PathVariable String email) {
        patientService.assignNurse(id, email);
        return ResponseEntity.noContent().build();
    }

    private Role roleOf(UserDetails userDetails) {
        return AuthorityUtils.authorityListToSet(userDetails.getAuthorities()).stream()
                .map(authority -> Role.valueOf(authority.substring("ROLE_".length())))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Authenticated account has no assigned role."));
    }
}

