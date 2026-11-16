package com.medicare.service;

import com.medicare.dto.AppointmentDto;
import com.medicare.entity.Department;
import com.medicare.entity.Doctor;
import com.medicare.exception.BusinessRuleException;
import com.medicare.repository.ActivityRepository;
import com.medicare.repository.AppointmentRepository;
import com.medicare.repository.DepartmentRepository;
import com.medicare.repository.DoctorRepository;
import com.medicare.repository.PatientRepository;
import com.medicare.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AppointmentServiceTest {
    private AppointmentRepository appointmentRepository;
    private DoctorRepository doctorRepository;
    private ActivityRepository activityRepository;
    private DepartmentRepository departmentRepository;
    private PatientRepository patientRepository;
    private AppointmentService appointmentService;

    @BeforeEach
    void setUp() {
        appointmentRepository = mock(AppointmentRepository.class);
        doctorRepository = mock(DoctorRepository.class);
        activityRepository = mock(ActivityRepository.class);
        departmentRepository = mock(DepartmentRepository.class);
        patientRepository = mock(PatientRepository.class);
        UserRepository userRepository = mock(UserRepository.class);

        Doctor doctor = new Doctor(1L, "DOC-101", "Dr. Sarah Jenkins", "MD", "Cardiology", 14,
                BigDecimal.valueOf(150), "555-0101", "sarah@example.test", "Available",
                BigDecimal.valueOf(4.9), 10, null, "Cardiology specialist");
        when(doctorRepository.findByNameIgnoreCase("Dr. Sarah Jenkins")).thenReturn(Optional.of(doctor));
        when(doctorRepository.findByNameIgnoreCase("Dr. Marcus Vance"))
                .thenReturn(Optional.of(new Doctor(2L, "DOC-104", "Dr. Marcus Vance", "MD", "Orthopedics",
                        18, BigDecimal.valueOf(160), "555-0104", "marcus@example.test", "In Surgery",
                        BigDecimal.valueOf(4.8), 10, null, "Orthopedic surgeon")));
        when(departmentRepository.findByNameIgnoreCase("Cardiology"))
                .thenReturn(Optional.of(new Department(null, "Cardiology", "CARD", "", "", "", 10, 4)));
        when(patientRepository.findFirstByNameIgnoreCaseAndPhone(anyString(), nullable(String.class)))
                .thenReturn(Optional.empty());
        when(appointmentRepository.existsByDoctorNameIgnoreCaseAndDateAndTimeIgnoreCaseAndStatusNot(
                anyString(), any(), anyString(), anyString())).thenReturn(false);
        when(appointmentRepository.countByDoctorNameIgnoreCaseAndDate(anyString(), any())).thenReturn(0L);
        when(appointmentRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        appointmentService = new AppointmentService(appointmentRepository, doctorRepository, activityRepository,
                departmentRepository, patientRepository, userRepository);
    }

    @Test
    void savesAStaffAppointmentWithCanonicalDoctorDepartmentAndToken() {
        AppointmentDto request = appointment(LocalDate.now().plusDays(2), "10:00 AM");
        AppointmentDto saved = appointmentService.book(request);

        assertEquals("Dr. Sarah Jenkins", saved.getDoctorName());
        assertEquals("Cardiology", saved.getDepartment());
        assertEquals(1, saved.getTokenNumber());
        assertEquals("Confirmed", saved.getStatus());
        assertTrue(saved.getId().startsWith("APT-"));
    }

    @Test
    void publicAppointmentRequestsCannotSetTheirOwnStatus() {
        AppointmentDto request = appointment(LocalDate.now().plusDays(2), "10:00 AM");
        request.setStatus("Completed");

        assertEquals("Pending", appointmentService.book(request, null).getStatus());
    }

    @Test
    void preventsDoubleBookingAndUnavailableDoctorSlots() {
        AppointmentDto request = appointment(LocalDate.now().plusDays(3), "09:00 AM");
        when(appointmentRepository.existsByDoctorNameIgnoreCaseAndDateAndTimeIgnoreCaseAndStatusNot(
                "Dr. Sarah Jenkins", LocalDate.now().plusDays(3), "09:00 AM", "Cancelled"))
                .thenReturn(true);
        BusinessRuleException duplicate = assertThrows(BusinessRuleException.class,
                () -> appointmentService.book(request));
        assertTrue(duplicate.getMessage().contains("already has an appointment booked"));

        AppointmentDto surgeryRequest = appointment(LocalDate.now(), "11:30 AM");
        surgeryRequest.setDoctorName("Dr. Marcus Vance");
        BusinessRuleException unavailable = assertThrows(BusinessRuleException.class,
                () -> appointmentService.book(surgeryRequest));
        assertTrue(unavailable.getMessage().contains("in surgery"));
    }

    private AppointmentDto appointment(LocalDate date, String time) {
        AppointmentDto dto = new AppointmentDto();
        dto.setPatientName("Test Patient");
        dto.setPatientPhone("555-0199");
        dto.setDoctorName("Dr. Sarah Jenkins");
        dto.setDate(date.toString());
        dto.setTime(time);
        return dto;
    }
}
