package com.medicare.controller;

import com.medicare.dto.StaffAccountRequest;
import com.medicare.dto.StaffAccountResponse;
import com.medicare.dto.StaffAccountStatusRequest;
import com.medicare.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/staff")
@PreAuthorize("hasRole('ADMIN')")
public class StaffAdminController {
    private final AuthService authService;

    public StaffAdminController(AuthService authService) {
        this.authService = authService;
    }

    @GetMapping
    public ResponseEntity<List<StaffAccountResponse>> getStaffAccounts() {
        return ResponseEntity.ok(authService.getStaffAccounts());
    }

    @PostMapping
    public ResponseEntity<StaffAccountResponse> createStaffAccount(
            @Valid @RequestBody StaffAccountRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.createStaffAccount(request));
    }

    @PatchMapping("/{email}/status")
    public ResponseEntity<StaffAccountResponse> setStaffEnabled(
            @PathVariable String email,
            @Valid @RequestBody StaffAccountStatusRequest request) {
        return ResponseEntity.ok(authService.setStaffEnabled(email, request.getEnabled()));
    }
}
