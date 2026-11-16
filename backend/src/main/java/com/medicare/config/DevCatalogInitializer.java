package com.medicare.config;

import com.medicare.entity.ActivityRecord;
import com.medicare.entity.Appointment;
import com.medicare.entity.Department;
import com.medicare.entity.Doctor;
import com.medicare.entity.Invoice;
import com.medicare.entity.Patient;
import com.medicare.repository.ActivityRepository;
import com.medicare.repository.AppointmentRepository;
import com.medicare.repository.DepartmentRepository;
import com.medicare.repository.DoctorRepository;
import com.medicare.repository.InvoiceRepository;
import com.medicare.repository.PatientRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Component
@Profile("dev")
public class DevCatalogInitializer implements ApplicationRunner {
    private final DepartmentRepository departmentRepository;
    private final DoctorRepository doctorRepository;
    private final PatientRepository patientRepository;
    private final AppointmentRepository appointmentRepository;
    private final InvoiceRepository invoiceRepository;
    private final ActivityRepository activityRepository;

    public DevCatalogInitializer(DepartmentRepository departmentRepository,
                                 DoctorRepository doctorRepository,
                                 PatientRepository patientRepository,
                                 AppointmentRepository appointmentRepository,
                                 InvoiceRepository invoiceRepository,
                                 ActivityRepository activityRepository) {
        this.departmentRepository = departmentRepository;
        this.doctorRepository = doctorRepository;
        this.patientRepository = patientRepository;
        this.appointmentRepository = appointmentRepository;
        this.invoiceRepository = invoiceRepository;
        this.activityRepository = activityRepository;
    }

    @Override
    public void run(ApplicationArguments args) {
        List<Department> departments = List.of(
                new Department(null, "Cardiology", "CARD", "Comprehensive cardiovascular diagnostics and interventional catheterization.", "Building A, Floor 2", "Dr. Sarah Jenkins", 24, 18),
                new Department(null, "Neurology", "NEUR", "Advanced neuro-diagnostics and stroke rehabilitation.", "Building B, Floor 4", "Dr. Alexander Chen", 18, 12),
                new Department(null, "Orthopedics", "ORTH", "Robotic joint arthroplasty and sports traumatology.", "Building C, Floor 1", "Dr. Marcus Vance", 20, 16),
                new Department(null, "Pediatrics", "PED", "Family-centered neonatal intensive care and pediatric wellness.", "Children's Pavilion, Wing 2", "Dr. Elena Rostova", 16, 9),
                new Department(null, "Dermatology", "DERM", "Clinical phototherapy and advanced laser therapeutics.", "Outpatient Wing 1", "Dr. Aisha Patel", 8, 4),
                new Department(null, "General Medicine", "GEN", "Primary health examinations and adult chronic disease management.", "Ground Floor Diagnostic Suite", "Dr. David Sterling", 30, 22)
        );
        for (Department department : departments) {
            if (departmentRepository.findByNameIgnoreCase(department.getName()).isEmpty()) {
                departmentRepository.save(department);
            }
        }

        seedDoctor("DOC-101", "Dr. Sarah Jenkins", "MD, FACC - Harvard Medical", "Cardiology", 14, 150,
                "+1 (555) 234-8901", "sarah.jenkins@medicare.health", "Available", "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=600&q=80",
                "Senior Interventional Cardiologist specializing in heart rhythm disorders, minimally invasive valve repair, and preventive coronary care.");
        seedDoctor("DOC-102", "Dr. Alexander Chen", "MD, Ph.D. - Johns Hopkins", "Neurology", 16, 180,
                "+1 (555) 345-6789", "alexander.chen@medicare.health", "Available", "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=600&q=80",
                "Neurosurgeon and Clinical Neurologist focusing on neuro-oncology, complex spine disorders, and stroke rehabilitation.");
        seedDoctor("DOC-103", "Dr. Elena Rostova", "MD, FAAP - Stanford Medicine", "Pediatrics", 11, 120,
                "+1 (555) 456-7890", "elena.rostova@medicare.health", "Available", "https://images.unsplash.com/photo-1527613426441-4da17471b66d?auto=format&fit=crop&w=600&q=80",
                "Pediatric specialist dedicated to neonatal wellness, pediatric chronic care, and adolescent developmental health.");
        seedDoctor("DOC-104", "Dr. Marcus Vance", "MD, FAAOS - Mayo Clinic", "Orthopedics", 18, 160,
                "+1 (555) 567-8901", "marcus.vance@medicare.health", "Available", "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=600&q=80",
                "Reconstructive orthopedic surgeon specializing in robotic joint replacement, sports injury trauma, and arthroscopy.");
        seedDoctor("DOC-105", "Dr. Aisha Patel", "MD, FAAD - Columbia University", "Dermatology", 9, 130,
                "+1 (555) 678-9012", "aisha.patel@medicare.health", "Available", "https://images.unsplash.com/photo-1614608682850-e0d6ed316d47?auto=format&fit=crop&w=600&q=80",
                "Clinical and aesthetic dermatologist offering advanced laser therapeutics, pediatric dermatology, and autoimmune skin treatment.");
        seedDoctor("DOC-106", "Dr. David Sterling", "MD, FACP - Yale School of Medicine", "General Medicine", 21, 110,
                "+1 (555) 789-0123", "david.sterling@medicare.health", "Available", "https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&w=600&q=80",
                "Chief Internal Medicine Consultant specializing in metabolic disorders, comprehensive diagnostics, and preventive geriatrics.");

        seedDevPatientsAndClinicalData();
    }

    private void seedDoctor(String id, String name, String degree, String departmentName, int experience,
                            int fee, String phone, String email, String status, String image, String biography) {
        if (doctorRepository.findByDoctorIdIgnoreCase(id).isPresent()) {
            return;
        }
        Doctor doctor = new Doctor(null, id, name, degree, departmentName, experience,
                BigDecimal.valueOf(fee), phone, email, status, BigDecimal.valueOf(4.90), 0, image, biography);
        doctor.setDepartmentEntity(departmentRepository.findByNameIgnoreCase(departmentName).orElse(null));
        doctorRepository.save(doctor);
    }

    private void seedDevPatientsAndClinicalData() {
        if (patientRepository.count() == 0) {
            Doctor docJenkins = doctorRepository.findByDoctorIdIgnoreCase("DOC-101").orElse(null);
            Doctor docChen = doctorRepository.findByDoctorIdIgnoreCase("DOC-102").orElse(null);
            Doctor docPatel = doctorRepository.findByDoctorIdIgnoreCase("DOC-105").orElse(null);
            Doctor docVance = doctorRepository.findByDoctorIdIgnoreCase("DOC-104").orElse(null);

            Patient p1 = new Patient(null, "PAT-001", "Eleanor Vance", 42, "Female", "A+",
                    "+1 (555) 321-7654", "eleanor.vance@example.com", "Hypertension Stage 2",
                    "Dr. Sarah Jenkins", "Admitted", "42 Lexington Ave, New York, NY", LocalDate.now().minusDays(3));
            p1.setAssignedDoctor(docJenkins);
            patientRepository.save(p1);

            Patient p2 = new Patient(null, "PAT-002", "David Kim", 35, "Male", "O+",
                    "+1 (555) 432-8765", "david.kim@example.com", "Migraine with Aura",
                    "Dr. Alexander Chen", "Outpatient", "128 Beacon St, Boston, MA", LocalDate.now().minusDays(1));
            p2.setAssignedDoctor(docChen);
            patientRepository.save(p2);

            Patient p3 = new Patient(null, "PAT-003", "Maria Gonzalez", 29, "Female", "B+",
                    "+1 (555) 543-9876", "maria.gonzalez@example.com", "Contact Dermatitis",
                    "Dr. Aisha Patel", "Outpatient", "770 Broadway, New York, NY", LocalDate.now());
            p3.setAssignedDoctor(docPatel);
            patientRepository.save(p3);

            Patient p4 = new Patient(null, "PAT-004", "Robert Miller", 61, "Male", "AB+",
                    "+1 (555) 654-0987", "robert.miller@example.com", "Post-op Knee Arthroscopy",
                    "Dr. Marcus Vance", "Admitted", "55 Park Pl, Chicago, IL", LocalDate.now().minusDays(2));
            p4.setAssignedDoctor(docVance);
            patientRepository.save(p4);
        }

        if (appointmentRepository.count() == 0) {
            Department cardDept = departmentRepository.findByNameIgnoreCase("Cardiology").orElse(null);
            Department neurDept = departmentRepository.findByNameIgnoreCase("Neurology").orElse(null);
            Department dermDept = departmentRepository.findByNameIgnoreCase("Dermatology").orElse(null);
            Department orthDept = departmentRepository.findByNameIgnoreCase("Orthopedics").orElse(null);

            Doctor docJenkins = doctorRepository.findByDoctorIdIgnoreCase("DOC-101").orElse(null);
            Doctor docChen = doctorRepository.findByDoctorIdIgnoreCase("DOC-102").orElse(null);
            Doctor docPatel = doctorRepository.findByDoctorIdIgnoreCase("DOC-105").orElse(null);
            Doctor docVance = doctorRepository.findByDoctorIdIgnoreCase("DOC-104").orElse(null);

            Patient p1 = patientRepository.findByPatientIdIgnoreCase("PAT-001").orElse(null);
            Patient p2 = patientRepository.findByPatientIdIgnoreCase("PAT-002").orElse(null);
            Patient p3 = patientRepository.findByPatientIdIgnoreCase("PAT-003").orElse(null);
            Patient p4 = patientRepository.findByPatientIdIgnoreCase("PAT-004").orElse(null);

            Appointment a1 = new Appointment(null, "APT-2026-001", 101, "Eleanor Vance", "+1 (555) 321-7654",
                    "Dr. Sarah Jenkins", "Cardiology", LocalDate.now(), "09:30 AM", "In-Person", "Confirmed", "Follow-up ECG consultation");
            a1.setDoctor(docJenkins);
            a1.setDepartmentEntity(cardDept);
            a1.setPatient(p1);
            appointmentRepository.save(a1);

            Appointment a2 = new Appointment(null, "APT-2026-002", 102, "David Kim", "+1 (555) 432-8765",
                    "Dr. Alexander Chen", "Neurology", LocalDate.now(), "11:00 AM", "In-Person", "Confirmed", "Neurological migraine assessment");
            a2.setDoctor(docChen);
            a2.setDepartmentEntity(neurDept);
            a2.setPatient(p2);
            appointmentRepository.save(a2);

            Appointment a3 = new Appointment(null, "APT-2026-003", 103, "Maria Gonzalez", "+1 (555) 543-9876",
                    "Dr. Aisha Patel", "Dermatology", LocalDate.now().plusDays(1), "02:15 PM", "Telehealth", "Pending", "Skin patch test review");
            a3.setDoctor(docPatel);
            a3.setDepartmentEntity(dermDept);
            a3.setPatient(p3);
            appointmentRepository.save(a3);

            Appointment a4 = new Appointment(null, "APT-2026-004", 104, "Robert Miller", "+1 (555) 654-0987",
                    "Dr. Marcus Vance", "Orthopedics", LocalDate.now().minusDays(1), "10:00 AM", "In-Person", "Completed", "Post-op rehabilitation review");
            a4.setDoctor(docVance);
            a4.setDepartmentEntity(orthDept);
            a4.setPatient(p4);
            appointmentRepository.save(a4);
        }

        if (invoiceRepository.count() == 0) {
            Department cardDept = departmentRepository.findByNameIgnoreCase("Cardiology").orElse(null);
            Department neurDept = departmentRepository.findByNameIgnoreCase("Neurology").orElse(null);
            Department orthDept = departmentRepository.findByNameIgnoreCase("Orthopedics").orElse(null);

            Patient p1 = patientRepository.findByPatientIdIgnoreCase("PAT-001").orElse(null);
            Patient p2 = patientRepository.findByPatientIdIgnoreCase("PAT-002").orElse(null);
            Patient p4 = patientRepository.findByPatientIdIgnoreCase("PAT-004").orElse(null);

            Invoice inv1 = new Invoice(null, "INV-8901", "Eleanor Vance", "Cardiology",
                    LocalDate.now().minusDays(2), new BigDecimal("450.00"), "Paid", "Credit Card", new ArrayList<>());
            inv1.setDepartmentEntity(cardDept);
            inv1.setPatient(p1);
            invoiceRepository.save(inv1);

            Invoice inv2 = new Invoice(null, "INV-8902", "David Kim", "Neurology",
                    LocalDate.now().minusDays(1), new BigDecimal("180.00"), "Pending", "Insurance", new ArrayList<>());
            inv2.setDepartmentEntity(neurDept);
            inv2.setPatient(p2);
            invoiceRepository.save(inv2);

            Invoice inv3 = new Invoice(null, "INV-8903", "Robert Miller", "Orthopedics",
                    LocalDate.now().minusDays(3), new BigDecimal("1250.00"), "Paid", "Direct Bank", new ArrayList<>());
            inv3.setDepartmentEntity(orthDept);
            inv3.setPatient(p4);
            invoiceRepository.save(inv3);
        }

        if (activityRepository.count() == 0) {
            activityRepository.save(new ActivityRecord(null, "bi-heart-pulse-fill", "text-danger",
                    "Cardiac Care Unit Admission", "Patient Eleanor Vance admitted under Dr. Sarah Jenkins for ECG telemetry monitoring."));
            activityRepository.save(new ActivityRecord(null, "bi-check2-circle", "text-success",
                    "Invoice Status Updated", "Invoice INV-8901 ($450.00) seeded with Paid status only. "
                            + "No payment was processed by MediCare."));
            activityRepository.save(new ActivityRecord(null, "bi-calendar-check-fill", "text-primary",
                    "Appointment Booked", "David Kim confirmed appointment with Dr. Alexander Chen (Token #102)."));
            activityRepository.save(new ActivityRecord(null, "bi-shield-check", "text-info",
                    "Security Initialization", "System booted in secure environment with role-based access control."));
        }
    }
}
