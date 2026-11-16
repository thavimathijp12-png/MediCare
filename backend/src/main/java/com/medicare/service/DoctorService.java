package com.medicare.service;

import com.medicare.dto.DoctorDto;
import com.medicare.entity.ActivityRecord;
import com.medicare.entity.Department;
import com.medicare.entity.Doctor;
import com.medicare.exception.ResourceNotFoundException;
import com.medicare.repository.ActivityRepository;
import com.medicare.repository.DepartmentRepository;
import com.medicare.repository.DoctorRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class DoctorService {

    private final DoctorRepository doctorRepository;
    private final ActivityRepository activityRepository;
    private final DepartmentRepository departmentRepository;

    public DoctorService(DoctorRepository doctorRepository,
                         ActivityRepository activityRepository,
                         DepartmentRepository departmentRepository) {
        this.doctorRepository = doctorRepository;
        this.activityRepository = activityRepository;
        this.departmentRepository = departmentRepository;
    }

    @Transactional(readOnly = true)
    public List<DoctorDto> getAll(String query, String department, String status) {
        return doctorRepository.findAll().stream()
                .filter(d -> query == null || query.trim().isEmpty() ||
                        d.getName().toLowerCase().contains(query.toLowerCase()) ||
                        d.getDoctorId().toLowerCase().contains(query.toLowerCase()) ||
                        (d.getDepartment() != null && d.getDepartment().toLowerCase().contains(query.toLowerCase())))
                .filter(d -> department == null || department.trim().isEmpty() || d.getDepartment().equalsIgnoreCase(department.trim()))
                .filter(d -> status == null || status.trim().isEmpty() || d.getStatus().equalsIgnoreCase(status.trim()))
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public DoctorDto getById(String doctorId) {
        Doctor doc = doctorRepository.findByDoctorIdIgnoreCase(doctorId)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor " + doctorId + " not found."));
        return toDto(doc);
    }

    @Transactional
    public DoctorDto save(DoctorDto dto) {
        Doctor doctor;
        boolean isNew = false;

        if (dto.getId() != null && !dto.getId().trim().isEmpty()) {
            doctor = doctorRepository.findByDoctorIdIgnoreCase(dto.getId().trim()).orElse(new Doctor());
            if (doctor.getDoctorId() == null) {
                isNew = true;
                doctor.setDoctorId(dto.getId().trim());
            }
        } else {
            isNew = true;
            doctor = new Doctor();
            doctor.setDoctorId(String.format("DOC-%03d", 100 + doctorRepository.count() + 1));
        }

        doctor.setName(dto.getName());
        doctor.setDepartment(dto.getDepartment());
        Department department = dto.getDepartment() == null
                ? null
                : departmentRepository.findByNameIgnoreCase(dto.getDepartment()).orElse(null);
        doctor.setDepartmentEntity(department);
        doctor.setDegree(dto.getDegree());
        if (dto.getExperience() != null) {
            try {
                doctor.setExperienceYears(Integer.parseInt(dto.getExperience().replaceAll("[^0-9]", "")));
            } catch (Exception ignored) {
                doctor.setExperienceYears(10);
            }
        }
        doctor.setConsultationFee(dto.getFee() != null ? dto.getFee() : BigDecimal.valueOf(120));
        doctor.setPhone(dto.getPhone());
        doctor.setEmail(dto.getEmail());
        doctor.setStatus(dto.getStatus() != null ? dto.getStatus() : "Available");
        doctor.setRating(dto.getRating() != null ? dto.getRating() : BigDecimal.valueOf(4.90));
        doctor.setReviewCount(dto.getReviews() > 0 ? dto.getReviews() : 50);
        doctor.setImageUrl(dto.getImage());
        doctor.setBiography(dto.getAbout());

        Doctor saved = doctorRepository.save(doctor);

        if (isNew) {
            activityRepository.save(new ActivityRecord(
                    null,
                    "bi-person-badge",
                    "badge-mint",
                    "Physician Onboarded",
                    doctor.getName() + " joined the " + doctor.getDepartment() + " faculty (" + doctor.getDoctorId() + ")."
            ));
        } else {
            activityRepository.save(new ActivityRecord(
                    null,
                    "bi-pencil-square",
                    "badge-blue",
                    "Doctor Profile Updated",
                    "Details updated for " + doctor.getName() + " (" + doctor.getDoctorId() + ")."
            ));
        }

        return toDto(saved);
    }

    @Transactional
    public void delete(String doctorId) {
        Doctor doc = doctorRepository.findByDoctorIdIgnoreCase(doctorId)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor " + doctorId + " not found."));
        doctorRepository.deleteByDoctorIdIgnoreCase(doctorId);

        activityRepository.save(new ActivityRecord(
                null,
                "bi-trash",
                "badge-pink",
                "Doctor Removed",
                doc.getName() + " (" + doctorId + ") was removed from the roster."
        ));
    }

    private DoctorDto toDto(Doctor d) {
        DoctorDto dto = new DoctorDto();
        dto.setId(d.getDoctorId());
        dto.setName(d.getName());
        dto.setDepartment(d.getDepartment());
        dto.setDegree(d.getDegree());
        dto.setExperience(d.getExperienceYears() + " Years");
        dto.setFee(d.getConsultationFee());
        dto.setPhone(d.getPhone());
        dto.setEmail(d.getEmail());
        dto.setStatus(d.getStatus());
        dto.setRating(d.getRating());
        dto.setReviews(d.getReviewCount());
        dto.setImage(d.getImageUrl());
        dto.setAbout(d.getBiography());
        return dto;
    }
}
