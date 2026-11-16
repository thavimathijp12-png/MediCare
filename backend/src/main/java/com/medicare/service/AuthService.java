package com.medicare.service;

import com.medicare.dto.AuthRequest;
import com.medicare.dto.AuthResponse;
import com.medicare.dto.RegisterRequest;
import com.medicare.dto.StaffAccountRequest;
import com.medicare.dto.StaffAccountResponse;
import com.medicare.entity.Patient;
import com.medicare.entity.Role;
import com.medicare.entity.User;
import com.medicare.exception.BusinessRuleException;
import com.medicare.exception.ResourceNotFoundException;
import com.medicare.repository.DoctorRepository;
import com.medicare.repository.PatientRepository;
import com.medicare.repository.UserRepository;
import com.medicare.security.JwtTokenUtil;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AuthService {

    private static final Set<Role> STAFF_ROLES =
            Set.of(Role.ADMIN, Role.DOCTOR, Role.RECEPTIONIST, Role.NURSE);

    private final AuthenticationManager authenticationManager;
    private final UserDetailsService userDetailsService;
    private final JwtTokenUtil jwtTokenUtil;
    private final UserRepository userRepository;
    private final DoctorRepository doctorRepository;
    private final PatientRepository patientRepository;
    private final PasswordEncoder passwordEncoder;
    private final TokenRevocationService tokenRevocationService;

    public AuthService(AuthenticationManager authenticationManager,
                       UserDetailsService userDetailsService,
                       JwtTokenUtil jwtTokenUtil,
                       UserRepository userRepository,
                       DoctorRepository doctorRepository,
                       PatientRepository patientRepository,
                       PasswordEncoder passwordEncoder,
                       TokenRevocationService tokenRevocationService) {
        this.authenticationManager = authenticationManager;
        this.userDetailsService = userDetailsService;
        this.jwtTokenUtil = jwtTokenUtil;
        this.userRepository = userRepository;
        this.doctorRepository = doctorRepository;
        this.patientRepository = patientRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenRevocationService = tokenRevocationService;
    }

    public AuthResponse login(AuthRequest request) {
        String email = normalizeEmail(request.getEmail());
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(email, request.getPassword()));

        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new BusinessRuleException("The account is unavailable."));
        UserDetails userDetails = userDetailsService.loadUserByUsername(email);
        String token = jwtTokenUtil.generateToken(userDetails, user.getRole().name());
        return new AuthResponse(token, user.getEmail(), user.getFullName(), user.getRole().name());
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = normalizeEmail(request.getEmail());
        ensurePasswordLength(request.getPassword());
        if (userRepository.findByEmailIgnoreCase(email).isPresent()) {
            throw new BusinessRuleException("An account with that email already exists.");
        }

        User patient = new User(null, email, passwordEncoder.encode(request.getPassword()),
                request.getFullName().trim(), Role.PATIENT);
        User saved = userRepository.save(patient);
        Patient profile = new Patient();
        profile.setPatientId("PAT-" + UUID.randomUUID().toString().replace("-", "")
                .substring(0, 20).toUpperCase(Locale.ROOT));
        profile.setName(request.getFullName().trim());
        profile.setAge(request.getAge());
        profile.setGender(request.getGender().trim());
        profile.setPhone(request.getPhone().trim());
        profile.setEmail(email);
        profile.setStatus("Outpatient");
        profile.setAddress(request.getAddress() != null ? request.getAddress().trim() : "");
        profile.setPatientAccount(saved);
        patientRepository.save(profile);
        UserDetails userDetails = userDetailsService.loadUserByUsername(saved.getEmail());
        String token = jwtTokenUtil.generateToken(userDetails, Role.PATIENT.name());
        return new AuthResponse(token, saved.getEmail(), saved.getFullName(), Role.PATIENT.name());
    }

    @Transactional(readOnly = true)
    public StaffAccountResponse getCurrentAccount(String email) {
        User user = userRepository.findByEmailIgnoreCase(normalizeEmail(email))
                .orElseThrow(() -> new ResourceNotFoundException("The account was not found."));
        return toResponse(user);
    }

    @Transactional(readOnly = true)
    public List<StaffAccountResponse> getStaffAccounts() {
        return userRepository.findAll().stream()
                .filter(user -> STAFF_ROLES.contains(user.getRole()))
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public StaffAccountResponse createStaffAccount(StaffAccountRequest request) {
        String email = normalizeEmail(request.getEmail());
        ensurePasswordLength(request.getPassword());
        Role role = request.getRole();
        if (role == null || !STAFF_ROLES.contains(role)) {
            throw new BusinessRuleException("Only ADMIN, DOCTOR, RECEPTIONIST, or NURSE staff roles may be created.");
        }
        if (userRepository.findByEmailIgnoreCase(email).isPresent()) {
            throw new BusinessRuleException("An account with that email already exists.");
        }

        User staff = new User(null, email, passwordEncoder.encode(request.getPassword()),
                request.getFullName().trim(), role);
        if (role == Role.DOCTOR) {
            if (request.getDoctorId() == null || request.getDoctorId().isBlank()) {
                throw new BusinessRuleException("A doctor account must be linked to a doctor profile.");
            }
            staff.setDoctorProfile(doctorRepository.findByDoctorIdIgnoreCase(request.getDoctorId().trim())
                    .orElseThrow(() -> new ResourceNotFoundException("The selected doctor profile was not found.")));
        } else if (request.getDoctorId() != null && !request.getDoctorId().isBlank()) {
            throw new BusinessRuleException("A doctor profile can only be linked to a DOCTOR account.");
        }

        return toResponse(userRepository.save(staff));
    }

    @Transactional
    public StaffAccountResponse setStaffEnabled(String email, boolean enabled) {
        User user = userRepository.findByEmailIgnoreCase(normalizeEmail(email))
                .filter(account -> STAFF_ROLES.contains(account.getRole()))
                .orElseThrow(() -> new ResourceNotFoundException("Staff account was not found."));
        user.setEnabled(enabled);
        return toResponse(userRepository.save(user));
    }

    @Transactional
    public void logout(String token) {
        tokenRevocationService.revoke(token);
    }

    private StaffAccountResponse toResponse(User user) {
        var doctor = user.getDoctorProfile();
        return new StaffAccountResponse(user.getEmail(), user.getFullName(), user.getRole().name(),
                user.isEnabled(), doctor != null ? doctor.getDoctorId() : null,
                doctor != null ? doctor.getName() : null);
    }

    private String normalizeEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new BusinessRuleException("Email is required.");
        }
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private void ensurePasswordLength(String password) {
        if (password == null || password.isBlank()) {
            throw new BusinessRuleException("Password is required.");
        }
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new BusinessRuleException("Password must not exceed 72 UTF-8 bytes.");
        }
    }
}
