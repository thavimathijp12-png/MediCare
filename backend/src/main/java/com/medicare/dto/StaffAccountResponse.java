package com.medicare.dto;

public class StaffAccountResponse {
    private String email;
    private String fullName;
    private String role;
    private boolean enabled;
    private String doctorId;
    private String doctorName;

    public StaffAccountResponse(String email, String fullName, String role, boolean enabled) {
        this(email, fullName, role, enabled, null, null);
    }

    public StaffAccountResponse(String email, String fullName, String role, boolean enabled,
                               String doctorId, String doctorName) {
        this.email = email;
        this.fullName = fullName;
        this.role = role;
        this.enabled = enabled;
        this.doctorId = doctorId;
        this.doctorName = doctorName;
    }

    public String getEmail() {
        return email;
    }

    public String getFullName() {
        return fullName;
    }

    public String getRole() {
        return role;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public String getDoctorId() {
        return doctorId;
    }

    public String getDoctorName() {
        return doctorName;
    }
}
