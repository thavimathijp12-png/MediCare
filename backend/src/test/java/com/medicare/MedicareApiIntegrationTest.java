package com.medicare;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.medicare.dto.AppointmentDto;
import com.medicare.dto.AuthRequest;
import com.medicare.dto.ContactInquiryRequest;
import com.medicare.dto.InvoiceDto;
import com.medicare.dto.RegisterRequest;
import com.medicare.entity.Department;
import com.medicare.entity.Doctor;
import com.medicare.entity.Patient;
import com.medicare.entity.Role;
import com.medicare.entity.User;
import com.medicare.repository.DepartmentRepository;
import com.medicare.repository.AppointmentRepository;
import com.medicare.repository.DoctorRepository;
import com.medicare.repository.PatientRepository;
import com.medicare.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.notNullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MedicareApiIntegrationTest {
    private static final String TEST_JWT_SECRET = UUID.randomUUID().toString() + UUID.randomUUID();

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private AppointmentRepository appointmentRepository;
    @Autowired private DoctorRepository doctorRepository;
    @Autowired private PatientRepository patientRepository;
    @Autowired private DepartmentRepository departmentRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private String adminEmail;
    private String doctorEmail;
    private String receptionistEmail;
    private String nurseEmail;
    private String patientEmail;
    private String patientId;
    private String unassignedPatientId;
    private String testPassword;
    private Doctor doctor;

    @DynamicPropertySource
    static void registerTestProperties(DynamicPropertyRegistry registry) {
        registry.add("medicare.jwt.secret", () -> TEST_JWT_SECRET);
        registry.add("medicare.payments.stripe-secret-key", () -> "");
        registry.add("medicare.payments.stripe-webhook-secret", () -> "");
    }

    @BeforeEach
    void setUp() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        testPassword = UUID.randomUUID() + "Aa1!";
        adminEmail = "admin-" + suffix + "@medicare.test";
        doctorEmail = "doctor-" + suffix + "@medicare.test";
        receptionistEmail = "reception-" + suffix + "@medicare.test";
        nurseEmail = "nurse-" + suffix + "@medicare.test";
        patientEmail = "patient-" + suffix + "@medicare.test";

        Department department = departmentRepository.findByNameIgnoreCase("Test Cardiology")
                .orElseGet(() -> departmentRepository.save(new Department(
                        null, "Test Cardiology", "TCARD", "Test department", "Test campus",
                        "Dr. Test Provider", 10, 2)));
        doctor = doctorRepository.findByDoctorIdIgnoreCase("DOC-TEST")
                .orElseGet(() -> {
                    Doctor newDoctor = new Doctor(null, "DOC-TEST", "Dr. Test Provider", "MD",
                            "Test Cardiology", 10, BigDecimal.valueOf(100), "555-0100",
                            "doctor@medicare.test", "Available", BigDecimal.valueOf(4.5), 1, null,
                            "Test professional profile");
                    newDoctor.setDepartmentEntity(department);
                    return doctorRepository.save(newDoctor);
                });

        User admin = saveUser(adminEmail, Role.ADMIN, null);
        User doctorUser = saveUser(doctorEmail, Role.DOCTOR, doctor);
        User receptionist = saveUser(receptionistEmail, Role.RECEPTIONIST, null);
        User nurse = saveUser(nurseEmail, Role.NURSE, null);
        saveUser(patientEmail, Role.PATIENT, null);

        String patientSuffix = UUID.randomUUID().toString().substring(0, 8);
        Patient assigned = new Patient(null, "PAT-A" + patientSuffix, "Test Patient " + patientSuffix,
                40, "Female", "O+", "555-0200", patientEmail, "Test condition", doctor.getName(),
                "Outpatient", "Test address", LocalDate.now());
        assigned.setAssignedDoctor(doctor);
        assigned.setAssignedNurses(Set.of(nurse));
        patientId = patientRepository.save(assigned).getPatientId();

        Patient unassigned = new Patient(null, "PAT-U" + patientSuffix, "Unassigned Patient " + patientSuffix,
                35, "Male", "A+", "555-0201", null, "Test condition", null,
                "Outpatient", "Test address", LocalDate.now());
        unassignedPatientId = patientRepository.save(unassigned).getPatientId();
    }

    @Test
    void publicCatalogEndpointsDoNotRequireAuthentication() throws Exception {
        mockMvc.perform(get("/api/doctors"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].name", hasItem("Dr. Test Provider")));
        mockMvc.perform(get("/api/departments"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].name", hasItem("Test Cardiology")));
    }

    @Test
    void corsAllowsOnlyConfiguredLocalFrontendOrigins() throws Exception {
        mockMvc.perform(options("/api/doctors")
                        .header("Origin", "http://localhost:5501")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .header().string("Access-Control-Allow-Origin", "http://localhost:5501"));
        mockMvc.perform(options("/api/doctors")
                        .header("Origin", "https://untrusted.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .header().doesNotExist("Access-Control-Allow-Origin"));
    }

    @Test
    void loginUsesBcryptAndReturnsAValidJwtButRejectsWrongPassword() throws Exception {
        String token = login(adminEmail);
        mockMvc.perform(get("/api/auth/me").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("ADMIN"))
                .andExpect(jsonPath("$.email").value(adminEmail));

        AuthRequest invalidRequest = new AuthRequest(adminEmail, "incorrect-password");
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value(containsString("Invalid email or password")));
    }

    @Test
    void protectedPatientAndAppointmentApisRejectMissingInvalidAndExpiredTokens() throws Exception {
        mockMvc.perform(get("/api/patients")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/appointments")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/patients").header("Authorization", bearer("not-a-jwt")))
                .andExpect(status().isUnauthorized());

        UserDetails principal = new org.springframework.security.core.userdetails.User(
                adminEmail, "unused", List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
        String expired = new com.medicare.security.JwtTokenUtil(TEST_JWT_SECRET, -1)
                .generateToken(principal, "ADMIN");
        mockMvc.perform(get("/api/patients").header("Authorization", bearer(expired)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void eachStaffRoleIsLimitedToItsAuthorizedClinicalResources() throws Exception {
        String adminToken = login(adminEmail);
        String doctorToken = login(doctorEmail);
        String receptionistToken = login(receptionistEmail);
        String nurseToken = login(nurseEmail);
        String patientToken = login(patientEmail);

        mockMvc.perform(get("/api/patients").header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/patients").header("Authorization", bearer(receptionistToken)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/patients/{id}", patientId).header("Authorization", bearer(doctorToken)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/patients/{id}", unassignedPatientId)
                        .header("Authorization", bearer(doctorToken)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/patients/{id}", patientId).header("Authorization", bearer(nurseToken)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/patients/{id}", unassignedPatientId)
                        .header("Authorization", bearer(nurseToken)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/patients").header("Authorization", bearer(patientToken)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/billing").header("Authorization", bearer(doctorToken)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/billing").header("Authorization", bearer(nurseToken)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/billing").header("Authorization", bearer(receptionistToken)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/billing").header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk());
    }

    @Test
    void patientRegistrationCannotAssignStaffRolesAndOnlyAdminsCanProvisionStaff() throws Exception {
        String registrationPassword = randomPassword();
        RegisterRequest registration = new RegisterRequest(
                "public-" + UUID.randomUUID().toString().substring(0, 8) + "@medicare.test",
                registrationPassword, "Public Patient", 29, "Female", "555-0109",
                "Public registration address", "ADMIN");
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registration)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("PATIENT"))
                .andReturn();
        JsonNode response = objectMapper.readTree(result.getResponse().getContentAsString());
        User registered = userRepository.findByEmailIgnoreCase(response.get("email").asText()).orElseThrow();
        assertEquals(Role.PATIENT, registered.getRole());
        assertEquals(false, registration.getPassword().equals(registered.getPasswordHash()));
        assertEquals(true, passwordEncoder.matches(registration.getPassword(), registered.getPasswordHash()));
        Patient registeredProfile = patientRepository.findByPatientAccount_EmailIgnoreCase(registered.getEmail())
                .orElseThrow();
        assertEquals(registered.getEmail(), registeredProfile.getEmail());

        String adminToken = login(adminEmail);
        String receptionistToken = login(receptionistEmail);
        String staffBody = """
                {"email":"created-nurse-%s@medicare.test","password":"%s","fullName":"New Nurse","role":"NURSE"}
                """.formatted(UUID.randomUUID().toString().substring(0, 8), randomPassword());
        mockMvc.perform(post("/api/admin/staff")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(staffBody))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/admin/staff")
                        .header("Authorization", bearer(receptionistToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(staffBody))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/admin/staff")
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(staffBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("NURSE"))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
    }

    @Test
    void publicAppointmentRequestsAreSavedAsPendingAndCannotReadOtherBookings() throws Exception {
        AppointmentDto request = new AppointmentDto();
        Patient existingPatient = patientRepository.findByPatientIdIgnoreCase(patientId).orElseThrow();
        request.setPatientName(existingPatient.getName());
        request.setPatientPhone(existingPatient.getPhone());
        request.setDoctorName(doctor.getName());
        request.setDate(LocalDate.now().plusDays(102).toString());
        request.setTime("10:30 AM");
        request.setStatus("Completed");

        MvcResult result = mockMvc.perform(post("/api/appointments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("Pending"))
                .andReturn();
        String appointmentId = objectMapper.readTree(result.getResponse().getContentAsString())
                .get("id").asText();
        assertNull(appointmentRepository.findByAppointmentIdIgnoreCase(appointmentId).orElseThrow().getPatient());
        mockMvc.perform(get("/api/appointments")).andExpect(status().isUnauthorized());
    }

    @Test
    void appointmentDetailsRequireStaffAuthorizationAndCanBeUpdatedByAdmin() throws Exception {
        AppointmentDto request = new AppointmentDto();
        request.setPatientName("Appointment Update Patient");
        request.setPatientPhone("555-0401");
        request.setDoctorName(doctor.getName());
        request.setDate(LocalDate.now().plusDays(3).toString());
        request.setTime("11:30 AM");
        request.setStatus("Pending");
        MvcResult created = mockMvc.perform(post("/api/appointments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn();
        String appointmentId = objectMapper.readTree(created.getResponse().getContentAsString())
                .get("id").asText();

        request.setDate(LocalDate.now().plusDays(4).toString());
        request.setTime("01:30 PM");
        request.setStatus("Confirmed");
        String updatedBody = objectMapper.writeValueAsString(request);
        mockMvc.perform(put("/api/appointments/{id}", appointmentId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updatedBody))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(put("/api/appointments/{id}", appointmentId)
                        .header("Authorization", bearer(login(adminEmail)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updatedBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.date").value(request.getDate()))
                .andExpect(jsonPath("$.time").value(request.getTime()))
                .andExpect(jsonPath("$.status").value("Confirmed"));
    }

    @Test
    void clinicalAndNursingActionsRequireAuthorizedRoleAndPatientAssignment() throws Exception {
        String adminToken = login(adminEmail);
        String doctorToken = login(doctorEmail);
        String receptionistToken = login(receptionistEmail);
        String nurseToken = login(nurseEmail);
        String clinicalPath = "/api/patients/{patientId}";

        String recordBody = """
                {"diagnosis":"Test diagnosis","clinicalNote":"Doctor clinical note","allergies":"No known allergies"}
                """;
        MvcResult recordResult = mockMvc.perform(post(clinicalPath + "/clinical-records", patientId)
                        .header("Authorization", bearer(doctorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(recordBody))
                .andExpect(status().isCreated())
                .andReturn();
        String clinicalRecordId = objectMapper.readTree(recordResult.getResponse().getContentAsString())
                .get("id").asText();

        mockMvc.perform(get(clinicalPath + "/clinical-records", patientId)
                        .header("Authorization", bearer(nurseToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].diagnosis").value("Test diagnosis"));
        mockMvc.perform(post(clinicalPath + "/clinical-records", patientId)
                        .header("Authorization", bearer(nurseToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(recordBody))
                .andExpect(status().isForbidden());
        mockMvc.perform(put(clinicalPath + "/clinical-records/{recordId}", patientId, clinicalRecordId)
                        .header("Authorization", bearer(nurseToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(recordBody))
                .andExpect(status().isForbidden());

        String prescriptionBody = """
                {"medication":"Example medicine","strength":"10 mg","dose":"1 tablet","route":"oral","frequency":"daily","duration":"7 days","refills":0,"status":"Active"}
                """;
        MvcResult prescriptionResult = mockMvc.perform(post(clinicalPath + "/prescriptions", patientId)
                        .header("Authorization", bearer(doctorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(prescriptionBody))
                .andExpect(status().isCreated())
                .andReturn();
        String prescriptionId = objectMapper.readTree(prescriptionResult.getResponse().getContentAsString())
                .get("id").asText();
        mockMvc.perform(get(clinicalPath + "/prescriptions", patientId)
                        .header("Authorization", bearer(nurseToken)))
                .andExpect(status().isOk());
        mockMvc.perform(put(clinicalPath + "/prescriptions/{prescriptionId}", patientId, prescriptionId)
                        .header("Authorization", bearer(nurseToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(prescriptionBody))
                .andExpect(status().isForbidden());

        String vitalBody = """
                {"type":"TEMPERATURE_C","value":37.2}
                """;
        MvcResult vitalResult = mockMvc.perform(post(clinicalPath + "/vitals", patientId)
                        .header("Authorization", bearer(nurseToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(vitalBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.unit").value("°C"))
                .andReturn();
        String vitalId = objectMapper.readTree(vitalResult.getResponse().getContentAsString())
                .get("id").asText();
        mockMvc.perform(put(clinicalPath + "/vitals/{vitalId}", patientId, vitalId)
                        .header("Authorization", bearer(nurseToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"type":"TEMPERATURE_C","value":37.4}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.value").value(37.4));
        mockMvc.perform(post(clinicalPath + "/vitals", unassignedPatientId)
                        .header("Authorization", bearer(nurseToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(vitalBody))
                .andExpect(status().isForbidden());
        mockMvc.perform(post(clinicalPath + "/vitals", patientId)
                        .header("Authorization", bearer(receptionistToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(vitalBody))
                .andExpect(status().isForbidden());
        mockMvc.perform(post(clinicalPath + "/vitals", patientId)
                        .header("Authorization", bearer(nurseToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"type":"UNKNOWN","value":37.2}
                                """))
                .andExpect(status().isBadRequest());

        String noteBody = """
                {"content":"Patient resting comfortably."}
                """;
        MvcResult noteResult = mockMvc.perform(post(clinicalPath + "/nursing-notes", patientId)
                        .header("Authorization", bearer(nurseToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(noteBody))
                .andExpect(status().isCreated())
                .andReturn();
        String noteId = objectMapper.readTree(noteResult.getResponse().getContentAsString())
                .get("id").asText();
        mockMvc.perform(put(clinicalPath + "/nursing-notes/{noteId}", patientId, noteId)
                        .header("Authorization", bearer(nurseToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"content":"Patient resting comfortably; call bell within reach."}
                                """))
                .andExpect(status().isOk());
        mockMvc.perform(post(clinicalPath + "/nursing-notes", patientId)
                        .header("Authorization", bearer(doctorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(noteBody))
                .andExpect(status().isForbidden());

        MvcResult taskResult = mockMvc.perform(post(clinicalPath + "/nursing-tasks", patientId)
                        .header("Authorization", bearer(doctorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"description":"Check patient comfort"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andReturn();
        String taskId = objectMapper.readTree(taskResult.getResponse().getContentAsString())
                .get("id").asText();
        mockMvc.perform(patch(clinicalPath + "/nursing-tasks/{taskId}/status", patientId, taskId)
                        .header("Authorization", bearer(nurseToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"IN_PROGRESS"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));
        mockMvc.perform(post(clinicalPath + "/nursing-tasks", patientId)
                        .header("Authorization", bearer(nurseToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"description":"Nurse cannot create or edit task details"}
                                """))
                .andExpect(status().isForbidden());
        mockMvc.perform(get(clinicalPath + "/nursing-tasks", unassignedPatientId)
                        .header("Authorization", bearer(nurseToken)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get(clinicalPath + "/clinical-records", patientId)
                        .header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk());
    }

    @Test
    void logoutRevokesTheTokenAndPreventsFurtherProtectedAccess() throws Exception {
        String token = login(adminEmail);
        mockMvc.perform(post("/api/auth/logout").header("Authorization", bearer(token)))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/patients").header("Authorization", bearer(token)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void patientsCanOnlyCancelAppointmentsLinkedToTheirOwnAccount() throws Exception {
        String ownerEmail = "appointment-owner-" + UUID.randomUUID().toString().substring(0, 8)
                + "@medicare.test";
        String otherEmail = "appointment-other-" + UUID.randomUUID().toString().substring(0, 8)
                + "@medicare.test";
        String ownerPassword = randomPassword();
        String otherPassword = randomPassword();

        for (String email : List.of(ownerEmail, otherEmail)) {
            RegisterRequest registration = new RegisterRequest(
                    email, email.equals(ownerEmail) ? ownerPassword : otherPassword,
                    "Appointment Patient", 36, "Other", "555-0155",
                    "Test address", null);
            mockMvc.perform(post("/api/auth/register")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(registration)))
                    .andExpect(status().isCreated());
        }

        String ownerToken = login(ownerEmail, ownerPassword);
        String otherToken = login(otherEmail, otherPassword);
        AppointmentDto request = new AppointmentDto();
        request.setPatientName("Untrusted submitted name");
        request.setPatientPhone("555-0155");
        request.setDoctorName(doctor.getName());
        request.setDate(LocalDate.now().plusDays(333).toString());
        request.setTime("12:45 AM");
        MvcResult created = mockMvc.perform(post("/api/patient-portal/appointments")
                        .header("Authorization", bearer(ownerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("Pending"))
                .andReturn();
        String appointmentId = objectMapper.readTree(created.getResponse().getContentAsString())
                .get("id").asText();

        mockMvc.perform(put("/api/patient-portal/appointments/{appointmentId}/cancel", appointmentId)
                        .header("Authorization", bearer(otherToken)))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/api/patient-portal/appointments/{appointmentId}/cancel", appointmentId)
                        .header("Authorization", bearer(ownerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("Cancelled"));
    }

    @Test
    void newlyRegisteredPatientCanReadOnlyTheirLinkedPortalAndClinicalRecords() throws Exception {
        String email = "registered-" + UUID.randomUUID().toString().substring(0, 8) + "@medicare.test";
        String password = randomPassword();
        RegisterRequest request = new RegisterRequest(email, password, "Registered Patient",
                42, "Other", "555-0108", "Portal Address", null);

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("PATIENT"));

        String patientToken = login(email, password);
        mockMvc.perform(get("/api/auth/me").header("Authorization", bearer(patientToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("PATIENT"));
        mockMvc.perform(get("/api/patients").header("Authorization", bearer(patientToken)))
                .andExpect(status().isForbidden());

        Patient ownProfile = patientRepository.findByPatientAccount_EmailIgnoreCase(email).orElseThrow();
        InvoiceDto invoice = new InvoiceDto();
        invoice.setPatientId(ownProfile.getPatientId());
        invoice.setPatientName(ownProfile.getName());
        invoice.setDepartment("Test Cardiology");
        invoice.setDate(LocalDate.now().toString());
        invoice.setAmount(BigDecimal.valueOf(85));
        MvcResult invoiceCreated = mockMvc.perform(post("/api/billing")
                        .header("Authorization", bearer(login(adminEmail)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invoice)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.patientId").value(ownProfile.getPatientId()))
                .andReturn();
        String invoiceNumber = objectMapper.readTree(invoiceCreated.getResponse().getContentAsString())
                .get("id").asText();
        mockMvc.perform(get("/api/patient-portal/me").header("Authorization", bearer(patientToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile.id").value(ownProfile.getPatientId()))
                .andExpect(jsonPath("$.profile.name").value("Registered Patient"))
                .andExpect(jsonPath("$.appointments").isArray())
                .andExpect(jsonPath("$.invoices[0].id").value(invoiceNumber));
        mockMvc.perform(get("/api/patients/{id}/clinical-records", ownProfile.getPatientId())
                        .header("Authorization", bearer(patientToken)))
                .andExpect(status().isOk());

        Patient unlinkedProfile = patientRepository.findAll().stream()
                .filter(patient -> patient.getPatientAccount() == null)
                .findFirst().orElseThrow();
        mockMvc.perform(get("/api/patients/{id}/clinical-records", unlinkedProfile.getPatientId())
                        .header("Authorization", bearer(patientToken)))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/patients/{id}/vitals", ownProfile.getPatientId())
                        .header("Authorization", bearer(patientToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"WEIGHT_KG\",\"value\":70}"))
                .andExpect(status().isForbidden());

        AppointmentDto appointmentRequest = new AppointmentDto();
        appointmentRequest.setPatientName("Untrusted submitted name");
        appointmentRequest.setPatientPhone("555-0000");
        appointmentRequest.setDoctorName(doctor.getName());
        appointmentRequest.setDate(LocalDate.now().plusDays(103).toString());
        appointmentRequest.setTime("11:32 AM");
        appointmentRequest.setStatus("Confirmed");
        mockMvc.perform(post("/api/patient-portal/appointments")
                        .header("Authorization", bearer(patientToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(appointmentRequest)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.patientName").value("Registered Patient"))
                .andExpect(jsonPath("$.patientId").value(ownProfile.getPatientId()))
                .andExpect(jsonPath("$.status").value("Pending"));
        mockMvc.perform(get("/api/patient-portal/me").header("Authorization", bearer(patientToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.appointments[0].patientId").value(ownProfile.getPatientId()));
        mockMvc.perform(post("/api/patient-portal/invoices/INV-NOT-REAL/checkout")
                        .header("Authorization", bearer(patientToken)))
                .andExpect(status().isServiceUnavailable());
    }

    @Test
    void billingStatusChangesRequireAuthorizedStaffAndDoNotRepresentGatewayProcessing() throws Exception {
        InvoiceDto invoice = new InvoiceDto();
        invoice.setPatientName("Test Billing Patient");
        invoice.setDepartment("Test Cardiology");
        invoice.setDate(LocalDate.now().toString());
        invoice.setAmount(BigDecimal.valueOf(120));
        invoice.setMethod("Direct Payment");

        mockMvc.perform(post("/api/billing")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invoice)))
                .andExpect(status().isUnauthorized());
        MvcResult created = mockMvc.perform(post("/api/billing")
                        .header("Authorization", bearer(login(adminEmail)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invoice)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("Pending"))
                .andReturn();
        String invoiceId = objectMapper.readTree(created.getResponse().getContentAsString())
                .get("id").asText();

        mockMvc.perform(patch("/api/billing/{id}/pay", invoiceId)
                        .header("Authorization", bearer(login(doctorEmail))))
                .andExpect(status().isForbidden());
        mockMvc.perform(patch("/api/billing/{id}/pay", invoiceId)
                        .header("Authorization", bearer(login(adminEmail))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("Paid"));
    }

    @Test
    void publicContactEndpointFailsExplicitlyWhenSmtpIsNotConfigured() throws Exception {
        ContactInquiryRequest inquiry = new ContactInquiryRequest(
                "Jordan Example",
                "jordan@example.test",
                "+1 555 010 0100",
                "Cardiology",
                "Please contact me about office hours.");

        mockMvc.perform(post("/api/contact")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(inquiry)))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.message").value("Contact email delivery is not configured."));
    }

    private User saveUser(String email, Role role, Doctor linkedDoctor) {
        User user = new User(null, email, passwordEncoder.encode(testPassword), role.name() + " User", role);
        user.setDoctorProfile(linkedDoctor);
        return userRepository.save(user);
    }

    private String login(String email) throws Exception {
        return login(email, testPassword);
    }

    private String login(String email, String password) throws Exception {
        AuthRequest request = new AuthRequest(email, password);
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token", notNullValue()))
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("token").asText();
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }

    private static String randomPassword() {
        return UUID.randomUUID() + "Aa1!";
    }
}
