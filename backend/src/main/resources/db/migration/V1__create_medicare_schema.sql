CREATE TABLE roles (
    role_name VARCHAR(32) NOT NULL PRIMARY KEY
);

INSERT INTO roles (role_name) VALUES
    ('ADMIN'),
    ('DOCTOR'),
    ('RECEPTIONIST'),
    ('NURSE'),
    ('PATIENT');

CREATE TABLE departments (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(16) NOT NULL UNIQUE,
    description VARCHAR(1000),
    location VARCHAR(160),
    head_doctor_name VARCHAR(120),
    total_beds INT NOT NULL,
    occupied_beds INT NOT NULL
);

CREATE TABLE doctors (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    doctor_id VARCHAR(24) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    degree VARCHAR(160),
    department_name VARCHAR(100),
    department_id BIGINT,
    experience_years INT NOT NULL,
    consultation_fee DECIMAL(10, 2),
    phone VARCHAR(40),
    email VARCHAR(254),
    status VARCHAR(32) NOT NULL,
    rating DECIMAL(3, 2),
    review_count INT NOT NULL,
    image_url VARCHAR(500),
    biography VARCHAR(2000),
    CONSTRAINT fk_doctors_department FOREIGN KEY (department_id) REFERENCES departments (id)
);

CREATE TABLE users (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    doctor_profile_id BIGINT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL,
    CONSTRAINT fk_users_doctor_profile FOREIGN KEY (doctor_profile_id) REFERENCES doctors (id)
);

CREATE TABLE user_roles (
    user_id BIGINT NOT NULL,
    role_name VARCHAR(32) NOT NULL,
    PRIMARY KEY (user_id, role_name),
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_user_roles_role FOREIGN KEY (role_name) REFERENCES roles (role_name)
);

CREATE TABLE patients (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    patient_id VARCHAR(24) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    age INT NOT NULL,
    gender VARCHAR(24) NOT NULL,
    blood_group VARCHAR(8),
    phone VARCHAR(40),
    email VARCHAR(254),
    medical_condition VARCHAR(500),
    doctor_name VARCHAR(120),
    doctor_id BIGINT,
    status VARCHAR(32) NOT NULL,
    address VARCHAR(500),
    admission_date DATE,
    CONSTRAINT fk_patients_doctor FOREIGN KEY (doctor_id) REFERENCES doctors (id)
);

CREATE TABLE patient_nurse_assignments (
    patient_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    PRIMARY KEY (patient_id, user_id),
    CONSTRAINT fk_patient_nurses_patient FOREIGN KEY (patient_id) REFERENCES patients (id),
    CONSTRAINT fk_patient_nurses_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE appointments (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    appointment_id VARCHAR(32) NOT NULL UNIQUE,
    token_number INT NOT NULL,
    patient_name VARCHAR(120) NOT NULL,
    patient_phone VARCHAR(40),
    doctor_name VARCHAR(120) NOT NULL,
    department_name VARCHAR(100),
    doctor_id BIGINT,
    department_id BIGINT,
    patient_record_id BIGINT,
    appointment_date DATE NOT NULL,
    time VARCHAR(32) NOT NULL,
    type VARCHAR(32),
    status VARCHAR(32) NOT NULL,
    reason VARCHAR(1000),
    created_at TIMESTAMP NOT NULL,
    CONSTRAINT fk_appointments_doctor FOREIGN KEY (doctor_id) REFERENCES doctors (id),
    CONSTRAINT fk_appointments_department FOREIGN KEY (department_id) REFERENCES departments (id),
    CONSTRAINT fk_appointments_patient FOREIGN KEY (patient_record_id) REFERENCES patients (id)
);

CREATE INDEX idx_appointments_date_doctor ON appointments (appointment_date, doctor_id);

CREATE TABLE invoices (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    invoice_number VARCHAR(32) NOT NULL UNIQUE,
    patient_name VARCHAR(120) NOT NULL,
    department_name VARCHAR(100),
    patient_id BIGINT,
    department_id BIGINT,
    invoice_date DATE NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    status VARCHAR(32) NOT NULL,
    method VARCHAR(40),
    CONSTRAINT fk_invoices_patient FOREIGN KEY (patient_id) REFERENCES patients (id),
    CONSTRAINT fk_invoices_department FOREIGN KEY (department_id) REFERENCES departments (id)
);

CREATE TABLE invoice_items (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    invoice_id BIGINT NOT NULL,
    description VARCHAR(240) NOT NULL,
    cost DECIMAL(12, 2) NOT NULL,
    CONSTRAINT fk_invoice_items_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id)
);

CREATE TABLE activity_records (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    icon VARCHAR(80),
    color VARCHAR(40),
    title VARCHAR(120) NOT NULL,
    detail VARCHAR(1000) NOT NULL,
    created_at TIMESTAMP NOT NULL
);

CREATE TABLE revoked_tokens (
    token_id VARCHAR(36) NOT NULL PRIMARY KEY,
    expires_at TIMESTAMP NOT NULL
);
