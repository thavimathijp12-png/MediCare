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

import java.math.BigDecimal;

@Entity
@Table(name = "doctors")
public class Doctor {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "doctor_id", nullable = false, unique = true, length = 24)
    private String doctorId;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(length = 160)
    private String degree;

    @Column(name = "department_name", length = 100)
    private String department;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "department_id")
    private Department departmentEntity;

    @Column(name = "experience_years", nullable = false)
    private int experienceYears;

    @Column(name = "consultation_fee", precision = 10, scale = 2)
    private BigDecimal consultationFee;

    @Column(length = 40)
    private String phone;

    @Column(length = 254)
    private String email;

    @Column(nullable = false, length = 32)
    private String status; // "Available", "In Surgery", "On Leave"

    @Column(precision = 3, scale = 2)
    private BigDecimal rating;

    @Column(name = "review_count", nullable = false)
    private int reviewCount;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @Column(length = 2000)
    private String biography;

    public Doctor() {
    }

    public Doctor(Long id, String doctorId, String name, String degree, String department, int experienceYears,
                  BigDecimal consultationFee, String phone, String email, String status,
                  BigDecimal rating, int reviewCount, String imageUrl, String biography) {
        this.id = id;
        this.doctorId = doctorId;
        this.name = name;
        this.degree = degree;
        this.department = department;
        this.experienceYears = experienceYears;
        this.consultationFee = consultationFee;
        this.phone = phone;
        this.email = email;
        this.status = status;
        this.rating = rating;
        this.reviewCount = reviewCount;
        this.imageUrl = imageUrl;
        this.biography = biography;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getDoctorId() {
        return doctorId;
    }

    public void setDoctorId(String doctorId) {
        this.doctorId = doctorId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDegree() {
        return degree;
    }

    public void setDegree(String degree) {
        this.degree = degree;
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

    public int getExperienceYears() {
        return experienceYears;
    }

    public void setExperienceYears(int experienceYears) {
        this.experienceYears = experienceYears;
    }

    public BigDecimal getConsultationFee() {
        return consultationFee;
    }

    public void setConsultationFee(BigDecimal consultationFee) {
        this.consultationFee = consultationFee;
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

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public BigDecimal getRating() {
        return rating;
    }

    public void setRating(BigDecimal rating) {
        this.rating = rating;
    }

    public int getReviewCount() {
        return reviewCount;
    }

    public void setReviewCount(int reviewCount) {
        this.reviewCount = reviewCount;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public String getBiography() {
        return biography;
    }

    public void setBiography(String biography) {
        this.biography = biography;
    }
}

