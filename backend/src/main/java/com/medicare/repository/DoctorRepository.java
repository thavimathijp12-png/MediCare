package com.medicare.repository;

import com.medicare.entity.Doctor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DoctorRepository extends JpaRepository<Doctor, Long> {
    Optional<Doctor> findByDoctorIdIgnoreCase(String doctorId);

    Optional<Doctor> findByNameIgnoreCase(String name);

    default Optional<Doctor> findByDoctorId(String doctorId) {
        return findByDoctorIdIgnoreCase(doctorId);
    }

    default Optional<Doctor> findByName(String name) {
        return findByNameIgnoreCase(name);
    }

    void deleteByDoctorIdIgnoreCase(String doctorId);

    default void deleteByDoctorId(String doctorId) {
        deleteByDoctorIdIgnoreCase(doctorId);
    }

    long countByStatusIgnoreCase(String status);

    default long countAvailable() {
        return countByStatusIgnoreCase("Available");
    }
}
