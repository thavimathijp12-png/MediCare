package com.medicare.dto;

import java.math.BigDecimal;
import java.util.List;

public class DashboardStatsDto {
    private long totalPatients;
    private long totalDoctors;
    private long todayAppointments;
    private BigDecimal totalRevenue;
    private List<AppointmentDto> recentAppointments;
    private List<ActivityDto> recentActivities;
    private List<String> weeklyDays;
    private List<Integer> weeklyAppointments;
    private List<Integer> weeklyAdmissions;
    private List<DepartmentShareDto> departmentShare;

    public DashboardStatsDto() {
    }

    public static class ActivityDto {
        private Long id;
        private String icon;
        private String color;
        private String title;
        private String detail;
        private String time;

        public ActivityDto() {
        }

        public ActivityDto(Long id, String icon, String color, String title, String detail, String time) {
            this.id = id;
            this.icon = icon;
            this.color = color;
            this.title = title;
            this.detail = detail;
            this.time = time;
        }

        public Long getId() {
            return id;
        }

        public void setId(Long id) {
            this.id = id;
        }

        public String getIcon() {
            return icon;
        }

        public void setIcon(String icon) {
            this.icon = icon;
        }

        public String getColor() {
            return color;
        }

        public void setColor(String color) {
            this.color = color;
        }

        public String getTitle() {
            return title;
        }

        public void setTitle(String title) {
            this.title = title;
        }

        public String getDetail() {
            return detail;
        }

        public void setDetail(String detail) {
            this.detail = detail;
        }

        public String getTime() {
            return time;
        }

        public void setTime(String time) {
            this.time = time;
        }
    }

    public static class DepartmentShareDto {
        private String label;
        private int value;
        private String color;

        public DepartmentShareDto() {
        }

        public DepartmentShareDto(String label, int value, String color) {
            this.label = label;
            this.value = value;
            this.color = color;
        }

        public String getLabel() {
            return label;
        }

        public void setLabel(String label) {
            this.label = label;
        }

        public int getValue() {
            return value;
        }

        public void setValue(int value) {
            this.value = value;
        }

        public String getColor() {
            return color;
        }

        public void setColor(String color) {
            this.color = color;
        }
    }

    public long getTotalPatients() {
        return totalPatients;
    }

    public void setTotalPatients(long totalPatients) {
        this.totalPatients = totalPatients;
    }

    public long getTotalDoctors() {
        return totalDoctors;
    }

    public void setTotalDoctors(long totalDoctors) {
        this.totalDoctors = totalDoctors;
    }

    public long getTodayAppointments() {
        return todayAppointments;
    }

    public void setTodayAppointments(long todayAppointments) {
        this.todayAppointments = todayAppointments;
    }

    public BigDecimal getTotalRevenue() {
        return totalRevenue;
    }

    public void setTotalRevenue(BigDecimal totalRevenue) {
        this.totalRevenue = totalRevenue;
    }

    public List<AppointmentDto> getRecentAppointments() {
        return recentAppointments;
    }

    public void setRecentAppointments(List<AppointmentDto> recentAppointments) {
        this.recentAppointments = recentAppointments;
    }

    public List<ActivityDto> getRecentActivities() {
        return recentActivities;
    }

    public void setRecentActivities(List<ActivityDto> recentActivities) {
        this.recentActivities = recentActivities;
    }

    public List<String> getWeeklyDays() {
        return weeklyDays;
    }

    public void setWeeklyDays(List<String> weeklyDays) {
        this.weeklyDays = weeklyDays;
    }

    public List<Integer> getWeeklyAppointments() {
        return weeklyAppointments;
    }

    public void setWeeklyAppointments(List<Integer> weeklyAppointments) {
        this.weeklyAppointments = weeklyAppointments;
    }

    public List<Integer> getWeeklyAdmissions() {
        return weeklyAdmissions;
    }

    public void setWeeklyAdmissions(List<Integer> weeklyAdmissions) {
        this.weeklyAdmissions = weeklyAdmissions;
    }

    public List<DepartmentShareDto> getDepartmentShare() {
        return departmentShare;
    }

    public void setDepartmentShare(List<DepartmentShareDto> departmentShare) {
        this.departmentShare = departmentShare;
    }
}
