package com.medicare.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "activity_records")
public class ActivityRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 80)
    private String icon;

    @Column(length = 40)
    private String color;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(nullable = false, length = 1000)
    private String detail;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime timestamp = LocalDateTime.now();

    public ActivityRecord() {
    }

    public ActivityRecord(Long id, String icon, String color, String title, String detail) {
        this.id = id;
        this.icon = icon;
        this.color = color;
        this.title = title;
        this.detail = detail;
        this.timestamp = LocalDateTime.now();
    }

    @PrePersist
    void setCreationTime() {
        if (timestamp == null) {
            timestamp = LocalDateTime.now();
        }
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

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }
}

