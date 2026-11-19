package com.medicare.service;

import com.medicare.dto.DashboardStatsDto;
import com.medicare.entity.ActivityRecord;
import com.medicare.entity.Appointment;
import com.medicare.repository.ActivityRepository;
import com.medicare.repository.AppointmentRepository;
import com.medicare.repository.DoctorRepository;
import com.medicare.repository.InvoiceRepository;
import com.medicare.repository.PatientRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.format.TextStyle;
import java.util.List;
import java.util.Locale;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DashboardServiceTest {
    private AppointmentRepository appointmentRepository;
    private DashboardService dashboardService;

    @BeforeEach
    void setUp() {
        PatientRepository patientRepository = mock(PatientRepository.class);
        DoctorRepository doctorRepository = mock(DoctorRepository.class);
        appointmentRepository = mock(AppointmentRepository.class);
        InvoiceRepository invoiceRepository = mock(InvoiceRepository.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        when(activityRepository.findTop(5)).thenReturn(List.<ActivityRecord>of());

        dashboardService = new DashboardService(
                patientRepository,
                doctorRepository,
                appointmentRepository,
                invoiceRepository,
                activityRepository);
    }

    @Test
    void excludesCancelledAppointmentsFromDailyAndWeeklyCounts() {
        LocalDate today = LocalDate.now();
        when(appointmentRepository.findAll()).thenReturn(List.of(
                appointment(today, "Confirmed"),
                appointment(today, "Cancelled")));

        DashboardStatsDto stats = dashboardService.getDashboardStats();

        assertEquals(1, stats.getTodayAppointments());
        int todayIndex = stats.getWeeklyDays().indexOf(
                today.getDayOfWeek().getDisplayName(TextStyle.SHORT, Locale.US));
        assertEquals(1, stats.getWeeklyAppointments().get(todayIndex));
    }

    private Appointment appointment(LocalDate date, String status) {
        Appointment appointment = new Appointment();
        appointment.setDate(date);
        appointment.setTime("10:00 AM");
        appointment.setStatus(status);
        return appointment;
    }
}
