package com.medicare.repository;

import com.medicare.entity.Prescription;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PrescriptionRepository extends JpaRepository<Prescription, Long> {
    List<Prescription> findByPatient_IdOrderByCreatedAtDesc(Long patientId);

    Optional<Prescription> findByIdAndPatient_Id(Long id, Long patientId);
}
