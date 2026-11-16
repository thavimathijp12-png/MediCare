package com.medicare.service;

import com.medicare.dto.DepartmentDto;
import com.medicare.entity.Department;
import com.medicare.exception.ResourceNotFoundException;
import com.medicare.repository.DepartmentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class DepartmentService {

    private final DepartmentRepository departmentRepository;

    public DepartmentService(DepartmentRepository departmentRepository) {
        this.departmentRepository = departmentRepository;
    }

    public List<Department> getAll() {
        return departmentRepository.findAll();
    }

    public Optional<Department> getById(Long id) {
        return departmentRepository.findById(id);
    }

    public Optional<Department> getByName(String name) {
        return departmentRepository.findByNameIgnoreCase(name);
    }

    @Transactional
    public DepartmentDto save(DepartmentDto dto) {
        Department department = dto.getId() == null
                ? new Department()
                : departmentRepository.findById(dto.getId())
                        .orElseThrow(() -> new ResourceNotFoundException("Department was not found."));
        department.setName(dto.getName().trim());
        department.setCode(dto.getCode().trim());
        department.setDescription(dto.getDescription());
        department.setLocation(dto.getLocation());
        department.setHeadDoctorName(dto.getHeadDoctorName());
        department.setTotalBeds(dto.getTotalBeds());
        department.setOccupiedBeds(dto.getOccupiedBeds());
        return toDto(departmentRepository.save(department));
    }

    @Transactional
    public void delete(Long id) {
        Department department = departmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Department was not found."));
        departmentRepository.delete(department);
    }

    private DepartmentDto toDto(Department department) {
        DepartmentDto dto = new DepartmentDto();
        dto.setId(department.getId());
        dto.setName(department.getName());
        dto.setCode(department.getCode());
        dto.setDescription(department.getDescription());
        dto.setLocation(department.getLocation());
        dto.setHeadDoctorName(department.getHeadDoctorName());
        dto.setTotalBeds(department.getTotalBeds());
        dto.setOccupiedBeds(department.getOccupiedBeds());
        return dto;
    }
}

