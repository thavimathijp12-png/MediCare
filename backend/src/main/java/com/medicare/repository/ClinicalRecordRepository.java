package com.medicare.repository;

import com.medicare.entity.ClinicalRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ClinicalRecordRepository extends JpaRepository<ClinicalRecord, Long> {
    List<ClinicalRecord> findByPatient_IdOrderByRecordedAtDesc(Long patientId);

    Optional<ClinicalRecord> findByIdAndPatient_Id(Long id, Long patientId);
}
