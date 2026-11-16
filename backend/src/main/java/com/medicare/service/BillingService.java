package com.medicare.service;

import com.medicare.dto.InvoiceDto;
import com.medicare.entity.ActivityRecord;
import com.medicare.entity.Invoice;
import com.medicare.entity.InvoiceItem;
import com.medicare.entity.Patient;
import com.medicare.exception.BusinessRuleException;
import com.medicare.exception.ResourceNotFoundException;
import com.medicare.repository.ActivityRepository;
import com.medicare.repository.DepartmentRepository;
import com.medicare.repository.InvoiceRepository;
import com.medicare.repository.PatientRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class BillingService {

    private final InvoiceRepository invoiceRepository;
    private final ActivityRepository activityRepository;
    private final PatientRepository patientRepository;
    private final DepartmentRepository departmentRepository;

    public BillingService(InvoiceRepository invoiceRepository,
                          ActivityRepository activityRepository,
                          PatientRepository patientRepository,
                          DepartmentRepository departmentRepository) {
        this.invoiceRepository = invoiceRepository;
        this.activityRepository = activityRepository;
        this.patientRepository = patientRepository;
        this.departmentRepository = departmentRepository;
    }

    @Transactional(readOnly = true)
    public List<InvoiceDto> getAll(String query, String status) {
        return invoiceRepository.findAll().stream()
                .filter(i -> query == null || query.trim().isEmpty() ||
                        i.getInvoiceNumber().toLowerCase().contains(query.toLowerCase()) ||
                        i.getPatientName().toLowerCase().contains(query.toLowerCase()) ||
                        i.getDepartment().toLowerCase().contains(query.toLowerCase()))
                .filter(i -> status == null || status.trim().isEmpty() || i.getStatus().equalsIgnoreCase(status.trim()))
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public InvoiceDto getByInvoiceNumber(String invoiceNumber) {
        Invoice invoice = invoiceRepository.findByInvoiceNumberIgnoreCase(invoiceNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice " + invoiceNumber + " was not found."));
        return toDto(invoice);
    }

    @Transactional(readOnly = true)
    public List<InvoiceDto> getForPatientAccount(String email) {
        Patient patient = patientRepository.findByPatientAccount_EmailIgnoreCase(email)
                .orElseThrow(() -> new ResourceNotFoundException("The patient profile was not found."));
        return invoiceRepository.findByPatient_IdOrderByDateDesc(patient.getId())
                .stream().map(this::toDto).toList();
    }

    @Transactional
    public InvoiceDto save(InvoiceDto dto) {
        Invoice inv = new Invoice();
        inv.setInvoiceNumber(dto.getId() != null && !dto.getId().isBlank()
                ? dto.getId().trim()
                : "INV-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        inv.setPatientName(dto.getPatientName());
        inv.setDepartment(dto.getDepartment());
        if (dto.getDepartment() != null) {
            inv.setDepartmentEntity(departmentRepository.findByNameIgnoreCase(dto.getDepartment()).orElse(null));
        }
        if (dto.getPatientId() != null && !dto.getPatientId().isBlank()) {
            inv.setPatient(patientRepository.findByPatientIdIgnoreCase(dto.getPatientId().trim())
                    .orElseThrow(() -> new ResourceNotFoundException("The selected patient record was not found.")));
        }
        inv.setDate(
                dto.getDate() != null && !dto.getDate().isEmpty() ? LocalDate.parse(dto.getDate()) : LocalDate.now());
        inv.setStatus("Pending");
        inv.setMethod(dto.getMethod() != null ? dto.getMethod() : "Direct Payment");

        List<InvoiceItem> items = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;
        if (dto.getItems() != null && !dto.getItems().isEmpty()) {
            for (InvoiceDto.InvoiceItemDto it : dto.getItems()) {
                if (it.getDesc() == null || it.getDesc().isBlank() || it.getCost() == null
                        || it.getCost().compareTo(BigDecimal.ZERO) < 0) {
                    throw new BusinessRuleException("Invoice items require a description and non-negative cost.");
                }
                items.add(new InvoiceItem(it.getDesc(), it.getCost()));
                total = total.add(it.getCost());
            }
        }
        inv.setItems(items);
        if (dto.getAmount() != null && dto.getAmount().compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessRuleException("Invoice amount cannot be negative.");
        }
        inv.setAmount(dto.getAmount() != null ? dto.getAmount() : total);

        Invoice saved = invoiceRepository.save(inv);

        activityRepository.save(new ActivityRecord(
                null,
                "bi-receipt",
                "badge-lavender",
                "Invoice Generated",
                "Invoice " + saved.getInvoiceNumber() + " for $" + saved.getAmount() + " created for "
                        + saved.getPatientName() + "."));

        return toDto(saved);
    }

    @Transactional
    public InvoiceDto markAsPaid(String invoiceNumber) {
        Invoice inv = invoiceRepository.findByInvoiceNumberIgnoreCase(invoiceNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice " + invoiceNumber + " was not found."));

        inv.setStatus("Paid");
        invoiceRepository.save(inv);

        activityRepository.save(new ActivityRecord(
                null,
                "bi-check2-circle",
                "badge-mint",
                "Payment Status Updated",
                "Invoice " + inv.getInvoiceNumber() + " ($" + inv.getAmount()
                        + ") recorded as Paid. No payment was processed by MediCare."));

        return toDto(inv);
    }

    private InvoiceDto toDto(Invoice inv) {
        InvoiceDto dto = new InvoiceDto();
        dto.setId(inv.getInvoiceNumber());
        dto.setPatientName(inv.getPatientName());
        dto.setPatientId(inv.getPatient() != null ? inv.getPatient().getPatientId() : null);
        dto.setDepartment(inv.getDepartment());
        dto.setDate(inv.getDate() != null ? inv.getDate().toString() : "");
        dto.setAmount(inv.getAmount());
        dto.setStatus(inv.getStatus());
        dto.setMethod(inv.getMethod());

        if (inv.getItems() != null) {
            dto.setItems(inv.getItems().stream()
                    .map(it -> new InvoiceDto.InvoiceItemDto(it.getDesc(), it.getCost()))
                    .collect(Collectors.toList()));
        }
        return dto;
    }
}
