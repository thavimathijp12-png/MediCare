package com.medicare.service;

import com.medicare.dto.AuthRequest;
import com.medicare.dto.AuthResponse;
import com.medicare.dto.RegisterRequest;
import com.medicare.entity.Patient;
import com.medicare.entity.Role;
import com.medicare.entity.User;
import com.medicare.repository.DoctorRepository;
import com.medicare.repository.PatientRepository;
import com.medicare.repository.RevokedTokenRepository;
import com.medicare.repository.UserRepository;
import com.medicare.security.CustomUserDetailsService;
import com.medicare.security.JwtTokenUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthServiceTest {
    private static final String ADMIN_EMAIL = "admin@medicare.test";

    private final Map<String, User> users = new ConcurrentHashMap<>();
    private String adminPassword;
    private UserRepository userRepository;
    private PatientRepository patientRepository;
    private PasswordEncoder passwordEncoder;
    private JwtTokenUtil jwtTokenUtil;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        users.clear();
        adminPassword = UUID.randomUUID() + "Aa1!";
        userRepository = mock(UserRepository.class);
        passwordEncoder = new BCryptPasswordEncoder();
        jwtTokenUtil = new JwtTokenUtil(
                UUID.randomUUID().toString() + UUID.randomUUID(), 3_600_000L);
        DoctorRepository doctorRepository = mock(DoctorRepository.class);
        patientRepository = mock(PatientRepository.class);
        TokenRevocationService tokenRevocationService =
                new TokenRevocationService(mock(RevokedTokenRepository.class), jwtTokenUtil);

        User admin = new User(1L, ADMIN_EMAIL, passwordEncoder.encode(adminPassword), "Test Administrator", Role.ADMIN);
        users.put(ADMIN_EMAIL, admin);
        when(userRepository.findByEmailIgnoreCase(anyString()))
                .thenAnswer(invocation -> Optional.ofNullable(users.get(invocation.getArgument(0))));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User saved = invocation.getArgument(0);
            users.put(saved.getEmail(), saved);
            return saved;
        });

        AuthenticationManager authenticationManager = authentication -> {
            User user = users.get(authentication.getName());
            String password = String.valueOf(authentication.getCredentials());
            if (user == null || !passwordEncoder.matches(password, user.getPasswordHash())) {
                throw new BadCredentialsException("Invalid email or password");
            }
            return new UsernamePasswordAuthenticationToken(authentication.getName(), null);
        };
        CustomUserDetailsService detailsService = new CustomUserDetailsService(userRepository);
        authService = new AuthService(authenticationManager, detailsService, jwtTokenUtil,
                userRepository, doctorRepository, patientRepository, passwordEncoder, tokenRevocationService);
    }

    @Test
    void authenticatesBcryptUserAndRejectsAnInvalidPassword() {
        AuthResponse response = authService.login(new AuthRequest(ADMIN_EMAIL, adminPassword));
        assertNotNull(response.getToken());
        assertEquals("ADMIN", response.getRole());
        assertTrue(jwtTokenUtil.validateToken(response.getToken(), ADMIN_EMAIL));

        assertThrows(BadCredentialsException.class,
                () -> authService.login(new AuthRequest(ADMIN_EMAIL, "wrong-password")));
    }

    @Test
    void publicRegistrationAlwaysCreatesAPatientAndStoresOnlyTheBcryptHash() {
        RegisterRequest request = new RegisterRequest(
                "new-user@medicare.test", UUID.randomUUID() + "Aa1!", "New Patient",
                34, "Female", "555-0101", "Main Street", "ADMIN");
        AuthResponse response = authService.register(request);
        User stored = users.get(request.getEmail());

        assertEquals("PATIENT", response.getRole());
        assertEquals(Role.PATIENT, stored.getRole());
        assertNotEquals(request.getPassword(), stored.getPasswordHash());
        assertTrue(passwordEncoder.matches(request.getPassword(), stored.getPasswordHash()));
        verify(patientRepository).save(any(Patient.class));
    }
}
