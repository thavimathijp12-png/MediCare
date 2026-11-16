package com.medicare.service;

import com.medicare.dto.PatientDto;
import com.medicare.entity.ActivityRecord;
import com.medicare.entity.Doctor;
import com.medicare.entity.Patient;
import com.medicare.entity.Role;
import com.medicare.entity.User;
import com.medicare.exception.BusinessRuleException;
import com.medicare.exception.ResourceNotFoundException;
import com.medicare.repository.ActivityRepository;
import com.medicare.repository.DoctorRepository;
import com.medicare.repository.PatientRepository;
import com.medicare.repository.UserRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class PatientService {

    private final PatientRepository patientRepository;
    private final ActivityRepository activityRepository;
    private final DoctorRepository doctorRepository;
    private final UserRepository userRepository;

    public PatientService(PatientRepository patientRepository,
                          ActivityRepository activityRepository,
                          DoctorRepository doctorRepository,
                          UserRepository userRepository) {
        this.patientRepository = patientRepository;
        this.activityRepository = activityRepository;
        this.doctorRepository = doctorRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<PatientDto> getAll(String query, String gender, String status) {
        return filterPatients(patientRepository.findAll(), query, gender, status);
    }

    @Transactional(readOnly = true)
    public List<PatientDto> getAllForStaff(String query, String gender, String status, String email, Role role) {
        List<Patient> patients;
        if (role == Role.ADMIN || role == Role.RECEPTIONIST) {
            patients = patientRepository.findAll();
        } else if (role == Role.DOCTOR) {
            User user = findUser(email);
            Doctor doctor = user.getDoctorProfile();
            if (doctor == null) {
                throw new AccessDeniedException("The staff account is not linked to a doctor profile.");
            }
            patients = patientRepository.findByAssignedDoctor_Id(doctor.getId());
        } else if (role == Role.NURSE) {
            patients = patientRepository.findDistinctByAssignedNurses_EmailIgnoreCase(email);
        } else {
            throw new AccessDeniedException("This role cannot access patient records.");
        }
        return filterPatients(patients, query, gender, status);
    }

    private List<PatientDto> filterPatients(List<Patient> patients, String query, String gender, String status) {
        return patients.stream()
                .filter(p -> query == null || query.trim().isEmpty() ||
                        p.getName().toLowerCase().contains(query.toLowerCase()) ||
                        p.getPatientId().toLowerCase().contains(query.toLowerCase()) ||
                        (p.getCondition() != null && p.getCondition().toLowerCase().contains(query.toLowerCase())))
                .filter(p -> gender == null || gender.trim().isEmpty() || p.getGender().equalsIgnoreCase(gender))
                .filter(p -> status == null || status.trim().isEmpty() || p.getStatus().equalsIgnoreCase(status))
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public PatientDto getById(String patientId) {
        Patient patient = patientRepository.findByPatientIdIgnoreCase(patientId)
                .orElseThrow(() -> new ResourceNotFoundException("Patient record " + patientId + " was not found."));
        return toDto(patient);
    }

    @Transactional(readOnly = true)
    public PatientDto getByIdForStaff(String patientId, String email, Role role) {
        Patient patient = patientRepository.findByPatientIdIgnoreCase(patientId)
                .orElseThrow(() -> new ResourceNotFoundException("Patient record " + patientId + " was not found."));
        ensureAssignedAccess(patient, email, role);
        return toDto(patient);
    }

    @Transactional
    public PatientDto save(PatientDto dto) {
        Patient patient;
        boolean isNew = false;

        if (dto.getId() != null && !dto.getId().trim().isEmpty()) {
            patient = patientRepository.findByPatientIdIgnoreCase(dto.getId().trim()).orElse(new Patient());
            if (patient.getPatientId() == null) {
                isNew = true;
                patient.setPatientId(dto.getId().trim());
            }
        } else {
            isNew = true;
            patient = new Patient();
            patient.setPatientId(String.format("PAT-%03d", patientRepository.count() + 1));
        }

        patient.setName(dto.getName());
        patient.setAge(dto.getAge());
        patient.setGender(dto.getGender());
        patient.setBloodGroup(dto.getBloodGroup());
        patient.setPhone(dto.getPhone());
        patient.setEmail(dto.getEmail());
        patient.setCondition(dto.getCondition());
        if (dto.getDoctor() == null || dto.getDoctor().isBlank()) {
            patient.setDoctor(null);
            patient.setAssignedDoctor(null);
        } else {
            Doctor doctor = doctorRepository.findByNameIgnoreCase(dto.getDoctor().trim())
                    .orElseThrow(() -> new ResourceNotFoundException("The selected doctor profile was not found."));
            patient.setDoctor(doctor.getName());
            patient.setAssignedDoctor(doctor);
        }
        patient.setStatus(dto.getStatus() != null ? dto.getStatus() : "Outpatient");
        patient.setAddress(dto.getAddress());

        if (isNew) {
            patient.setAdmissionDate(LocalDate.now());
            activityRepository.save(new ActivityRecord(
                    null,
                    "bi-person-plus",
                    "badge-mint",
                    "New Patient Registered",
                    patient.getName() + " was admitted to records with ID " + patient.getPatientId() + "."
            ));
        } else {
            activityRepository.save(new ActivityRecord(
                    null,
                    "bi-pencil-square",
                    "badge-blue",
                    "Patient Chart Updated",
                    "Medical chart updated for " + patient.getName() + " (" + patient.getPatientId() + ")."
            ));
        }

        Patient saved = patientRepository.save(patient);
        return toDto(saved);
    }

    @Transactional
    public PatientDto saveForStaff(PatientDto dto, String email, Role role) {
        if (role == Role.ADMIN || role == Role.RECEPTIONIST) {
            return save(dto);
        }
        if (role != Role.DOCTOR || dto.getId() == null) {
            throw new AccessDeniedException("This role cannot create or update this patient record.");
        }
        Patient existing = patientRepository.findByPatientIdIgnoreCase(dto.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Patient record " + dto.getId() + " was not found."));
        ensureAssignedAccess(existing, email, role);
        User user = findUser(email);
        if (user.getDoctorProfile() == null || dto.getDoctor() == null
                || !user.getDoctorProfile().getName().equalsIgnoreCase(dto.getDoctor().trim())) {
            throw new AccessDeniedException("A doctor may only retain their own assignment on this patient record.");
        }
        return save(dto);
    }

    @Transactional
    public void delete(String patientId) {
        Patient patient = patientRepository.findByPatientIdIgnoreCase(patientId)
                .orElseThrow(() -> new ResourceNotFoundException("Patient record " + patientId + " not found."));
        patientRepository.deleteByPatientIdIgnoreCase(patientId);

        activityRepository.save(new ActivityRecord(
                null,
                "bi-trash",
                "badge-pink",
                "Patient Record Archived",
                "Patient record for " + patient.getName() + " (" + patientId + ") was removed."
        ));
    }

    @Transactional
    public void assignNurse(String patientId, String nurseEmail) {
        Patient patient = patientRepository.findByPatientIdIgnoreCase(patientId)
                .orElseThrow(() -> new ResourceNotFoundException("Patient record " + patientId + " was not found."));
        User nurse = findUser(nurseEmail);
        if (nurse.getRole() != Role.NURSE) {
            throw new BusinessRuleException("Only a NURSE account may be assigned to a patient.");
        }
        patient.getAssignedNurses().add(nurse);
        patientRepository.save(patient);
    }

    private void ensureAssignedAccess(Patient patient, String email, Role role) {
        if (role == Role.ADMIN || role == Role.RECEPTIONIST) {
            return;
        }
        if (role == Role.DOCTOR) {
            User user = findUser(email);
            Doctor doctor = user.getDoctorProfile();
            if (doctor != null && patient.getAssignedDoctor() != null
                    && patient.getAssignedDoctor().getId().equals(doctor.getId())) {
                return;
            }
        } else if (role == Role.NURSE
                && patient.getAssignedNurses().stream()
                .anyMatch(nurse -> nurse.getEmail().equalsIgnoreCase(email))) {
            return;
        }
        throw new AccessDeniedException("The patient is not assigned to this staff account.");
    }

    private User findUser(String email) {
        return userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ResourceNotFoundException("The staff account was not found."));
    }

    public PatientDto toDto(Patient p) {
        PatientDto dto = new PatientDto();
        dto.setId(p.getPatientId());
        dto.setName(p.getName());
        dto.setAge(p.getAge());
        dto.setGender(p.getGender());
        dto.setBloodGroup(p.getBloodGroup());
        dto.setPhone(p.getPhone());
        dto.setEmail(p.getEmail());
        dto.setCondition(p.getCondition());
        dto.setDoctor(p.getDoctor() != null ? p.getDoctor() : "Unassigned");
        dto.setStatus(p.getStatus());
        dto.setAddress(p.getAddress());
        dto.setAdmissionDate(p.getAdmissionDate() != null ? p.getAdmissionDate().toString() : "");
        return dto;
    }
}

