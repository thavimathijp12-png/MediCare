
package com.medicare.service;

import com.medicare.dto.AppointmentDto;
import com.medicare.entity.ActivityRecord;
import com.medicare.entity.Appointment;
import com.medicare.entity.Department;
import com.medicare.entity.Doctor;
import com.medicare.entity.Patient;
import com.medicare.entity.Role;
import com.medicare.entity.User;
import com.medicare.exception.BusinessRuleException;
import com.medicare.exception.ResourceNotFoundException;
import com.medicare.repository.ActivityRepository;
import com.medicare.repository.AppointmentRepository;
import com.medicare.repository.DepartmentRepository;
import com.medicare.repository.DoctorRepository;
import com.medicare.repository.PatientRepository;
import com.medicare.repository.UserRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AppointmentService {

    private final AppointmentRepository appointmentRepository;
    private final DoctorRepository doctorRepository;
    private final ActivityRepository activityRepository;
    private final DepartmentRepository departmentRepository;
    private final PatientRepository patientRepository;
    private final UserRepository userRepository;

    public AppointmentService(AppointmentRepository appointmentRepository,
                              DoctorRepository doctorRepository,
                              ActivityRepository activityRepository,
                              DepartmentRepository departmentRepository,
                              PatientRepository patientRepository,
                              UserRepository userRepository) {
        this.appointmentRepository = appointmentRepository;
        this.doctorRepository = doctorRepository;
        this.activityRepository = activityRepository;
        this.departmentRepository = departmentRepository;
        this.patientRepository = patientRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<AppointmentDto> getAll(String query, String status, String department) {
        return filterAppointments(appointmentRepository.findAll(), query, status, department);
    }

    @Transactional(readOnly = true)
    public List<AppointmentDto> getAllForStaff(
            String query, String status, String department, String email, Role role) {

        List<Appointment> appointments;

        if (role == Role.ADMIN || role == Role.RECEPTIONIST) {
            appointments = appointmentRepository.findAll();
        } else if (role == Role.DOCTOR) {
            User user = findUser(email);

            if (user.getDoctorProfile() == null) {
                throw new AccessDeniedException(
                        "The staff account is not linked to a doctor profile.");
            }

            appointments = appointmentRepository.findByDoctor_IdOrderByDateAscTimeAsc(
                    user.getDoctorProfile().getId());

        } else if (role == Role.NURSE) {
            appointments = appointmentRepository.findAllAssignedToNurse(email);
        } else {
            throw new AccessDeniedException(
                    "This role cannot access staff appointments.");
        }

        return filterAppointments(appointments, query, status, department);
    }

    private List<AppointmentDto> filterAppointments(
            List<Appointment> appointments, String query, String status, String department) {

        return appointments.stream()
                .filter(a -> query == null || query.trim().isEmpty()
                        || a.getPatientName().toLowerCase().contains(query.toLowerCase())
                        || a.getDoctorName().toLowerCase().contains(query.toLowerCase())
                        || a.getAppointmentId().toLowerCase().contains(query.toLowerCase()))
                .filter(a -> status == null || status.trim().isEmpty()
                        || a.getStatus().equalsIgnoreCase(status.trim()))
                .filter(a -> department == null || department.trim().isEmpty()
                        || (a.getDepartment() != null
                        && a.getDepartment().equalsIgnoreCase(department.trim())))
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public AppointmentDto getById(String appointmentId) {

        Appointment appointment = appointmentRepository
                .findByAppointmentIdIgnoreCase(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Appointment " + appointmentId + " was not found."));

        return toDto(appointment);
    }

    @Transactional(readOnly = true)
    public AppointmentDto getByIdForStaff(
            String appointmentId, String email, Role role) {

        Appointment appointment = appointmentRepository
                .findByAppointmentIdIgnoreCase(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Appointment " + appointmentId + " was not found."));

        boolean assigned = role == Role.ADMIN || role == Role.RECEPTIONIST
                || (role == Role.DOCTOR
                && appointment.getDoctor() != null
                && isAssignedDoctor(email, appointment.getDoctor().getId()))
                || (role == Role.NURSE
                && appointment.getPatient() != null
                && appointment.getPatient().getAssignedNurses().stream()
                .anyMatch(nurse -> nurse.getEmail().equalsIgnoreCase(email)));

        if (!assigned) {
            throw new AccessDeniedException(
                    "The appointment is not assigned to this staff account.");
        }

        return toDto(appointment);
    }

    @Transactional(readOnly = true)
    public List<AppointmentDto> getForPatientAccount(String email) {

        Patient patient = patientRepository
                .findByPatientAccount_EmailIgnoreCase(email)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "The patient profile was not found."));

        return appointmentRepository
                .findByPatient_IdOrderByDateAscTimeAsc(patient.getId())
                .stream()
                .map(this::toDto)
                .toList();
    }

    public AppointmentDto book(AppointmentDto dto) {
        return book(dto, Role.ADMIN);
    }

    @Transactional
    public AppointmentDto book(AppointmentDto dto, Role requestRole) {
        return book(dto, requestRole, null);
    }

    @Transactional
    public AppointmentDto bookForPatient(AppointmentDto dto, String email) {

        if (dto == null) {
            throw new BusinessRuleException("Appointment details are required.");
        }

        Patient patient = patientRepository
                .findByPatientAccount_EmailIgnoreCase(email)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "The patient profile was not found."));

        dto.setPatientName(patient.getName());
        dto.setPatientPhone(patient.getPhone());

        return book(dto, Role.PATIENT, patient);
    }

    // Validate appointment request fields
    private void validateAppointmentInput(AppointmentDto dto) {

        if (dto == null) {
            throw new BusinessRuleException("Appointment details are required.");
        }

        if (dto.getDate() == null || dto.getDate().isBlank()) {
            throw new BusinessRuleException("Appointment date is required.");
        }

        if (dto.getTime() == null || dto.getTime().isBlank()) {
            throw new BusinessRuleException("Appointment time is required.");
        }

        if (dto.getDoctorName() == null || dto.getDoctorName().isBlank()) {
            throw new BusinessRuleException("Doctor name is required.");
        }

        if (dto.getPatientName() == null || dto.getPatientName().isBlank()) {
            throw new BusinessRuleException("Patient name is required.");
        }
    }

    private AppointmentDto book(
            AppointmentDto dto, Role requestRole, Patient patientAccount) {

        validateAppointmentInput(dto);

        LocalDate appointmentDate;

        try {
            appointmentDate = LocalDate.parse(dto.getDate().trim());
        } catch (DateTimeParseException e) {
            throw new BusinessRuleException(
                    "Invalid date format. Expected YYYY-MM-DD (e.g. 2026-11-15).");
        }

        if (appointmentDate.isBefore(LocalDate.now())) {
            throw new BusinessRuleException(
                    "Appointment date cannot be in the past.");
        }

        // Validate doctor existence and availability
        Optional<Doctor> doctorOptional =
                doctorRepository.findForAppointmentBooking(dto.getDoctorName());

        Doctor doctor = doctorOptional.orElseThrow(
                () -> new ResourceNotFoundException(
                        "The selected doctor was not found."));

        String department = doctor.getDepartment();

        if ("In Surgery".equalsIgnoreCase(doctor.getStatus())
                && appointmentDate.equals(LocalDate.now())) {

            throw new BusinessRuleException(
                    "The selected doctor is in surgery today. Please choose another time or date.");
        }

        if ("On Leave".equalsIgnoreCase(doctor.getStatus())) {
            throw new BusinessRuleException(
                    "The selected doctor is on scheduled leave.");
        }

        // Check for double booking
        if (appointmentRepository
                .existsByDoctorNameIgnoreCaseAndDateAndTimeIgnoreCaseAndStatusNot(
                        doctor.getName(),
                        appointmentDate,
                        dto.getTime().trim(),
                        "Cancelled")) {

            throw new BusinessRuleException(
                    "The selected doctor already has an appointment booked on "
                            + appointmentDate + " at " + dto.getTime()
                            + ". Please choose another time slot.");
        }

        // Calculate daily token number
        int tokenNumber = Math.toIntExact(
                appointmentRepository.countByDoctorNameIgnoreCaseAndDate(
                        doctor.getName(), appointmentDate)) + 1;

        Appointment appointment = new Appointment();

        appointment.setAppointmentId(
                "APT-" + LocalDate.now().getYear() + "-"
                        + UUID.randomUUID().toString()
                        .substring(0, 8).toUpperCase());

        appointment.setTokenNumber(tokenNumber);
        appointment.setPatientName(dto.getPatientName().trim());
        appointment.setPatientPhone(
                dto.getPatientPhone() != null
                        ? dto.getPatientPhone().trim()
                        : "N/A");

        appointment.setDoctorName(doctor.getName());
        appointment.setDoctor(doctor);
        appointment.setDepartment(department);

        Department departmentEntity = departmentRepository
                .findByNameIgnoreCase(department)
                .orElse(null);

        appointment.setDepartmentEntity(departmentEntity);

        Patient linkedPatient = patientAccount;

        if (linkedPatient == null
                && requestRole != null
                && requestRole != Role.PATIENT
                && dto.getPatientId() != null
                && !dto.getPatientId().isBlank()) {

            linkedPatient = patientRepository
                    .findByPatientIdIgnoreCase(dto.getPatientId().trim())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "The selected patient record was not found."));
        }

        appointment.setPatient(linkedPatient);
        appointment.setDate(appointmentDate);
        appointment.setTime(dto.getTime().trim());

        appointment.setType(
                dto.getType() != null ? dto.getType() : "In-Person");

        boolean maySetStatus =
                requestRole == Role.ADMIN || requestRole == Role.RECEPTIONIST;

        appointment.setStatus(
                maySetStatus && dto.getStatus() != null
                        ? dto.getStatus()
                        : "Pending");

        appointment.setReason(
                dto.getReason() != null
                        ? dto.getReason()
                        : "General Consultation");

        Appointment saved = appointmentRepository.save(appointment);

        // Record activity log
        activityRepository.save(new ActivityRecord(
                null,
                "bi-calendar-check",
                "badge-blue",
                "Appointment Scheduled",
                saved.getPatientName() + " booked with "
                        + saved.getDoctorName() + " on "
                        + saved.getDate() + " at "
                        + saved.getTime() + " (Token #"
                        + saved.getTokenNumber() + ")."
        ));

        return toDto(saved);
    }

    @Transactional
    public AppointmentDto updateDetails(
            String appointmentId, AppointmentDto dto) {

        validateAppointmentInput(dto);

        Appointment appointment = appointmentRepository
                .findByAppointmentIdIgnoreCase(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Appointment " + appointmentId + " was not found."));

        LocalDate appointmentDate;

        try {
            appointmentDate = LocalDate.parse(dto.getDate().trim());
        } catch (DateTimeParseException e) {
            throw new BusinessRuleException(
                    "Invalid date format. Expected YYYY-MM-DD.");
        }

        if (appointmentDate.isBefore(LocalDate.now())) {
            throw new BusinessRuleException(
                    "Appointment date cannot be in the past.");
        }

        Doctor doctor = doctorRepository
                .findForAppointmentBooking(dto.getDoctorName())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "The selected doctor was not found."));

        if ("On Leave".equalsIgnoreCase(doctor.getStatus())
                || ("In Surgery".equalsIgnoreCase(doctor.getStatus())
                && appointmentDate.equals(LocalDate.now()))) {

            throw new BusinessRuleException(
                    "The selected doctor is not available for that appointment date.");
        }

        if (appointmentRepository
                .existsByDoctorNameIgnoreCaseAndDateAndTimeIgnoreCaseAndStatusNotAndAppointmentIdNot(
                        doctor.getName(),
                        appointmentDate,
                        dto.getTime().trim(),
                        "Cancelled",
                        appointmentId)) {

            throw new BusinessRuleException(
                    "The selected doctor already has an appointment at that time.");
        }

        appointment.setPatientName(dto.getPatientName().trim());

        appointment.setPatientPhone(
                dto.getPatientPhone() != null
                        ? dto.getPatientPhone().trim()
                        : "N/A");

        appointment.setPatient(
                dto.getPatientId() != null && !dto.getPatientId().isBlank()
                        ? patientRepository
                        .findByPatientIdIgnoreCase(dto.getPatientId().trim())
                        .orElseThrow(() -> new ResourceNotFoundException(
                                "The selected patient record was not found."))
                        : null);

        appointment.setDoctorName(doctor.getName());
        appointment.setDoctor(doctor);
        appointment.setDepartment(doctor.getDepartment());

        appointment.setDepartmentEntity(
                departmentRepository
                        .findByNameIgnoreCase(doctor.getDepartment())
                        .orElse(null));

        appointment.setDate(appointmentDate);
        appointment.setTime(dto.getTime().trim());

        appointment.setType(
                dto.getType() != null ? dto.getType() : "In-Person");

        appointment.setReason(
                dto.getReason() != null
                        ? dto.getReason()
                        : "General Consultation");

        if (dto.getStatus() != null) {

            String normalizedStatus = dto.getStatus().trim().toLowerCase();

            if (!List.of(
                    "pending", "confirmed", "completed", "cancelled")
                    .contains(normalizedStatus)) {

                throw new BusinessRuleException(
                        "Appointment status must be Pending, Confirmed, Completed, or Cancelled.");
            }

            appointment.setStatus(
                    normalizedStatus.substring(0, 1).toUpperCase()
                            + normalizedStatus.substring(1));
        }

        Appointment saved = appointmentRepository.save(appointment);

        activityRepository.save(new ActivityRecord(
                null,
                "bi-calendar2-check",
                "badge-blue",
                "Appointment Updated",
                "Appointment " + appointmentId + " details were updated."
        ));

        return toDto(saved);
    }

    @Transactional
    public AppointmentDto updateStatus(
            String appointmentId, String newStatus) {

        if (newStatus == null || newStatus.isBlank()) {
            throw new BusinessRuleException(
                    "Appointment status is required.");
        }

        String normalizedStatus = newStatus.trim().toLowerCase();

        if (!List.of(
                "pending", "confirmed", "completed", "cancelled")
                .contains(normalizedStatus)) {

            throw new BusinessRuleException(
                    "Appointment status must be Pending, Confirmed, Completed, or Cancelled.");
        }

        Appointment appointment = appointmentRepository
                .findByAppointmentIdIgnoreCase(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Appointment " + appointmentId + " was not found."));

        appointment.setStatus(
                normalizedStatus.substring(0, 1).toUpperCase()
                        + normalizedStatus.substring(1));

        appointmentRepository.save(appointment);

        activityRepository.save(new ActivityRecord(
                null,
                "bi-arrow-repeat",
                "badge-lavender",
                "Appointment Status Updated",
                "Appointment " + appointmentId + " marked as "
                        + newStatus + "."
        ));

        return toDto(appointment);
    }

    @Transactional
    public void cancel(String appointmentId) {
        updateStatus(appointmentId, "Cancelled");
    }

    @Transactional
    public AppointmentDto cancelForPatient(String appointmentId, String email) {
        Patient patient = patientRepository
                .findByPatientAccount_EmailIgnoreCase(email)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "The patient profile was not found."));
        Appointment appointment = appointmentRepository
                .findByAppointmentIdIgnoreCase(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Appointment " + appointmentId + " was not found."));

        if (appointment.getPatient() == null
                || !appointment.getPatient().getId().equals(patient.getId())) {
            throw new AccessDeniedException(
                    "The appointment is not linked to this patient account.");
        }

        return updateStatus(appointmentId, "Cancelled");
    }

    private User findUser(String email) {
        return userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "The staff account was not found."));
    }

    private boolean isAssignedDoctor(String email, Long doctorId) {
        return userRepository.findByEmailIgnoreCase(email)
                .map(User::getDoctorProfile)
                .map(doctor -> doctor.getId().equals(doctorId))
                .orElse(false);
    }

    private AppointmentDto toDto(Appointment appointment) {

        AppointmentDto dto = new AppointmentDto();

        dto.setId(appointment.getAppointmentId());

        dto.setPatientId(
                appointment.getPatient() != null
                        ? appointment.getPatient().getPatientId()
                        : null);

        dto.setTokenNumber(appointment.getTokenNumber());
        dto.setPatientName(appointment.getPatientName());
        dto.setPatientPhone(appointment.getPatientPhone());
        dto.setDoctorName(appointment.getDoctorName());
        dto.setDepartment(appointment.getDepartment());

        dto.setDate(
                appointment.getDate() != null
                        ? appointment.getDate().toString()
                        : "");

        dto.setTime(appointment.getTime());
        dto.setType(appointment.getType());
        dto.setStatus(appointment.getStatus());
        dto.setReason(appointment.getReason());

        return dto;
    }
}
