package com.medicare.service;

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
import com.medicare.entity.CareTaskStatus;
import com.medicare.entity.ClinicalRecord;
import com.medicare.entity.Doctor;
import com.medicare.entity.NursingCareTask;
import com.medicare.entity.NursingNote;
import com.medicare.entity.Patient;
import com.medicare.entity.PatientVital;
import com.medicare.entity.Prescription;
import com.medicare.entity.Role;
import com.medicare.entity.User;
import com.medicare.exception.ResourceNotFoundException;
import com.medicare.repository.ClinicalRecordRepository;
import com.medicare.repository.NursingCareTaskRepository;
import com.medicare.repository.NursingNoteRepository;
import com.medicare.repository.PatientRepository;
import com.medicare.repository.PatientVitalRepository;
import com.medicare.repository.PrescriptionRepository;
import com.medicare.repository.UserRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class PatientClinicalDataService {

    private final PatientRepository patientRepository;
    private final UserRepository userRepository;
    private final ClinicalRecordRepository clinicalRecordRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final PatientVitalRepository patientVitalRepository;
    private final NursingNoteRepository nursingNoteRepository;
    private final NursingCareTaskRepository nursingCareTaskRepository;

    public PatientClinicalDataService(
            PatientRepository patientRepository,
            UserRepository userRepository,
            ClinicalRecordRepository clinicalRecordRepository,
            PrescriptionRepository prescriptionRepository,
            PatientVitalRepository patientVitalRepository,
            NursingNoteRepository nursingNoteRepository,
            NursingCareTaskRepository nursingCareTaskRepository) {
        this.patientRepository = patientRepository;
        this.userRepository = userRepository;
        this.clinicalRecordRepository = clinicalRecordRepository;
        this.prescriptionRepository = prescriptionRepository;
        this.patientVitalRepository = patientVitalRepository;
        this.nursingNoteRepository = nursingNoteRepository;
        this.nursingCareTaskRepository = nursingCareTaskRepository;
    }

    @Transactional(readOnly = true)
    public List<ClinicalRecordDto> getClinicalRecords(String patientId, String email, Role role) {
        Patient patient = requirePatientAccess(patientId, email, role);
        return clinicalRecordRepository.findByPatient_IdOrderByRecordedAtDesc(patient.getId())
                .stream().map(this::toDto).toList();
    }

    @Transactional
    public ClinicalRecordDto createClinicalRecord(
            String patientId, ClinicalRecordRequest request, String email, Role role) {
        Patient patient = requirePatientAccess(patientId, email, role);
        User author = findUser(email);
        LocalDateTime now = LocalDateTime.now();
        ClinicalRecord record = new ClinicalRecord();
        record.setPatient(patient);
        record.setAuthor(author);
        record.setRecordedAt(now);
        record.setUpdatedAt(now);
        apply(record, request);
        return toDto(clinicalRecordRepository.save(record));
    }

    @Transactional
    public ClinicalRecordDto updateClinicalRecord(
            String patientId, Long recordId, ClinicalRecordRequest request, String email, Role role) {
        Patient patient = requirePatientAccess(patientId, email, role);
        ClinicalRecord record = clinicalRecordRepository.findByIdAndPatient_Id(recordId, patient.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Clinical record was not found for this patient."));
        apply(record, request);
        record.setUpdatedAt(LocalDateTime.now());
        return toDto(clinicalRecordRepository.save(record));
    }

    @Transactional(readOnly = true)
    public List<PrescriptionDto> getPrescriptions(String patientId, String email, Role role) {
        Patient patient = requirePatientAccess(patientId, email, role);
        return prescriptionRepository.findByPatient_IdOrderByCreatedAtDesc(patient.getId())
                .stream().map(this::toDto).toList();
    }

    @Transactional
    public PrescriptionDto createPrescription(
            String patientId, PrescriptionRequest request, String email, Role role) {
        Patient patient = requirePatientAccess(patientId, email, role);
        User author = findUser(email);
        LocalDateTime now = LocalDateTime.now();
        Prescription prescription = new Prescription();
        prescription.setPatient(patient);
        prescription.setAuthor(author);
        prescription.setCreatedAt(now);
        prescription.setUpdatedAt(now);
        apply(prescription, request);
        return toDto(prescriptionRepository.save(prescription));
    }

    @Transactional
    public PrescriptionDto updatePrescription(
            String patientId, Long prescriptionId, PrescriptionRequest request, String email, Role role) {
        Patient patient = requirePatientAccess(patientId, email, role);
        Prescription prescription = prescriptionRepository.findByIdAndPatient_Id(prescriptionId, patient.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Prescription was not found for this patient."));
        apply(prescription, request);
        prescription.setUpdatedAt(LocalDateTime.now());
        return toDto(prescriptionRepository.save(prescription));
    }

    @Transactional(readOnly = true)
    public List<PatientVitalDto> getVitals(String patientId, String email, Role role) {
        Patient patient = requirePatientAccess(patientId, email, role);
        return patientVitalRepository.findByPatient_IdOrderByRecordedAtDesc(patient.getId())
                .stream().map(this::toDto).toList();
    }

    @Transactional
    public PatientVitalDto createVital(
            String patientId, PatientVitalRequest request, String email, Role role) {
        Patient patient = requirePatientAccess(patientId, email, role);
        PatientVital vital = new PatientVital();
        vital.setPatient(patient);
        vital.setAuthor(findUser(email));
        apply(vital, request);
        return toDto(patientVitalRepository.save(vital));
    }

    @Transactional
    public PatientVitalDto updateVital(
            String patientId, Long vitalId, PatientVitalRequest request, String email, Role role) {
        Patient patient = requirePatientAccess(patientId, email, role);
        PatientVital vital = patientVitalRepository.findByIdAndPatient_Id(vitalId, patient.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Vital sign was not found for this patient."));
        apply(vital, request);
        return toDto(patientVitalRepository.save(vital));
    }

    @Transactional(readOnly = true)
    public List<NursingNoteDto> getNursingNotes(String patientId, String email, Role role) {
        Patient patient = requirePatientAccess(patientId, email, role);
        return nursingNoteRepository.findByPatient_IdOrderByCreatedAtDesc(patient.getId())
                .stream().map(this::toDto).toList();
    }

    @Transactional
    public NursingNoteDto createNursingNote(
            String patientId, NursingNoteRequest request, String email, Role role) {
        Patient patient = requirePatientAccess(patientId, email, role);
        User author = findUser(email);
        LocalDateTime now = LocalDateTime.now();
        NursingNote note = new NursingNote();
        note.setPatient(patient);
        note.setAuthor(author);
        note.setCreatedAt(now);
        note.setUpdatedAt(now);
        note.setContent(request.content().trim());
        return toDto(nursingNoteRepository.save(note));
    }

    @Transactional
    public NursingNoteDto updateNursingNote(
            String patientId, Long noteId, NursingNoteRequest request, String email, Role role) {
        Patient patient = requirePatientAccess(patientId, email, role);
        NursingNote note = nursingNoteRepository.findByIdAndPatient_Id(noteId, patient.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Nursing note was not found for this patient."));
        note.setContent(request.content().trim());
        note.setUpdatedAt(LocalDateTime.now());
        return toDto(nursingNoteRepository.save(note));
    }

    @Transactional(readOnly = true)
    public List<NursingCareTaskDto> getCareTasks(String patientId, String email, Role role) {
        Patient patient = requirePatientAccess(patientId, email, role);
        return nursingCareTaskRepository.findByPatient_IdOrderByCreatedAtDesc(patient.getId())
                .stream().map(this::toDto).toList();
    }

    @Transactional
    public NursingCareTaskDto createCareTask(
            String patientId, NursingCareTaskRequest request, String email, Role role) {
        Patient patient = requirePatientAccess(patientId, email, role);
        User author = findUser(email);
        LocalDateTime now = LocalDateTime.now();
        NursingCareTask task = new NursingCareTask();
        task.setPatient(patient);
        task.setCreatedBy(author);
        task.setDescription(request.description().trim());
        task.setStatus(CareTaskStatus.PENDING);
        task.setCreatedAt(now);
        task.setUpdatedAt(now);
        return toDto(nursingCareTaskRepository.save(task));
    }

    @Transactional
    public NursingCareTaskDto updateCareTaskStatus(
            String patientId, Long taskId, CareTaskStatus status, String email, Role role) {
        Patient patient = requirePatientAccess(patientId, email, role);
        NursingCareTask task = nursingCareTaskRepository.findByIdAndPatient_Id(taskId, patient.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Care task was not found for this patient."));
        task.setStatus(status);
        task.setUpdatedAt(LocalDateTime.now());
        return toDto(nursingCareTaskRepository.save(task));
    }

    private Patient requirePatientAccess(String patientId, String email, Role role) {
        if (role != Role.ADMIN && role != Role.DOCTOR && role != Role.NURSE && role != Role.PATIENT) {
            throw new AccessDeniedException("This role cannot access clinical care records.");
        }
        Patient patient = patientRepository.findByPatientIdIgnoreCase(patientId)
                .orElseThrow(() -> new ResourceNotFoundException("Patient record " + patientId + " was not found."));
        if (role == Role.ADMIN) {
            return patient;
        }
        if (role == Role.PATIENT) {
            if (patient.getPatientAccount() != null
                    && patient.getPatientAccount().getEmail().equalsIgnoreCase(email)) {
                return patient;
            }
            throw new AccessDeniedException("The patient record is not linked to this account.");
        }

        User user = findUser(email);
        if (role == Role.DOCTOR) {
            Doctor doctor = user.getDoctorProfile();
            if (doctor != null && patient.getAssignedDoctor() != null
                    && patient.getAssignedDoctor().getId().equals(doctor.getId())) {
                return patient;
            }
        } else if (patient.getAssignedNurses().stream()
                .anyMatch(nurse -> nurse.getId().equals(user.getId()))) {
            return patient;
        }
        throw new AccessDeniedException("The patient is not assigned to this staff account.");
    }

    private User findUser(String email) {
        return userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ResourceNotFoundException("The staff account was not found."));
    }

    private void apply(ClinicalRecord record, ClinicalRecordRequest request) {
        record.setDiagnosis(request.diagnosis().trim());
        record.setClinicalNote(request.clinicalNote().trim());
        record.setAllergies(request.allergies() == null ? "" : request.allergies().trim());
    }

    private void apply(Prescription prescription, PrescriptionRequest request) {
        prescription.setMedication(request.medication().trim());
        prescription.setStrength(request.strength().trim());
        prescription.setDose(request.dose().trim());
        prescription.setRoute(request.route().trim());
        prescription.setFrequency(request.frequency().trim());
        prescription.setDuration(request.duration().trim());
        prescription.setRefills(request.refills());
        prescription.setStatus(request.status().trim());
    }

    private void apply(PatientVital vital, PatientVitalRequest request) {
        vital.setType(request.type());
        vital.setValue(request.value());
        vital.setRecordedAt(LocalDateTime.now());
    }

    private ClinicalRecordDto toDto(ClinicalRecord record) {
        return new ClinicalRecordDto(
                record.getId(), record.getDiagnosis(), record.getClinicalNote(), record.getAllergies(),
                record.getAuthor().getFullName(), record.getRecordedAt(), record.getUpdatedAt());
    }

    private PrescriptionDto toDto(Prescription prescription) {
        return new PrescriptionDto(
                prescription.getId(), prescription.getMedication(), prescription.getStrength(),
                prescription.getDose(), prescription.getRoute(), prescription.getFrequency(),
                prescription.getDuration(), prescription.getRefills(), prescription.getStatus(),
                prescription.getAuthor().getFullName(), prescription.getCreatedAt(), prescription.getUpdatedAt());
    }

    private PatientVitalDto toDto(PatientVital vital) {
        return new PatientVitalDto(
                vital.getId(), vital.getType(), vital.getValue(), vital.getType().getUnit(),
                vital.getAuthor().getFullName(), vital.getRecordedAt());
    }

    private NursingNoteDto toDto(NursingNote note) {
        return new NursingNoteDto(
                note.getId(), note.getContent(), note.getAuthor().getFullName(),
                note.getCreatedAt(), note.getUpdatedAt());
    }

    private NursingCareTaskDto toDto(NursingCareTask task) {
        return new NursingCareTaskDto(
                task.getId(), task.getDescription(), task.getStatus(), task.getCreatedBy().getFullName(),
                task.getCreatedAt(), task.getUpdatedAt());
    }
}
