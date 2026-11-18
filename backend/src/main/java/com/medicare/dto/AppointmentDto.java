package com.medicare.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class AppointmentDto {
    private String id; // "APT-2026-01"
    private String patientId;
    private int tokenNumber;

    @NotBlank(message = "Patient name is required")
    @Size(max = 120, message = "Patient name must not exceed 120 characters")
    private String patientName;

    @Size(max = 40, message = "Patient phone must not exceed 40 characters")
    private String patientPhone;

    @NotBlank(message = "Doctor is required")
    @Size(max = 120, message = "Doctor name must not exceed 120 characters")
    private String doctorName;

    private String department;

    @NotBlank(message = "Appointment date is required (YYYY-MM-DD)")
    private String date;

    @NotBlank(message = "Time slot is required")
    @Pattern(
            regexp = "^(?:[01]\\d|2[0-3]):[0-5]\\d|(?:0?[1-9]|1[0-2]):[0-5]\\d\\s(?:AM|PM)$",
            flags = Pattern.Flag.CASE_INSENSITIVE,
            message = "Time must use HH:mm or h:mm AM/PM format")
    private String time;

    private String type = "In-Person";
    private String status = "Confirmed";
    @Size(max = 1000, message = "Appointment reason must not exceed 1000 characters")
    private String reason;

    public AppointmentDto() {
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public int getTokenNumber() {
        return tokenNumber;
    }

    public String getPatientId() {
        return patientId;
    }

    public void setPatientId(String patientId) {
        this.patientId = patientId;
    }

    public void setTokenNumber(int tokenNumber) {
        this.tokenNumber = tokenNumber;
    }

    public String getPatientName() {
        return patientName;
    }

    public void setPatientName(String patientName) {
        this.patientName = patientName;
    }

    public String getPatientPhone() {
        return patientPhone;
    }

    public void setPatientPhone(String patientPhone) {
        this.patientPhone = patientPhone;
    }

    public String getDoctorName() {
        return doctorName;
    }

    public void setDoctorName(String doctorName) {
        this.doctorName = doctorName;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public String getDate() {
        return date;
    }

    public void setDate(String date) {
        this.date = date;
    }

    public String getTime() {
        return time;
    }

    public void setTime(String time) {
        this.time = time;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}

