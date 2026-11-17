# MediCare – Hospital Management System

[![Java](https://img.shields.io/badge/Java-25-orange.svg?style=flat&logo=openjdk)](https://openjdk.org/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.5.16-brightgreen.svg?style=flat&logo=springboot)](https://spring.io/projects/spring-boot)
[![Spring Security](https://img.shields.io/badge/Spring%20Security-JWT-blue.svg?style=flat&logo=springsecurity)](https://spring.io/projects/spring-security)
[![Database](https://img.shields.io/badge/Database-H2%20File%20%7C%20MySQL-blueviolet.svg?style=flat&logo=h2)](https://h2database.com/)
[![Flyway](https://img.shields.io/badge/Flyway-V1--V4-red.svg?style=flat&logo=flyway)](https://flywaydb.org/)
[![Playwright](https://img.shields.io/badge/Playwright-E2E%20Tested-purple.svg?style=flat&logo=playwright)](https://playwright.dev/)
[![Status](https://img.shields.io/badge/Build-Passing-success.svg?style=flat)]()

**MediCare** is an enterprise-grade, full-stack Hospital Management and Patient Portal application. It provides end-to-end clinical workflow automation, role-based staff operations (Administrator, Doctor, Receptionist), self-service patient access, intelligent appointment scheduling with conflict prevention, billing and invoicing, and persistent transactional storage.

---

## Table of Contents

- [Overview & Architecture](#overview--architecture)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [1. Backend Setup & Startup](#1-backend-setup--startup)
  - [2. Frontend Setup & Startup](#2-frontend-setup--startup)
  - [3. Default Credentials & Access URLs](#3-default-credentials--access-urls)
- [Configuration & Environment Variables](#configuration--environment-variables)
- [Database Schema & Migrations](#database-schema--migrations)
- [REST API Reference](#rest-api-reference)
- [Testing](#testing)
  - [Backend Test Suite (Maven)](#backend-test-suite-maven)
  - [Playwright End-to-End Suite](#playwright-end-to-end-suite)
  - [Automated UI Navigation Test](#automated-ui-navigation-test)
- [Security Architecture](#security-architecture)
- [License](#license)

---

## Overview & Architecture

MediCare is structured into a lightweight, decoupled frontend and a robust Java Spring Boot 3 REST API backend backed by persistent transactional storage:

```
+-------------------------------------------------------------------------+
|                              USER AGENTS                                |
|   Public Visitors       Patients (Self-Service)     Hospital Staff/Admin  |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
|                  FRONTEND CLIENT (Port 5501)                            |
|   HTML5 * CSS3 * JavaScript (ES6+) * Bootstrap 5.3 * FontAwesome        |
|   - Public Hospital Catalog & Inquiry Form                              |
|   - Patient Health Portal (Auth, Appointments, Records, Payments)       |
|   - Staff Back-Office Dashboard (Patients, Doctors, Invoices, Settings)  |
+-------------------------------------------------------------------------+
                                    |
                         REST / JSON (JWT Bearer)
                                    v
+-------------------------------------------------------------------------+
|             SPRING BOOT 3 BACKEND API (Port 8080)                       |
|   Spring Security (BCrypt + JWT Filter)                                 |
|   Role-Based Access Control (ADMIN, DOCTOR, RECEPTIONIST, PATIENT)      |
|   Spring Data JPA / Hibernate ORM (Validation Mode)                     |
|   Flyway Database Migrations (V1 -> V4)                                 |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
|                     DATA PERSISTENCE LAYER                              |
|   Persistent H2 Database: ./data/medicare.mv.db                         |
|   (MySQL Compatibility Mode; Optional MySQL 8+ Production Profile)       |
+-------------------------------------------------------------------------+
```

---

## Key Features

### 1. Public Hospital Portal
- **Services & Departments Directory:** Browse departments, specialized services, and operating hours.
- **Doctor Directory:** View active doctors, their qualifications, specialties, and experience.
- **Inquiry & Contact Form:** Submit questions and requests directly to hospital administration.

### 2. Patient Health Portal
- **Self-Registration & Authentication:** Secure patient signup with strong password enforcement and token-based sessions.
- **My Health Dashboard:** Comprehensive view of upcoming/past appointments, prescribed medications, clinical notes, and vital signs.
- **Self-Service Appointment Booking:** Choose preferred doctor, date, and time slot.
- **Billing & Invoices:** Review detailed hospital itemized invoices with payment status tracking.

### 3. Staff & Administrative Dashboard
- **Role-Based Access Control (RBAC):** Distinct permission tiers for `ADMIN`, `DOCTOR`, and `RECEPTIONIST`.
- **KPI Analytics:** Real-time metrics for total patients, active doctors, scheduled appointments, pending/completed invoices, and revenue.
- **Patient Management:** Full CRUD operations for patient records, medical history, allergies, and contact details.
- **Doctor & Department Rostering:** Manage medical departments, doctor assignments, and availability.
- **Appointment Scheduling Engine:** Advanced conflict prevention logic that prevents double booking the same physician at the same date and time.
- **Billing & Invoicing:** Generate multi-item medical invoices, record payments, and track outstanding balances.
- **Audit Logging:** Automated capture of critical system actions (patient creation, billing changes, appointments).

---

## Technology Stack

### Backend
- **Language:** Java 25
- **Framework:** Spring Boot 3.5.16
- **Security:** Spring Security 6 with JJWT (`io.jsonwebtoken 0.11.5`) & BCrypt password hashing
- **Persistence:** Spring Data JPA, Hibernate 6.6
- **Database Migrations:** Flyway 10+ (`flyway-core`, `flyway-mysql`)
- **Validation:** Jakarta Bean Validation (`spring-boot-starter-validation`)
- **Email Delivery:** JavaMailSender (`spring-boot-starter-mail`)
- **Testing:** JUnit 5, Mockito, Spring Boot Test, MockMvc

### Frontend
- **Languages:** Semantic HTML5, CSS3, Modern Vanilla JavaScript (ES6+)
- **UI Framework:** Bootstrap 5.3.2
- **Icons:** FontAwesome 6.4.0
- **Dev Server:** Built-in zero-dependency Node.js HTTP server (`serve.js`)
- **Testing:** Playwright (`@playwright/test` 1.58.2)

### Database
- **Development/Default:** H2 Database Engine running in MySQL Compatibility Mode with persistent file storage (`./data/medicare.mv.db`)
- **Production (Supported):** MySQL 8+ (`mysql-connector-j` included)

---

## Project Structure

```
Medi Care/
├── backend/                                # Spring Boot Java backend
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/medicare/
│   │   │   │   ├── config/                 # SecurityConfig, Flyway, BootstrapAdminInitializer
│   │   │   │   ├── controller/             # REST API Controllers (13 controllers)
│   │   │   │   ├── dto/                    # Request & Response DTOs
│   │   │   │   ├── entity/                 # JPA Entities (User, Patient, Doctor, Invoice, etc.)
│   │   │   │   ├── exception/              # GlobalExceptionHandler and custom exceptions
│   │   │   │   ├── repository/             # Spring Data JPA Repository interfaces
│   │   │   │   ├── security/               # JwtTokenProvider, JwtAuthenticationFilter, UserPrincipal
│   │   │   │   └── service/                # Business logic services
│   │   │   └── resources/
│   │   │       ├── application.properties  # Base configuration
│   │   │       ├── application-dev.properties # Local development profile
│   │   │       ├── application-mysql.properties # MySQL production profile
│   │   │       ├── application-test.properties # Testing profile (in-memory H2)
│   │   │       └── db/migration/           # Flyway SQL migrations (V1 to V4)
│   │   └── test/                           # 30 Unit and integration tests
│   ├── mvnw / mvnw.cmd                     # Maven wrapper scripts
│   └── pom.xml                             # Maven build specification
├── data/                                   # Persistent H2 file database folder
│   └── medicare.mv.db                      # Database storage file (git-ignored)
├── tests/                                  # Playwright E2E test suite
│   └── e2e/
│       ├── helpers.js                      # Test helpers, authentication & API utilities
│       ├── patient-appointment.spec.js     # Patient appointment booking & ownership spec
│       ├── patient-invoice.spec.js         # Patient invoice viewing & checkout spec
│       ├── patient-registration.spec.js    # Patient registration & login spec
│       └── serve-frontend.js               # Isolated frontend test server
├── index.html                              # Single-page application HTML structure
├── script.js                               # Frontend logic, state store, and API client
├── style.css                               # Custom stylesheet & theme overrides
├── serve.js                                # Frontend static HTTP file server
├── package.json                            # Node.js dependencies & test scripts
├── playwright.config.js                    # Playwright test runner configuration
├── test_buttons.js                         # Automated UI navigation & button verification script
└── README.md                               # Project documentation
```

---

## Prerequisites

Before running the project, ensure you have the following installed on your machine:

1. **Java Development Kit (JDK):** Version 25 or higher (Java 25 LTS is the backend target)
   ```bash
   java -version
   ```
2. **Node.js:** Version 18 or higher (LTS recommended)
   ```bash
   node -v
   npm -v
   ```
3. **Git:** Optional, for version control

---

## Getting Started

### 1. Backend Setup & Startup

The backend is built with the Maven Wrapper (`mvnw`), so a standalone Maven installation is not strictly required.

#### Using Maven Wrapper (Windows PowerShell / CMD):
```powershell
cd backend
.\mvnw.cmd clean package -DskipTests
java -jar target/medicare-backend-1.0.0.jar --spring.profiles.active=dev --server.port=8080 --MEDICARE_BOOTSTRAP_ADMIN_EMAIL=admin@medicare.health --MEDICARE_BOOTSTRAP_ADMIN_PASSWORD=AdminPass123!
```

#### Using Maven Wrapper (Linux / macOS):
```bash
cd backend
./mvnw clean package -DskipTests
java -jar target/medicare-backend-1.0.0.jar --spring.profiles.active=dev --server.port=8080 --MEDICARE_BOOTSTRAP_ADMIN_EMAIL=admin@medicare.health --MEDICARE_BOOTSTRAP_ADMIN_PASSWORD=AdminPass123!
```

> **Note:** The backend will automatically apply Flyway migrations V1–V4 and initialize the persistent database file in `backend/../data/medicare.mv.db`.

### 2. Frontend Setup & Startup

Install dev dependencies (for Playwright testing) and start the local frontend server:

```powershell
# In the root project directory:
npm install
node serve.js
```

Or using npm scripts:
```powershell
npm start
```

The frontend server starts listening at **`http://127.0.0.1:5501`**.

### 3. Default Credentials & Access URLs

| Portal | URL | Credentials |
| :--- | :--- | :--- |
| **Public Website** | [http://127.0.0.1:5501/index.html](http://127.0.0.1:5501/index.html) | No login required |
| **Staff & Admin Portal** | Click **"Staff Login"** in navbar | **Email:** `admin@medicare.health`<br>**Password:** `AdminPass123!` |
| **Patient Portal** | Click **"Patient Portal"** in navbar | Register a new account or sign in |
| **Backend REST API** | [http://127.0.0.1:8080](http://127.0.0.1:8080) | Bearer Token Auth |

---

## Configuration & Environment Variables

All core backend parameters can be customized via environment variables or Spring configuration:

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `SERVER_PORT` | `8080` | Port for the Spring Boot REST API |
| `MEDICARE_DB_URL` | `jdbc:h2:file:./data/medicare;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE;AUTO_SERVER=TRUE` | Database JDBC connection URL |
| `MEDICARE_DB_USERNAME` | `sa` | Database user |
| `MEDICARE_DB_PASSWORD` | *(empty)* | Database password |
| `MEDICARE_DB_DRIVER_CLASS_NAME` | `org.h2.Driver` | JDBC driver class name |
| `MEDICARE_JWT_SECRET` | Auto-generated in `dev` | Base64 HMAC SHA-256 secret key |
| `MEDICARE_JWT_EXPIRATION` | `86400000` (24h) | JWT Token expiration time in milliseconds |
| `MEDICARE_CORS_ALLOWED_ORIGINS` | `http://localhost:5501,http://127.0.0.1:5501,...` | Comma-separated list of allowed CORS origins |
| `MEDICARE_BOOTSTRAP_ADMIN_EMAIL` | `admin@medicare.health` | Initial administrator email for development |
| `MEDICARE_BOOTSTRAP_ADMIN_PASSWORD`| `AdminPass123!` | Initial administrator password for development |
| `MEDICARE_SMTP_HOST` | *(empty)* | SMTP server hostname for outbound contact emails |
| `MEDICARE_SMTP_PORT` | `587` | SMTP port |
| `MEDICARE_STRIPE_SECRET_KEY` | *(empty)* | Optional Stripe API secret key for payments |

### Running with MySQL (Production Profile)
To connect to a live MySQL instance, run with the `mysql` profile:
```bash
java -jar target/medicare-backend-1.0.0.jar \
  --spring.profiles.active=mysql \
  --MEDICARE_DB_URL=jdbc:mysql://localhost:3306/medicare?useSSL=false&serverTimezone=UTC \
  --MEDICARE_DB_USERNAME=medicare_user \
  --MEDICARE_DB_PASSWORD=your_secure_password
```

---

## Database Schema & Migrations

Database schema versioning is managed strictly via **Flyway**:

- **`V1__create_medicare_schema.sql`**: Core hospital tables:
  - `departments` (ID, name, head doctor, description)
  - `doctors` (ID, name, email, department, qualification, experience, fee)
  - `patients` (ID, name, email, phone, age, gender, blood group, medical history, allergies)
  - `appointments` (ID, patient, doctor, date, time, status, reason)
  - `invoices` & `invoice_items` (ID, patient, amount, payment method, itemized list)
  - `users` (Staff accounts, BCrypt passwords, role: `ADMIN`, `DOCTOR`, `RECEPTIONIST`)
  - `activity_logs` (Audit events, timestamps, user actions)
- **`V2__add_clinical_care_records.sql`**: Clinical records:
  - `clinical_notes` (Doctor notes, diagnosis, observations)
  - `prescriptions` & `prescription_items` (Medications, dosage, frequency)
  - `vitals` (Blood pressure, heart rate, temperature, SpO2, respiratory rate)
- **`V3__link_patient_accounts.sql`**: Self-service patient portal tables:
  - `patient_accounts` (Hashed credentials, linked patient record, verified status)
- **`V4__record_stripe_webhook_events.sql`**: Idempotent webhook event ledger:
  - `stripe_events` (Event ID, type, payload, processing status)

---

## REST API Reference

### Authentication
- `POST /api/auth/login` – Authenticate staff member, return JWT token.
- `GET /api/auth/me` – Retrieve current authenticated staff profile.

### Public & Patient Portal
- `POST /api/patient-portal/register` – Register a new patient account.
- `POST /api/patient-portal/login` – Patient login, return patient JWT.
- `GET /api/patient-portal/me` – Patient dashboard (appointments, invoices, clinical records, vitals).
- `POST /api/patient-portal/appointments` – Request a new appointment as a patient.
- `POST /api/patient-portal/checkout` – Initiate Stripe checkout session for pending invoice.
- `POST /api/contact` – Submit public inquiry / contact form.

### Hospital Operations (Secured)
- `GET /api/doctors` – List all doctors (Public/Staff).
- `POST /api/doctors` – Add doctor (`ADMIN`).
- `PUT /api/doctors/{id}` – Update doctor (`ADMIN`).
- `DELETE /api/doctors/{id}` – Remove doctor (`ADMIN`).
- `GET /api/departments` – List hospital departments.
- `POST /api/departments` – Add department (`ADMIN`).
- `GET /api/patients` – List all patients (`STAFF`).
- `POST /api/patients` – Register new patient (`STAFF`).
- `GET /api/patients/{id}` – Get detailed patient record.
- `GET /api/appointments` – List all appointments.
- `POST /api/appointments` – Book appointment (includes schedule conflict verification).
- `PUT /api/appointments/{id}/status` – Update appointment status (`Confirmed`, `Completed`, `Cancelled`).
- `GET /api/billing` – List invoices (`ADMIN`, `RECEPTIONIST`).
- `POST /api/billing` – Create itemized invoice.
- `GET /api/dashboard/stats` – Hospital KPI statistics (`ADMIN`).
- `GET /api/activity` – Recent audit activity logs (`ADMIN`).
- `GET /api/admin/staff` – List staff members (`ADMIN`).
- `POST /api/admin/staff` – Create staff account (`ADMIN`).

---

## Testing

### Backend Test Suite (Maven)
The backend includes 30 unit and integration tests covering security, JWT, validation, services, and REST API controllers:

```powershell
cd backend
.\mvnw.cmd test
```
*Expected Result:*
```
[INFO] Results:
[INFO] Tests run: 30, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

### Playwright End-to-End Suite
E2E tests run against the headless browser to verify registration, appointments, and billing:

```powershell
$env:MEDICARE_BOOTSTRAP_ADMIN_EMAIL='admin@medicare.health'
$env:MEDICARE_BOOTSTRAP_ADMIN_PASSWORD='AdminPass123!'
npx playwright test
```
*Expected Result:*
```
Running 3 tests using 1 worker

  ok 1 tests\e2e\patient-appointment.spec.js (patient appointment requests)
  ok 2 tests\e2e\patient-invoice.spec.js (patient invoice viewing & checkout)
  ok 3 tests\e2e\patient-registration.spec.js (patient registration & profile)

  3 passed (18.0s)
```

### Automated UI Navigation Test
An automated script verifies all buttons, navigation flows, and modals without console errors:

```powershell
node test_buttons.js
```
*Expected Result:*
```
ZERO browser console errors detected! All operations passed cleanly.
```

---

## Security Architecture

1. **Stateless JWT Authentication:**
   - Staff and patient sessions use cryptographically signed JSON Web Tokens (HMAC-SHA256).
   - Bearer tokens are validated per-request via `JwtAuthenticationFilter`.
2. **Password Security:**
   - Passwords are encrypted using Spring Security's `BCryptPasswordEncoder` with salt.
3. **CORS Isolation:**
   - Configurable origins via `medicare.cors.allowed-origins` prevent unauthorized cross-origin requests.
4. **Input Sanitization & Validation:**
   - Jakarta Validation on all incoming DTOs (`@NotBlank`, `@Email`, `@Min`, `@Size`).
   - HTML output sanitization (`escapeHtml`) on frontend DOM operations to mitigate XSS risks.
5. **Role-Based Authorization:**
   - Spring Security `@PreAuthorize` or request matchers enforce least privilege across endpoints.

---

## License

This project is licensed under the MIT License. See the `LICENSE` file for full terms.

