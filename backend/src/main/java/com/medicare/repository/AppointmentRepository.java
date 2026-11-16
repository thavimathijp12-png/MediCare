package com.medicare.repository;

import com.medicare.entity.Appointment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface AppointmentRepository extends JpaRepository<Appointment, Long> {
    Optional<Appointment> findByAppointmentIdIgnoreCase(String appointmentId);

    default Optional<Appointment> findByAppointmentId(String appointmentId) {
        return findByAppointmentIdIgnoreCase(appointmentId);
    }

    boolean existsByDoctorNameIgnoreCaseAndDateAndTimeIgnoreCaseAndStatusNot(
            String doctorName, LocalDate date, String time, String excludedStatus);

    boolean existsByDoctorNameIgnoreCaseAndDateAndTimeIgnoreCaseAndStatusNotAndAppointmentIdNot(
            String doctorName, LocalDate date, String time, String excludedStatus, String appointmentId);

    default boolean existsByDoctorAndDateAndTime(String doctorName, LocalDate date, String time) {
        return existsByDoctorNameIgnoreCaseAndDateAndTimeIgnoreCaseAndStatusNot(
                doctorName, date, time, "Cancelled");
    }

    long countByDoctorNameIgnoreCaseAndDate(String doctorName, LocalDate date);

    default int countTodayByDoctor(String doctorName, LocalDate date) {
        return Math.toIntExact(countByDoctorNameIgnoreCaseAndDate(doctorName, date));
    }

    long countByDate(LocalDate date);

    default long countToday(LocalDate date) {
        return countByDate(date);
    }

    List<Appointment> findByDoctor_IdOrderByDateAscTimeAsc(Long doctorId);

    List<Appointment> findByPatient_IdOrderByDateAscTimeAsc(Long patientId);

    @Query("select distinct a from Appointment a join a.patient p join p.assignedNurses n "
            + "where lower(n.email) = lower(?1) order by a.date, a.time")
    List<Appointment> findAllAssignedToNurse(String email);
}
