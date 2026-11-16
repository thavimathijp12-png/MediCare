package com.medicare.service;

import com.medicare.dto.AppointmentDto;
import com.medicare.dto.CheckoutSessionResponse;
import com.medicare.dto.PatientDashboardDto;
import com.medicare.entity.Patient;
import com.medicare.entity.Role;
import com.medicare.exception.ResourceNotFoundException;
import com.medicare.repository.PatientRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PatientPortalService {

    private final PatientRepository patientRepository;
    private final PatientService patientService;
    private final AppointmentService appointmentService;
    private final BillingService billingService;
    private final PatientClinicalDataService clinicalDataService;
    private final StripePaymentService stripePaymentService;

    public PatientPortalService(
            PatientRepository patientRepository,
            PatientService patientService,
            AppointmentService appointmentService,
            BillingService billingService,
            PatientClinicalDataService clinicalDataService,
            StripePaymentService stripePaymentService) {
        this.patientRepository = patientRepository;
        this.patientService = patientService;
        this.appointmentService = appointmentService;
        this.billingService = billingService;
        this.clinicalDataService = clinicalDataService;
        this.stripePaymentService = stripePaymentService;
    }

    @Transactional(readOnly = true)
    public PatientDashboardDto getDashboard(String email) {
        Patient patient = patientRepository.findByPatientAccount_EmailIgnoreCase(email)
                .orElseThrow(() -> new ResourceNotFoundException("The patient profile was not found."));
        String patientId = patient.getPatientId();
        return new PatientDashboardDto(
                patientService.toDto(patient),
                appointmentService.getForPatientAccount(email),
                billingService.getForPatientAccount(email),
                clinicalDataService.getClinicalRecords(patientId, email, Role.PATIENT),
                clinicalDataService.getPrescriptions(patientId, email, Role.PATIENT),
                clinicalDataService.getVitals(patientId, email, Role.PATIENT));
    }

    public AppointmentDto bookAppointment(String email, AppointmentDto request) {
        return appointmentService.bookForPatient(request, email);
    }

    public CheckoutSessionResponse createInvoiceCheckout(String invoiceNumber, String email) {
        return stripePaymentService.createCheckoutSession(invoiceNumber, email);
    }
}
