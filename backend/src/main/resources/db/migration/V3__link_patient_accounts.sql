ALTER TABLE patients
    ADD COLUMN patient_account_id BIGINT;

ALTER TABLE patients
    ADD CONSTRAINT fk_patients_patient_account
        FOREIGN KEY (patient_account_id) REFERENCES users (id);

CREATE UNIQUE INDEX uk_patients_patient_account
    ON patients (patient_account_id);
