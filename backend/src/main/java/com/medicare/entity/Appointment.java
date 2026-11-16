package com.medicare.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "appointments")
public class Appointment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "appointment_id", nullable = false, unique = true, length = 32)
    private String appointmentId; // "APT-2026-01"

    @Column(name = "token_number", nullable = false)
    private int tokenNumber;

    @Column(name = "patient_name", nullable = false, length = 120)
    private String patientName;

    @Column(name = "patient_phone", length = 40)
    private String patientPhone;

    @Column(name = "doctor_name", nullable = false, length = 120)
    private String doctorName;

    @Column(name = "department_name", length = 100)
    private String department;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "doctor_id")
    private Doctor doctor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "department_id")
    private Department departmentEntity;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_record_id")
    private Patient patient;

    @Column(name = "appointment_date", nullable = false)
    private LocalDate date;

    @Column(nullable = false, length = 32)
    private String time;

    @Column(length = 32)
    private String type; // "In-Person", "Telehealth"

    @Column(nullable = false, length = 32)
    private String status; // "Confirmed", "Pending", "Completed", "Cancelled"

    @Column(length = 1000)
    private String reason;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Appointment() {
    }

    public Appointment(Long id, String appointmentId, int tokenNumber, String patientName, String patientPhone,
                       String doctorName, String department, LocalDate date, String time, String type,
                       String status, String reason) {
        this.id = id;
        this.appointmentId = appointmentId;
        this.tokenNumber = tokenNumber;
        this.patientName = patientName;
        this.patientPhone = patientPhone;
        this.doctorName = doctorName;
        this.department = department;
        this.date = date;
        this.time = time;
        this.type = type;
        this.status = status;
        this.reason = reason;
        this.createdAt = LocalDateTime.now();
    }

    @PrePersist
    void setCreationTime() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getAppointmentId() {
        return appointmentId;
    }

    public void setAppointmentId(String appointmentId) {
        this.appointmentId = appointmentId;
    }

    public int getTokenNumber() {
        return tokenNumber;
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

    public Doctor getDoctor() {
        return doctor;
    }

    public void setDoctor(Doctor doctor) {
        this.doctor = doctor;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public Department getDepartmentEntity() {
        return departmentEntity;
    }

    public void setDepartmentEntity(Department departmentEntity) {
        this.departmentEntity = departmentEntity;
    }

    public Patient getPatient() {
        return patient;
    }

    public void setPatient(Patient patient) {
        this.patient = patient;
    }

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
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

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}

