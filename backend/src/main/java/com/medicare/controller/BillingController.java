package com.medicare.controller;

import com.medicare.dto.InvoiceDto;
import com.medicare.service.BillingService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/billing")
public class BillingController {

    private final BillingService billingService;

    public BillingController(BillingService billingService) {
        this.billingService = billingService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'RECEPTIONIST')")
    public ResponseEntity<List<InvoiceDto>> getAllInvoices(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(billingService.getAll(query, status));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'RECEPTIONIST')")
    public ResponseEntity<InvoiceDto> getInvoiceById(@PathVariable String id) {
        return ResponseEntity.ok(billingService.getByInvoiceNumber(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'RECEPTIONIST')")
    public ResponseEntity<InvoiceDto> createInvoice(@Valid @RequestBody InvoiceDto dto) {
        InvoiceDto saved = billingService.save(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PatchMapping("/{id}/pay")
    @PreAuthorize("hasAnyRole('ADMIN', 'RECEPTIONIST')")
    public ResponseEntity<InvoiceDto> markInvoiceAsPaid(@PathVariable String id) {
        InvoiceDto paid = billingService.markAsPaid(id);
        return ResponseEntity.ok(paid);
    }
}

