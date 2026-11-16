package com.medicare.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "prescriptions")
public class Prescription {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id", nullable = false)
    private Patient patient;

    @Column(nullable = false, length = 120)
    private String medication;

    @Column(nullable = false, length = 80)
    private String strength;

    @Column(nullable = false, length = 120)
    private String dose;

    @Column(nullable = false, length = 80)
    private String route;

    @Column(nullable = false, length = 120)
    private String frequency;

    @Column(nullable = false, length = 120)
    private String duration;

    @Column(nullable = false)
    private int refills;

    @Column(nullable = false, length = 32)
    private String status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prescribed_by", nullable = false)
    private User author;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Patient getPatient() { return patient; }
    public void setPatient(Patient patient) { this.patient = patient; }
    public String getMedication() { return medication; }
    public void setMedication(String medication) { this.medication = medication; }
    public String getStrength() { return strength; }
    public void setStrength(String strength) { this.strength = strength; }
    public String getDose() { return dose; }
    public void setDose(String dose) { this.dose = dose; }
    public String getRoute() { return route; }
    public void setRoute(String route) { this.route = route; }
    public String getFrequency() { return frequency; }
    public void setFrequency(String frequency) { this.frequency = frequency; }
    public String getDuration() { return duration; }
    public void setDuration(String duration) { this.duration = duration; }
    public int getRefills() { return refills; }
    public void setRefills(int refills) { this.refills = refills; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public User getAuthor() { return author; }
    public void setAuthor(User author) { this.author = author; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
