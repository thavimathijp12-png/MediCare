package com.medicare.repository;

import com.medicare.entity.PatientVital;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PatientVitalRepository extends JpaRepository<PatientVital, Long> {
    List<PatientVital> findByPatient_IdOrderByRecordedAtDesc(Long patientId);

    Optional<PatientVital> findByIdAndPatient_Id(Long id, Long patientId);
}
