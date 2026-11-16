package com.medicare.service;

import com.medicare.dto.AppointmentDto;
import com.medicare.dto.DashboardStatsDto;
import com.medicare.entity.ActivityRecord;
import com.medicare.entity.Appointment;
import com.medicare.entity.Patient;
import com.medicare.repository.ActivityRepository;
import com.medicare.repository.AppointmentRepository;
import com.medicare.repository.DoctorRepository;
import com.medicare.repository.InvoiceRepository;
import com.medicare.repository.PatientRepository;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class DashboardService {

    private final PatientRepository patientRepository;
    private final DoctorRepository doctorRepository;
    private final AppointmentRepository appointmentRepository;
    private final InvoiceRepository invoiceRepository;
    private final ActivityRepository activityRepository;

    public DashboardService(PatientRepository patientRepository,
                            DoctorRepository doctorRepository,
                            AppointmentRepository appointmentRepository,
                            InvoiceRepository invoiceRepository,
                            ActivityRepository activityRepository) {
        this.patientRepository = patientRepository;
        this.doctorRepository = doctorRepository;
        this.appointmentRepository = appointmentRepository;
        this.invoiceRepository = invoiceRepository;
        this.activityRepository = activityRepository;
    }

    public DashboardStatsDto getDashboardStats() {
        DashboardStatsDto stats = new DashboardStatsDto();

        stats.setTotalPatients(patientRepository.count());
        stats.setTotalDoctors(doctorRepository.count());
        stats.setTodayAppointments(appointmentRepository.countByDate(LocalDate.now()));
        stats.setTotalRevenue(invoiceRepository.sumPaid());

        List<Appointment> appointments = appointmentRepository.findAll();
        List<Patient> patients = patientRepository.findAll();
        List<AppointmentDto> recentAppts = appointments.stream()
                .sorted(Comparator.comparing(Appointment::getDate,
                        Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(Appointment::getTime, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(4)
                .map(this::toAppointmentDto)
                .collect(Collectors.toList());
        stats.setRecentAppointments(recentAppts);

        // Recent activities
        List<DashboardStatsDto.ActivityDto> activities = activityRepository.findTop(5).stream()
                .map(this::toActivityDto)
                .collect(Collectors.toList());
        stats.setRecentActivities(activities);

        List<LocalDate> lastSevenDays = new ArrayList<>();
        for (int offset = 6; offset >= 0; offset--) {
            lastSevenDays.add(LocalDate.now().minusDays(offset));
        }
        stats.setWeeklyDays(lastSevenDays.stream()
                .map(day -> day.getDayOfWeek().getDisplayName(TextStyle.SHORT, Locale.US))
                .collect(Collectors.toList()));
        stats.setWeeklyAppointments(lastSevenDays.stream()
                .map(day -> Math.toIntExact(appointments.stream().filter(a -> day.equals(a.getDate())).count()))
                .collect(Collectors.toList()));
        stats.setWeeklyAdmissions(lastSevenDays.stream()
                .map(day -> Math.toIntExact(patients.stream()
                        .filter(patient -> day.equals(patient.getAdmissionDate())).count()))
                .collect(Collectors.toList()));

        Map<String, Long> countsByDepartment = appointments.stream()
                .filter(appointment -> appointment.getDepartment() != null && !appointment.getDepartment().isBlank())
                .filter(appointment -> !"Cancelled".equalsIgnoreCase(appointment.getStatus()))
                .collect(Collectors.groupingBy(Appointment::getDepartment, LinkedHashMap::new, Collectors.counting()));
        long appointmentTotal = countsByDepartment.values().stream().mapToLong(Long::longValue).sum();
        List<String> chartColors = List.of("#1C5D99", "#6C5CE7", "#0E9F6E", "#D97706", "#E11D48");
        List<DashboardStatsDto.DepartmentShareDto> departmentShare = new ArrayList<>();
        int colorIndex = 0;
        for (Map.Entry<String, Long> entry : countsByDepartment.entrySet()) {
            int percentage = appointmentTotal == 0 ? 0
                    : (int) Math.round(entry.getValue() * 100.0 / appointmentTotal);
            departmentShare.add(new DashboardStatsDto.DepartmentShareDto(
                    entry.getKey(), percentage, chartColors.get(colorIndex++ % chartColors.size())));
        }
        stats.setDepartmentShare(departmentShare);

        return stats;
    }

    private AppointmentDto toAppointmentDto(Appointment a) {
        AppointmentDto dto = new AppointmentDto();
        dto.setId(a.getAppointmentId());
        dto.setTokenNumber(a.getTokenNumber());
        dto.setPatientName(a.getPatientName());
        dto.setPatientPhone(a.getPatientPhone());
        dto.setDoctorName(a.getDoctorName());
        dto.setDepartment(a.getDepartment());
        dto.setDate(a.getDate() != null ? a.getDate().toString() : "");
        dto.setTime(a.getTime());
        dto.setType(a.getType());
        dto.setStatus(a.getStatus());
        dto.setReason(a.getReason());
        return dto;
    }

    private DashboardStatsDto.ActivityDto toActivityDto(ActivityRecord a) {
        String relativeTime = formatRelativeTime(a.getTimestamp());
        return new DashboardStatsDto.ActivityDto(
                a.getId(),
                a.getIcon(),
                a.getColor(),
                a.getTitle(),
                a.getDetail(),
                relativeTime
        );
    }

    private String formatRelativeTime(LocalDateTime timestamp) {
        if (timestamp == null) return "Just now";
        long minutes = Duration.between(timestamp, LocalDateTime.now()).toMinutes();
        if (minutes < 1) return "Just now";
        if (minutes < 60) return minutes + " min ago";
        long hours = minutes / 60;
        if (hours < 24) return hours + "h ago";
        long days = hours / 24;
        return days + "d ago";
    }
}

