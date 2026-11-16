package com.medicare.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "departments")
public class Department {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String name;

    @Column(nullable = false, unique = true, length = 16)
    private String code;

    @Column(length = 1000)
    private String description;

    @Column(length = 160)
    private String location;

    @Column(name = "head_doctor_name", length = 120)
    private String headDoctorName;

    @Column(name = "total_beds", nullable = false)
    private int totalBeds;

    @Column(name = "occupied_beds", nullable = false)
    private int occupiedBeds;

    public Department() {
    }

    public Department(Long id, String name, String code, String description, String location, String headDoctorName, int totalBeds, int occupiedBeds) {
        this.id = id;
        this.name = name;
        this.code = code;
        this.description = description;
        this.location = location;
        this.headDoctorName = headDoctorName;
        this.totalBeds = totalBeds;
        this.occupiedBeds = occupiedBeds;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getHeadDoctorName() {
        return headDoctorName;
    }

    public void setHeadDoctorName(String headDoctorName) {
        this.headDoctorName = headDoctorName;
    }

    public int getTotalBeds() {
        return totalBeds;
    }

    public void setTotalBeds(int totalBeds) {
        this.totalBeds = totalBeds;
    }

    public int getOccupiedBeds() {
        return occupiedBeds;
    }

    public void setOccupiedBeds(int occupiedBeds) {
        this.occupiedBeds = occupiedBeds;
    }
}

