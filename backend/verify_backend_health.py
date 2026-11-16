import json
import urllib.request
import urllib.error
import random
import sys

BASE_URL = "http://localhost:8080"
results = []

def test_endpoint(category, name, method, path, token=None, body=None, expected_status=[200]):
    url = f"{BASE_URL}{path}"
    headers = {"Accept": "application/json"}
    data = None
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode("utf-8")
    
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    status_code = None
    response_body = ""
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            status_code = resp.status
            response_body = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        status_code = e.code
        try:
            response_body = e.read().decode("utf-8")
        except Exception:
            response_body = str(e)
    except Exception as e:
        status_code = 0
        response_body = str(e)

    passed = status_code in expected_status
    status_str = "PASS" if passed else "FAIL"
    res_obj = {
        "category": category,
        "name": name,
        "method": method,
        "path": path,
        "expected": expected_status,
        "actual": status_code,
        "status": status_str,
        "body": response_body
    }
    results.append(res_obj)
    print(f"[{status_str}] {category} - {name} ({method} {path}) -> {status_code} (Expected {expected_status})")
    return status_code, response_body

print(f"=== MEDICARE COMPLETE BACKEND HEALTH & REST API VERIFICATION ({BASE_URL}) ===")

# 1. Auth & Admin Login
status, body = test_endpoint("Auth", "Admin Login", "POST", "/api/auth/login", 
    body={"email": "admin@medicare.health", "password": "AdminPass123!"}, expected_status=[200])

admin_token = None
if status == 200:
    admin_token = json.loads(body).get("token")
    print(f"  -> Successfully authenticated as Admin. Token obtained.")

# 2. Current User Profile
test_endpoint("Auth", "Admin Profile Me", "GET", "/api/auth/me", token=admin_token, expected_status=[200])

# 3. User Registration (Patient)
unique_email = f"patient_{random.randint(10000, 99999)}@medicare.health"
reg_payload = {
    "email": unique_email,
    "password": "PatientPass123!",
    "fullName": "Test Verified Patient",
    "age": 34,
    "gender": "Female",
    "phone": "+1 (555) 321-4567",
    "address": "789 Wellness Blvd",
    "role": "PATIENT"
}
status, body = test_endpoint("Auth", "Patient Registration", "POST", "/api/auth/register",
    body=reg_payload, expected_status=[201])

patient_token = None
if status == 201:
    patient_token = json.loads(body).get("token")
    print(f"  -> Successfully registered new patient account: {unique_email}")

# 4. Security & Role-Based Access Control (RBAC)
test_endpoint("Security", "Unauthenticated Request Blocked", "GET", "/api/dashboard/stats", expected_status=[401])
test_endpoint("Security", "Invalid JWT Token Rejected", "GET", "/api/dashboard/stats", token="invalid.bearer.token", expected_status=[401])
test_endpoint("Security", "Bad Password Login Rejected", "POST", "/api/auth/login",
    body={"email": "admin@medicare.health", "password": "WrongPassword999!"}, expected_status=[401])
test_endpoint("Security", "Patient Forbidden From Dashboard Stats", "GET", "/api/dashboard/stats", token=patient_token, expected_status=[403])
test_endpoint("Security", "Patient Forbidden From Staff Administration", "GET", "/api/admin/staff", token=patient_token, expected_status=[403])
test_endpoint("Security", "Duplicate Registration Blocked", "POST", "/api/auth/register", body=reg_payload, expected_status=[409, 422])

# 5. Public / Catalog Endpoints (Doctors & Departments)
test_endpoint("Doctors", "Get All Doctors", "GET", "/api/doctors", expected_status=[200])
test_endpoint("Doctors", "Get Doctor DOC-101", "GET", "/api/doctors/DOC-101", expected_status=[200])
test_endpoint("Doctors", "Get Doctor DOC-103", "GET", "/api/doctors/DOC-103", expected_status=[200])
test_endpoint("Doctors", "Get Non-Existent Doctor (404)", "GET", "/api/doctors/DOC-NON-EXISTENT", expected_status=[404])
test_endpoint("Departments", "Get All Departments", "GET", "/api/departments", expected_status=[200])
test_endpoint("Departments", "Get Department by ID 1", "GET", "/api/departments/1", expected_status=[200])

# 6. Doctor Management CRUD
test_doc_id = f"DOC-V{random.randint(1000, 9999)}"
doc_payload = {
    "id": test_doc_id,
    "name": "Dr. Verification Specialist",
    "department": "Cardiology",
    "degree": "MD, FACC",
    "experience": "14 Years",
    "fee": 165.00,
    "phone": "+1 (555) 777-8888",
    "email": f"{test_doc_id.lower()}@medicare.health",
    "status": "Available",
    "rating": 4.95,
    "reviews": 16,
    "image": "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=600&q=80",
    "about": "Cardiovascular physician tested during backend verification."
}
test_endpoint("Doctors", "Create Doctor Record", "POST", "/api/doctors", token=admin_token, body=doc_payload, expected_status=[201])
doc_payload["fee"] = 185.00
test_endpoint("Doctors", "Update Doctor Record", "PUT", f"/api/doctors/{test_doc_id}", token=admin_token, body=doc_payload, expected_status=[200])
test_endpoint("Doctors", "Delete Doctor Record", "DELETE", f"/api/doctors/{test_doc_id}", token=admin_token, expected_status=[204])

# 7. Patient Management CRUD
test_endpoint("Patients", "Get All Patients", "GET", "/api/patients", token=admin_token, expected_status=[200])
test_endpoint("Patients", "Get Single Patient PAT-001", "GET", "/api/patients/PAT-001", token=admin_token, expected_status=[200])
test_pat_id = f"PAT-V{random.randint(1000, 9999)}"
pat_payload = {
    "id": test_pat_id,
    "name": "Test Verification Patient",
    "age": 42,
    "gender": "Male",
    "bloodGroup": "O+",
    "phone": "+1 (555) 444-5555",
    "email": f"{test_pat_id.lower()}@example.com",
    "condition": "General Health Assessment",
    "doctor": "Dr. Sarah Jenkins",
    "status": "Outpatient",
    "address": "100 Hospital Ave",
    "admissionDate": "2026-11-16"
}
test_endpoint("Patients", "Create Patient Record", "POST", "/api/patients", token=admin_token, body=pat_payload, expected_status=[201])
pat_payload["condition"] = "Discharged healthy"
test_endpoint("Patients", "Update Patient Record", "PUT", f"/api/patients/{test_pat_id}", token=admin_token, body=pat_payload, expected_status=[200])
test_endpoint("Patients", "Delete Patient Record", "DELETE", f"/api/patients/{test_pat_id}", token=admin_token, expected_status=[204])

# 8. Clinical Records, Prescriptions, Vitals & Nursing (PAT-001)
test_endpoint("Clinical", "Get Clinical Records", "GET", "/api/patients/PAT-001/clinical-records", token=admin_token, expected_status=[200])
test_endpoint("Clinical", "Create Clinical Record", "POST", "/api/patients/PAT-001/clinical-records", token=admin_token,
    body={"diagnosis": "Mild Hypertension", "clinicalNote": "Telemetry monitoring normal.", "allergies": "None"},
    expected_status=[201])

test_endpoint("Clinical", "Get Prescriptions", "GET", "/api/patients/PAT-001/prescriptions", token=admin_token, expected_status=[200])
test_endpoint("Clinical", "Create Prescription", "POST", "/api/patients/PAT-001/prescriptions", token=admin_token,
    body={"medication": "Amlodipine", "strength": "5mg", "dose": "1 Tab", "route": "Oral", "frequency": "Daily", "duration": "30 Days", "refills": 1, "status": "Active"},
    expected_status=[201])

test_endpoint("Clinical", "Get Vitals", "GET", "/api/patients/PAT-001/vitals", token=admin_token, expected_status=[200])
test_endpoint("Clinical", "Record Vital Sign", "POST", "/api/patients/PAT-001/vitals", token=admin_token,
    body={"type": "HEART_RATE_BPM", "value": 72.0},
    expected_status=[201])

test_endpoint("Clinical", "Get Nursing Notes", "GET", "/api/patients/PAT-001/nursing-notes", token=admin_token, expected_status=[200])
test_endpoint("Clinical", "Create Nursing Note", "POST", "/api/patients/PAT-001/nursing-notes", token=admin_token,
    body={"content": "Patient resting comfortably. Vitals stable."},
    expected_status=[201])

test_endpoint("Clinical", "Get Nursing Tasks", "GET", "/api/patients/PAT-001/nursing-tasks", token=admin_token, expected_status=[200])
st, bdy = test_endpoint("Clinical", "Create Nursing Task", "POST", "/api/patients/PAT-001/nursing-tasks", token=admin_token,
    body={"description": "Hourly vitals monitoring"},
    expected_status=[201])
if st == 201:
    task_id = json.loads(bdy).get("id")
    test_endpoint("Clinical", "Update Nursing Task Status", "PATCH", f"/api/patients/PAT-001/nursing-tasks/{task_id}/status",
        token=admin_token, body={"status": "COMPLETED"}, expected_status=[200])

# 9. Appointments & Slot Conflict Prevention
test_endpoint("Appointments", "Get All Appointments", "GET", "/api/appointments", token=admin_token, expected_status=[200])
apt_date = "2026-11-29"
apt_time = "04:30 PM"
apt_payload = {
    "patientName": "David Kim",
    "patientPhone": "+1 (555) 432-8765",
    "doctorName": "Dr. Alexander Chen",
    "department": "Neurology",
    "date": apt_date,
    "time": apt_time,
    "type": "In-Person",
    "reason": "Neurology consultation review"
}
st, bdy = test_endpoint("Appointments", "Create Appointment", "POST", "/api/appointments", token=admin_token, body=apt_payload, expected_status=[201])
# Verify duplicate appointment conflict prevention
test_endpoint("Appointments", "Prevent Duplicate Doctor Booking Same Slot", "POST", "/api/appointments",
    token=admin_token, body=apt_payload, expected_status=[409, 422])

if st == 201:
    apt_id = json.loads(bdy).get("id")
    test_endpoint("Appointments", "Update Appointment Status", "PATCH", f"/api/appointments/{apt_id}/status",
        token=admin_token, body={"status": "Confirmed"}, expected_status=[200])
    test_endpoint("Appointments", "Delete Appointment", "DELETE", f"/api/appointments/{apt_id}", token=admin_token, expected_status=[204])

# 10. Billing & Invoice Management
test_endpoint("Billing", "Get All Invoices", "GET", "/api/billing", token=admin_token, expected_status=[200])
test_endpoint("Billing", "Get Single Invoice INV-8901", "GET", "/api/billing/INV-8901", token=admin_token, expected_status=[200])
inv_id = f"INV-V{random.randint(1000, 9999)}"
inv_payload = {
    "id": inv_id,
    "patientName": "David Kim",
    "department": "Neurology",
    "date": "2026-11-16",
    "amount": 350.00,
    "status": "Pending",
    "method": "Insurance",
    "items": []
}
test_endpoint("Billing", "Create Invoice", "POST", "/api/billing", token=admin_token, body=inv_payload, expected_status=[201])
test_endpoint("Billing", "Pay Invoice", "PATCH", f"/api/billing/{inv_id}/pay", token=admin_token, expected_status=[200])

# 11. Dashboard Statistics & Activity Feed
test_endpoint("Dashboard", "Get Dashboard Statistics", "GET", "/api/dashboard/stats", token=admin_token, expected_status=[200])
test_endpoint("Activity", "Get Hospital Activity Feed", "GET", "/api/activity?limit=10", token=admin_token, expected_status=[200])

# 12. Staff Administration
test_endpoint("StaffAdmin", "Get Staff Accounts List", "GET", "/api/admin/staff", token=admin_token, expected_status=[200])
new_staff_email = f"nurse_{random.randint(10000, 99999)}@medicare.health"
test_endpoint("StaffAdmin", "Create Staff Account", "POST", "/api/admin/staff", token=admin_token,
    body={"email": new_staff_email, "fullName": "Nurse Specialist", "role": "NURSE", "password": "StaffPassword123!"},
    expected_status=[201])
test_endpoint("StaffAdmin", "Update Staff Account Status", "PATCH", f"/api/admin/staff/{new_staff_email}/status",
    token=admin_token, body={"enabled": False}, expected_status=[200])

# 13. Patient Portal
test_endpoint("PatientPortal", "Get Patient Own Dashboard", "GET", "/api/patient-portal/me", token=patient_token, expected_status=[200])

# 14. Contact Inquiry Form (returns 503 Service Unavailable when SMTP is unconfigured, or 204 if configured)
test_endpoint("Contact", "Submit Public Contact Inquiry", "POST", "/api/contact",
    body={"name": "Jane Public", "email": "jane@example.com", "subject": "Visiting Hours", "message": "What are visiting hours?", "phone": "+1 (555) 999-0000", "department": "General Medicine"},
    expected_status=[204, 503])

# 15. Token Revocation & Logout
logout_token = patient_token
test_endpoint("Auth", "Logout & Revoke Token", "POST", "/api/auth/logout", token=logout_token, expected_status=[204])
test_endpoint("Security", "Revoked Token Blocked on Auth Me", "GET", "/api/auth/me", token=logout_token, expected_status=[401])

# Summary & Output
passed_tests = [r for r in results if r["status"] == "PASS"]
failed_tests = [r for r in results if r["status"] == "FAIL"]

print("\n" + "=" * 80)
print(f"VERIFICATION SUMMARY: {len(results)} Checks Executed | Passed: {len(passed_tests)} | Failed: {len(failed_tests)}")
print("=" * 80)

if failed_tests:
    print("\nFAILED CHECKS:")
    for f in failed_tests:
        print(f" - {f['category']}: {f['name']} ({f['method']} {f['path']}) -> Got {f['actual']}, Expected {f['expected']}")
        print(f"   Response Body: {f['body'][:200]}")
    sys.exit(1)
else:
    print("\nALL BACKEND REST API ENDPOINTS, SECURITY & FUNCTIONALITY CHECKS PASSED WITH 100% SUCCESS.")
    sys.exit(0)
