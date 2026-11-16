package com.medicare.repository;

import com.medicare.entity.NursingNote;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface NursingNoteRepository extends JpaRepository<NursingNote, Long> {
    List<NursingNote> findByPatient_IdOrderByCreatedAtDesc(Long patientId);

    Optional<NursingNote> findByIdAndPatient_Id(Long id, Long patientId);
}
