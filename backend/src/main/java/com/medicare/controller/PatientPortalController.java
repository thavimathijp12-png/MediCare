package com.medicare.controller;

import com.medicare.dto.CheckoutSessionResponse;
import com.medicare.dto.PatientDashboardDto;
import com.medicare.dto.AppointmentDto;
import com.medicare.service.PatientPortalService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/patient-portal")
@PreAuthorize("hasRole('PATIENT')")
public class PatientPortalController {

    private final PatientPortalService patientPortalService;

    public PatientPortalController(PatientPortalService patientPortalService) {
        this.patientPortalService = patientPortalService;
    }

    @GetMapping("/me")
    public PatientDashboardDto getOwnDashboard(@AuthenticationPrincipal UserDetails user) {
        return patientPortalService.getDashboard(user.getUsername());
    }

    @PostMapping("/appointments")
    public ResponseEntity<AppointmentDto> bookAppointment(
            @AuthenticationPrincipal UserDetails user,
            @Valid @RequestBody AppointmentDto request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(patientPortalService.bookAppointment(user.getUsername(), request));
    }

    @PostMapping("/invoices/{invoiceNumber}/checkout")
    public CheckoutSessionResponse createInvoiceCheckout(
            @PathVariable String invoiceNumber,
            @AuthenticationPrincipal UserDetails user) {
        return patientPortalService.createInvoiceCheckout(invoiceNumber, user.getUsername());
    }
}
