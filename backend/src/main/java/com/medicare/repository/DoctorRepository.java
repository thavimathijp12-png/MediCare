package com.medicare.repository;

import com.medicare.entity.Doctor;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DoctorRepository extends JpaRepository<Doctor, Long> {
    Optional<Doctor> findByDoctorIdIgnoreCase(String doctorId);

    Optional<Doctor> findByNameIgnoreCase(String name);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from Doctor d where lower(d.name) = lower(:name)")
    Optional<Doctor> findForAppointmentBooking(@Param("name") String name);

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
