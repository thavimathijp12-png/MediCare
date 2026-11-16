package com.medicare.repository;

import com.medicare.entity.NursingCareTask;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface NursingCareTaskRepository extends JpaRepository<NursingCareTask, Long> {
    List<NursingCareTask> findByPatient_IdOrderByCreatedAtDesc(Long patientId);

    Optional<NursingCareTask> findByIdAndPatient_Id(Long id, Long patientId);
}
