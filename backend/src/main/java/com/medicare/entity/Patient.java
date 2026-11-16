package com.medicare.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "patients")
public class Patient {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "patient_id", nullable = false, unique = true, length = 24)
    private String patientId; // "PAT-001"

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false)
    private int age;

    @Column(nullable = false, length = 24)
    private String gender;

    @Column(name = "blood_group", length = 8)
    private String bloodGroup;

    @Column(length = 40)
    private String phone;

    @Column(length = 254)
    private String email;

    @Column(name = "medical_condition", length = 500)
    private String condition;

    @Column(name = "doctor_name", length = 120)
    private String doctor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "doctor_id")
    private Doctor assignedDoctor;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_account_id", unique = true)
    @JsonIgnore
    private User patientAccount;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "patient_nurse_assignments",
            joinColumns = @JoinColumn(name = "patient_id"),
            inverseJoinColumns = @JoinColumn(name = "user_id"))
    private Set<User> assignedNurses = new HashSet<>();

    @Column(nullable = false, length = 32)
    private String status; // "Admitted", "Outpatient", "Discharged"

    @Column(length = 500)
    private String address;

    @Column(name = "admission_date")
    private LocalDate admissionDate;

    public Patient() {
    }

    public Patient(Long id, String patientId, String name, int age, String gender, String bloodGroup,
                   String phone, String email, String condition, String doctor, String status,
                   String address, LocalDate admissionDate) {
        this.id = id;
        this.patientId = patientId;
        this.name = name;
        this.age = age;
        this.gender = gender;
        this.bloodGroup = bloodGroup;
        this.phone = phone;
        this.email = email;
        this.condition = condition;
        this.doctor = doctor;
        this.status = status;
        this.address = address;
        this.admissionDate = admissionDate;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getPatientId() {
        return patientId;
    }

    public void setPatientId(String patientId) {
        this.patientId = patientId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getAge() {
        return age;
    }

    public void setAge(int age) {
        this.age = age;
    }

    public String getGender() {
        return gender;
    }

    public void setGender(String gender) {
        this.gender = gender;
    }

    public String getBloodGroup() {
        return bloodGroup;
    }

    public void setBloodGroup(String bloodGroup) {
        this.bloodGroup = bloodGroup;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getCondition() {
        return condition;
    }

    public void setCondition(String condition) {
        this.condition = condition;
    }

    public String getDoctor() {
        return doctor;
    }

    public void setDoctor(String doctor) {
        this.doctor = doctor;
    }

    public Doctor getAssignedDoctor() {
        return assignedDoctor;
    }

    public void setAssignedDoctor(Doctor assignedDoctor) {
        this.assignedDoctor = assignedDoctor;
    }

    public User getPatientAccount() {
        return patientAccount;
    }

    public void setPatientAccount(User patientAccount) {
        this.patientAccount = patientAccount;
    }

    public Set<User> getAssignedNurses() {
        return assignedNurses;
    }

    public void setAssignedNurses(Set<User> assignedNurses) {
        this.assignedNurses = assignedNurses != null ? assignedNurses : new HashSet<>();
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public LocalDate getAdmissionDate() {
        return admissionDate;
    }

    public void setAdmissionDate(LocalDate admissionDate) {
        this.admissionDate = admissionDate;
    }
}

