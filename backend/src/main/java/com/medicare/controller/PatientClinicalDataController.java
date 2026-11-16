package com.medicare.controller;

import com.medicare.dto.CareTaskStatusRequest;
import com.medicare.dto.ClinicalRecordDto;
import com.medicare.dto.ClinicalRecordRequest;
import com.medicare.dto.NursingCareTaskDto;
import com.medicare.dto.NursingCareTaskRequest;
import com.medicare.dto.NursingNoteDto;
import com.medicare.dto.NursingNoteRequest;
import com.medicare.dto.PatientVitalDto;
import com.medicare.dto.PatientVitalRequest;
import com.medicare.dto.PrescriptionDto;
import com.medicare.dto.PrescriptionRequest;
import com.medicare.entity.Role;
import com.medicare.service.PatientClinicalDataService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/patients/{patientId}")
public class PatientClinicalDataController {

    private final PatientClinicalDataService clinicalDataService;

    public PatientClinicalDataController(PatientClinicalDataService clinicalDataService) {
        this.clinicalDataService = clinicalDataService;
    }

    @GetMapping("/clinical-records")
    @PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR', 'NURSE', 'PATIENT')")
    public ResponseEntity<List<ClinicalRecordDto>> getClinicalRecords(
            @PathVariable String patientId, @AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(clinicalDataService.getClinicalRecords(patientId, user.getUsername(), roleOf(user)));
    }

    @PostMapping("/clinical-records")
    @PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR')")
    public ResponseEntity<ClinicalRecordDto> createClinicalRecord(
            @PathVariable String patientId,
            @Valid @RequestBody ClinicalRecordRequest request,
            @AuthenticationPrincipal UserDetails user) {
        ClinicalRecordDto record = clinicalDataService.createClinicalRecord(
                patientId, request, user.getUsername(), roleOf(user));
        return ResponseEntity.status(HttpStatus.CREATED).body(record);
    }

    @PutMapping("/clinical-records/{recordId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR')")
    public ResponseEntity<ClinicalRecordDto> updateClinicalRecord(
            @PathVariable String patientId,
            @PathVariable Long recordId,
            @Valid @RequestBody ClinicalRecordRequest request,
            @AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(clinicalDataService.updateClinicalRecord(
                patientId, recordId, request, user.getUsername(), roleOf(user)));
    }

    @GetMapping("/prescriptions")
    @PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR', 'NURSE', 'PATIENT')")
    public ResponseEntity<List<PrescriptionDto>> getPrescriptions(
            @PathVariable String patientId, @AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(clinicalDataService.getPrescriptions(patientId, user.getUsername(), roleOf(user)));
    }

    @PostMapping("/prescriptions")
    @PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR')")
    public ResponseEntity<PrescriptionDto> createPrescription(
            @PathVariable String patientId,
            @Valid @RequestBody PrescriptionRequest request,
            @AuthenticationPrincipal UserDetails user) {
        PrescriptionDto prescription = clinicalDataService.createPrescription(
                patientId, request, user.getUsername(), roleOf(user));
        return ResponseEntity.status(HttpStatus.CREATED).body(prescription);
    }

    @PutMapping("/prescriptions/{prescriptionId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR')")
    public ResponseEntity<PrescriptionDto> updatePrescription(
            @PathVariable String patientId,
            @PathVariable Long prescriptionId,
            @Valid @RequestBody PrescriptionRequest request,
            @AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(clinicalDataService.updatePrescription(
                patientId, prescriptionId, request, user.getUsername(), roleOf(user)));
    }

    @GetMapping("/vitals")
    @PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR', 'NURSE', 'PATIENT')")
    public ResponseEntity<List<PatientVitalDto>> getVitals(
            @PathVariable String patientId, @AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(clinicalDataService.getVitals(patientId, user.getUsername(), roleOf(user)));
    }

    @PostMapping("/vitals")
    @PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR', 'NURSE')")
    public ResponseEntity<PatientVitalDto> createVital(
            @PathVariable String patientId,
            @Valid @RequestBody PatientVitalRequest request,
            @AuthenticationPrincipal UserDetails user) {
        PatientVitalDto vital = clinicalDataService.createVital(
                patientId, request, user.getUsername(), roleOf(user));
        return ResponseEntity.status(HttpStatus.CREATED).body(vital);
    }

    @PutMapping("/vitals/{vitalId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR', 'NURSE')")
    public ResponseEntity<PatientVitalDto> updateVital(
            @PathVariable String patientId,
            @PathVariable Long vitalId,
            @Valid @RequestBody PatientVitalRequest request,
            @AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(clinicalDataService.updateVital(
                patientId, vitalId, request, user.getUsername(), roleOf(user)));
    }

    @GetMapping("/nursing-notes")
    @PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR', 'NURSE')")
    public ResponseEntity<List<NursingNoteDto>> getNursingNotes(
            @PathVariable String patientId, @AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(clinicalDataService.getNursingNotes(patientId, user.getUsername(), roleOf(user)));
    }

    @PostMapping("/nursing-notes")
    @PreAuthorize("hasAnyRole('ADMIN', 'NURSE')")
    public ResponseEntity<NursingNoteDto> createNursingNote(
            @PathVariable String patientId,
            @Valid @RequestBody NursingNoteRequest request,
            @AuthenticationPrincipal UserDetails user) {
        NursingNoteDto note = clinicalDataService.createNursingNote(
                patientId, request, user.getUsername(), roleOf(user));
        return ResponseEntity.status(HttpStatus.CREATED).body(note);
    }

    @PutMapping("/nursing-notes/{noteId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'NURSE')")
    public ResponseEntity<NursingNoteDto> updateNursingNote(
            @PathVariable String patientId,
            @PathVariable Long noteId,
            @Valid @RequestBody NursingNoteRequest request,
            @AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(clinicalDataService.updateNursingNote(
                patientId, noteId, request, user.getUsername(), roleOf(user)));
    }

    @GetMapping("/nursing-tasks")
    @PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR', 'NURSE')")
    public ResponseEntity<List<NursingCareTaskDto>> getCareTasks(
            @PathVariable String patientId, @AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(clinicalDataService.getCareTasks(patientId, user.getUsername(), roleOf(user)));
    }

    @PostMapping("/nursing-tasks")
    @PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR')")
    public ResponseEntity<NursingCareTaskDto> createCareTask(
            @PathVariable String patientId,
            @Valid @RequestBody NursingCareTaskRequest request,
            @AuthenticationPrincipal UserDetails user) {
        NursingCareTaskDto task = clinicalDataService.createCareTask(
                patientId, request, user.getUsername(), roleOf(user));
        return ResponseEntity.status(HttpStatus.CREATED).body(task);
    }

    @PatchMapping("/nursing-tasks/{taskId}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR', 'NURSE')")
    public ResponseEntity<NursingCareTaskDto> updateCareTaskStatus(
            @PathVariable String patientId,
            @PathVariable Long taskId,
            @Valid @RequestBody CareTaskStatusRequest request,
            @AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(clinicalDataService.updateCareTaskStatus(
                patientId, taskId, request.status(), user.getUsername(), roleOf(user)));
    }

    private Role roleOf(UserDetails user) {
        return AuthorityUtils.authorityListToSet(user.getAuthorities()).stream()
                .map(authority -> Role.valueOf(authority.substring("ROLE_".length())))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Authenticated account has no assigned role."));
    }
}
