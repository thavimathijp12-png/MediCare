package com.medicare.repository;

import com.medicare.entity.Patient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PatientRepository extends JpaRepository<Patient, Long> {
    Optional<Patient> findByPatientIdIgnoreCase(String patientId);

    Optional<Patient> findByPatientAccount_EmailIgnoreCase(String email);

    default Optional<Patient> findByPatientId(String patientId) {
        return findByPatientIdIgnoreCase(patientId);
    }

    void deleteByPatientIdIgnoreCase(String patientId);

    default void deleteByPatientId(String patientId) {
        deleteByPatientIdIgnoreCase(patientId);
    }

    List<Patient> findDistinctByAssignedNurses_EmailIgnoreCase(String email);

    List<Patient> findByAssignedDoctor_Id(Long doctorId);

    Optional<Patient> findFirstByNameIgnoreCaseAndPhone(String name, String phone);

    List<Patient> findAllByNameIgnoreCase(String name);
}
