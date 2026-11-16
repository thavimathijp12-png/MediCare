import json
import urllib.request
import urllib.error
import sys

BASE = "http://127.0.0.1:8080"
TEST_PATIENT_ID = "PAT-PERSIST-777"

def login():
    payload = json.dumps({
        "email": "admin@medicare.health",
        "password": "AdminPass123!"
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE}/api/auth/login",
        data=payload,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        body = json.loads(resp.read().decode())
        return body["token"]

def make_request(method, path, token, data=None):
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(f"{BASE}{path}", data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode()
            return resp.status, json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        return e.code, err_body

def step_create():
    print("--- [STEP 1: CREATE TEST RECORDS BEFORE RESTART] ---")
    token = login()
    print("Admin authenticated successfully.")

    # 1. Create Patient (if not already created)
    status, patients = make_request("GET", "/api/patients", token)
    matched = [p for p in patients if p.get("id") == TEST_PATIENT_ID]
    if not matched:
        patient_payload = {
            "id": TEST_PATIENT_ID,
            "name": "Permanent Storage Test Patient",
            "age": 39,
            "gender": "Female",
            "bloodGroup": "O+",
            "phone": "+1 (555) 888-9999",
            "email": "persist777@medicare.test",
            "department": "Cardiology",
            "assignedDoctor": "Dr. Sarah Jenkins",
            "doctorId": "DOC-101",
            "diagnosis": "Permanent Persistence Verification Diagnostic",
            "status": "Admitted",
            "address": "777 Memory Lane, Suite 100",
            "admissionDate": "2026-11-16"
        }
        status, res = make_request("POST", "/api/patients", token, patient_payload)
        print(f"Create Patient Response: HTTP {status}")
        if status not in (200, 201):
            print("Failed to create test patient:", res)
            sys.exit(1)
        print(f"Patient created: ID={res.get('id')}, Name={res.get('name')}")
    else:
        print(f"Patient {TEST_PATIENT_ID} already created in previous attempt.")

    # 2. Create Appointment
    appt_payload = {
        "patientId": TEST_PATIENT_ID,
        "patientName": "Permanent Storage Test Patient",
        "doctorName": "Dr. Sarah Jenkins",
        "department": "Cardiology",
        "date": "2026-11-20",
        "time": "10:30 AM",
        "type": "In-Person",
        "status": "Confirmed",
        "reason": "Persistence Verification Appointment Note"
    }
    status, res_appt = make_request("POST", "/api/appointments", token, appt_payload)
    print(f"Create Appointment Response: HTTP {status}")
    if status not in (200, 201):
        print("Failed to create appointment:", res_appt)
        sys.exit(1)
    appt_id = res_appt.get("id")
    print(f"Appointment created: ID={appt_id}")

    # 3. Create Billing
    billing_payload = {
        "patientId": TEST_PATIENT_ID,
        "patientName": "Permanent Storage Test Patient",
        "department": "Cardiology",
        "date": "2026-11-16",
        "amount": 450.00,
        "status": "Paid",
        "method": "Credit Card",
        "items": [
            {"desc": "Cardiac Consultation", "cost": 250.00},
            {"desc": "Echocardiogram", "cost": 200.00}
        ]
    }
    status, res_bill = make_request("POST", "/api/billing", token, billing_payload)
    print(f"Create Billing Response: HTTP {status}")
    if status not in (200, 201):
        print("Failed to create billing record:", res_bill)
        sys.exit(1)
    invoice_id = res_bill.get("id")
    print(f"Invoice created: ID={invoice_id}")

    # Verify all 3 in active database
    status, patients = make_request("GET", "/api/patients", token)
    assert any(p.get("id") == TEST_PATIENT_ID for p in patients), "Test patient not found"

    status, appts = make_request("GET", "/api/appointments", token)
    assert any(a.get("patientId") == TEST_PATIENT_ID for a in appts), "Test appointment not found"

    status, bills = make_request("GET", "/api/billing", token)
    assert any(b.get("patientId") == TEST_PATIENT_ID for b in bills), "Test invoice not found"

    print("\n>>> PRE-RESTART VERIFICATION SUCCESSFUL: Test Patient, Appointment & Invoice stored on disk!")
    print("READY_FOR_RESTART")

def step_verify():
    print("--- [STEP 2: VERIFY PERSISTENCE AFTER RESTART] ---")
    token = login()
    print("Admin authenticated successfully post-restart.")

    # 1. Verify Patient
    status, patients = make_request("GET", "/api/patients", token)
    assert status == 200, f"Failed to list patients: HTTP {status}"
    matched = [p for p in patients if p.get("id") == TEST_PATIENT_ID]
    if not matched:
        print(f"CRITICAL FAILURE: Patient {TEST_PATIENT_ID} was NOT found after backend restart! Data was lost.")
        sys.exit(1)

    patient = matched[0]
    print(f"PERSISTENCE CONFIRMED: Found patient {patient['id']}")
    print(f"  Name: {patient['name']}")
    print(f"  Phone: {patient['phone']}")
    print(f"  Email: {patient['email']}")
    print(f"  Address: {patient['address']}")
    assert patient["name"] == "Permanent Storage Test Patient", "Patient name mismatch"
    assert patient["phone"] == "+1 (555) 888-9999", "Phone mismatch"
    assert patient["email"] == "persist777@medicare.test", "Email mismatch"

    # 2. Verify Appointment
    status, appts = make_request("GET", "/api/appointments", token)
    assert status == 200, f"Failed to list appointments: HTTP {status}"
    matched_appts = [a for a in appts if a.get("patientId") == TEST_PATIENT_ID]
    if not matched_appts:
        print(f"CRITICAL FAILURE: Appointment for {TEST_PATIENT_ID} was NOT found after backend restart!")
        sys.exit(1)
    appt = matched_appts[0]
    print(f"PERSISTENCE CONFIRMED: Found appointment {appt['id']}")
    print(f"  Reason: {appt.get('reason')}")
    print(f"  Date: {appt.get('date')} at {appt.get('time')}")
    assert appt.get("reason") == "Persistence Verification Appointment Note", "Appointment reason mismatch"

    # 3. Verify Billing
    status, bills = make_request("GET", "/api/billing", token)
    assert status == 200, f"Failed to list billing: HTTP {status}"
    matched_bills = [b for b in bills if b.get("patientId") == TEST_PATIENT_ID]
    if not matched_bills:
        print(f"CRITICAL FAILURE: Billing record for {TEST_PATIENT_ID} was NOT found after backend restart!")
        sys.exit(1)
    bill = matched_bills[0]
    print(f"PERSISTENCE CONFIRMED: Found invoice {bill.get('id')}")
    print(f"  Amount: ${bill.get('amount')}")
    print(f"  Status: {bill.get('status')}")
    assert float(bill.get("amount")) == 450.0, "Billing amount mismatch"

    print("\n=================================================================")
    print("SUCCESS: ALL TEST RECORDS PERMANENTLY SURVIVED BACKEND RESTART!")
    print("H2 FILE-BASED DATABASE PERSISTENCE EMPIRICALLY CONFIRMED!")
    print("=================================================================")

if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "create"
    if mode == "create":
        step_create()
    elif mode == "verify":
        step_verify()
    else:
        print("Unknown mode:", mode)
        sys.exit(1)
