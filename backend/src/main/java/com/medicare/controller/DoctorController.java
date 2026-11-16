package com.medicare.controller;

import com.medicare.dto.DoctorDto;
import com.medicare.service.DoctorService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/doctors")
public class DoctorController {

    private final DoctorService doctorService;

    public DoctorController(DoctorService doctorService) {
        this.doctorService = doctorService;
    }

    @GetMapping
    public ResponseEntity<List<DoctorDto>> getAllDoctors(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(doctorService.getAll(query, department, status));
    }

    @GetMapping("/{id}")
    public ResponseEntity<DoctorDto> getDoctorById(@PathVariable String id) {
        return ResponseEntity.ok(doctorService.getById(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<DoctorDto> createDoctor(@Valid @RequestBody DoctorDto dto) {
        DoctorDto saved = doctorService.save(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<DoctorDto> updateDoctor(@PathVariable String id, @Valid @RequestBody DoctorDto dto) {
        dto.setId(id);
        DoctorDto updated = doctorService.save(dto);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteDoctor(@PathVariable String id) {
        doctorService.delete(id);
        return ResponseEntity.noContent().build();
    }
}

