CREATE TABLE clinical_records (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    patient_id BIGINT NOT NULL,
    diagnosis VARCHAR(500) NOT NULL,
    clinical_note TEXT NOT NULL,
    allergies VARCHAR(2000),
    recorded_by BIGINT NOT NULL,
    recorded_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    CONSTRAINT fk_clinical_records_patient FOREIGN KEY (patient_id) REFERENCES patients (id),
    CONSTRAINT fk_clinical_records_author FOREIGN KEY (recorded_by) REFERENCES users (id)
);

CREATE INDEX idx_clinical_records_patient_date ON clinical_records (patient_id, recorded_at);

CREATE TABLE prescriptions (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    patient_id BIGINT NOT NULL,
    medication VARCHAR(120) NOT NULL,
    strength VARCHAR(80) NOT NULL,
    dose VARCHAR(120) NOT NULL,
    route VARCHAR(80) NOT NULL,
    frequency VARCHAR(120) NOT NULL,
    duration VARCHAR(120) NOT NULL,
    refills INT NOT NULL,
    status VARCHAR(32) NOT NULL,
    prescribed_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    CONSTRAINT fk_prescriptions_patient FOREIGN KEY (patient_id) REFERENCES patients (id),
    CONSTRAINT fk_prescriptions_author FOREIGN KEY (prescribed_by) REFERENCES users (id)
);

CREATE INDEX idx_prescriptions_patient_date ON prescriptions (patient_id, created_at);

CREATE TABLE patient_vitals (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    patient_id BIGINT NOT NULL,
    vital_type VARCHAR(40) NOT NULL,
    measurement_value DECIMAL(8, 3) NOT NULL,
    recorded_by BIGINT NOT NULL,
    recorded_at TIMESTAMP NOT NULL,
    CONSTRAINT fk_patient_vitals_patient FOREIGN KEY (patient_id) REFERENCES patients (id),
    CONSTRAINT fk_patient_vitals_author FOREIGN KEY (recorded_by) REFERENCES users (id)
);

CREATE INDEX idx_patient_vitals_patient_date ON patient_vitals (patient_id, recorded_at);

CREATE TABLE nursing_notes (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    patient_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    authored_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    CONSTRAINT fk_nursing_notes_patient FOREIGN KEY (patient_id) REFERENCES patients (id),
    CONSTRAINT fk_nursing_notes_author FOREIGN KEY (authored_by) REFERENCES users (id)
);

CREATE INDEX idx_nursing_notes_patient_date ON nursing_notes (patient_id, created_at);

CREATE TABLE nursing_care_tasks (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    patient_id BIGINT NOT NULL,
    description VARCHAR(500) NOT NULL,
    status VARCHAR(24) NOT NULL,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    CONSTRAINT fk_nursing_tasks_patient FOREIGN KEY (patient_id) REFERENCES patients (id),
    CONSTRAINT fk_nursing_tasks_author FOREIGN KEY (created_by) REFERENCES users (id)
);

CREATE INDEX idx_nursing_tasks_patient_status ON nursing_care_tasks (patient_id, status);
