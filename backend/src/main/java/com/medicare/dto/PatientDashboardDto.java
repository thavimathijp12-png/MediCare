package com.medicare.dto;

import java.util.List;

public record PatientDashboardDto(
        PatientDto profile,
        List<AppointmentDto> appointments,
        List<InvoiceDto> invoices,
        List<ClinicalRecordDto> clinicalRecords,
        List<PrescriptionDto> prescriptions,
        List<PatientVitalDto> vitals) {
}
