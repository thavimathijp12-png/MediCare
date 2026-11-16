import json
import urllib.request
import urllib.error
import random
import sys

BASE_URL = "http://localhost:18080"
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

print(f"=== MEDICARE HEALTH & FUNCTIONALITY VERIFICATION ({BASE_URL}) ===")

# 1. Auth & Admin Login
status, body = test_endpoint("Auth", "Admin Login", "POST", "/api/auth/login", 
    body={"email": "admin@medicare.health", "password": "Admin@12345678"}, expected_status=[200])

admin_token = None
if status == 200:
    admin_token = json.loads(body).get("token")

# 2. Current User
test_endpoint("Auth", "Admin Profile Me", "GET", "/api/auth/me", token=admin_token, expected_status=[200])

# 3. User Registration
unique_email = f"patient_{random.randint(10000, 99999)}@medicare.health"
status, body = test_endpoint("Auth", "User Registration", "POST", "/api/auth/register",
    body={"email": unique_email, "password": "PatientPass123!", "fullName": "Test Verified Patient", "role": "PATIENT"},
    expected_status=[201])

patient_token = None
if status == 201:
    patient_token = json.loads(body).get("token")

# 4. Security & RBAC Checks
test_endpoint("Security", "Unauthenticated Dashboard Blocked", "GET", "/api/dashboard/stats", expected_status=[401])
test_endpoint("Security", "Invalid Token Blocked", "GET", "/api/dashboard/stats", token="bad.jwt.token", expected_status=[401])
test_endpoint("Security", "Invalid Password Rejected", "POST", "/api/auth/login",
    body={"email": "admin@medicare.health", "password": "BadPassword123!"}, expected_status=[401])
test_endpoint("Security", "Patient Forbidden from Dashboard", "GET", "/api/dashboard/stats", token=patient_token, expected_status=[403])
test_endpoint("Security", "Patient Forbidden from Staff List", "GET", "/api/admin/staff", token=patient_token, expected_status=[403])

# 5. Public Catalog
test_endpoint("Doctors", "Get All Doctors", "GET", "/api/doctors", expected_status=[200])
test_endpoint("Doctors", "Get Single Doctor DOC-101", "GET", "/api/doctors/DOC-101", expected_status=[200])
test_endpoint("Doctors", "Get Fixed Doctor DOC-103", "GET", "/api/doctors/DOC-103", expected_status=[200])
test_endpoint("Departments", "Get All Departments", "GET", "/api/departments", expected_status=[200])
test_endpoint("Departments", "Get Single Department 1", "GET", "/api/departments/1", expected_status=[200])

# 6. Doctor CRUD
test_doc_id = f"DOC-V{random.randint(1000, 9999)}"
doc_payload = {
    "id": test_doc_id,
    "name": "Dr. Verification Test",
    "department": "Cardiology",
    "degree": "MD, FACC",
    "experience": "12 Years",
    "fee": 160.00,
    "phone": "+1 (555) 000-1111",
    "email": f"{test_doc_id.lower()}@medicare.health",
    "status": "Available",
    "rating": 4.9,
    "reviews": 12,
    "image": "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=600&q=80",
    "about": "Physician created during verification"
}
test_endpoint("Doctors", "Create Doctor", "POST", "/api/doctors", token=admin_token, body=doc_payload, expected_status=[201])
doc_payload["fee"] = 175.00
test_endpoint("Doctors", "Update Doctor", "PUT", f"/api/doctors/{test_doc_id}", token=admin_token, body=doc_payload, expected_status=[200])
test_endpoint("Doctors", "Delete Doctor", "DELETE", f"/api/doctors/{test_doc_id}", token=admin_token, expected_status=[204])

# 7. Patient CRUD
test_endpoint("Patients", "Get All Patients", "GET", "/api/patients", token=admin_token, expected_status=[200])
test_endpoint("Patients", "Get Single Patient PAT-001", "GET", "/api/patients/PAT-001", token=admin_token, expected_status=[200])
test_pat_id = f"PAT-V{random.randint(1000, 9999)}"
pat_payload = {
    "id": test_pat_id,
    "name": "Verification Patient",
    "age": 45,
    "gender": "Male",
    "bloodGroup": "B+",
    "phone": "+1 (555) 222-3333",
    "email": f"{test_pat_id.lower()}@example.com",
    "condition": "Post-Evaluation Check",
    "doctor": "Dr. Sarah Jenkins",
    "status": "Outpatient",
    "address": "456 Healthcare Way",
    "admissionDate": "2026-11-15"
}
test_endpoint("Patients", "Create Patient", "POST", "/api/patients", token=admin_token, body=pat_payload, expected_status=[201])
pat_payload["condition"] = "Discharged with recovery note"
test_endpoint("Patients", "Update Patient", "PUT", f"/api/patients/{test_pat_id}", token=admin_token, body=pat_payload, expected_status=[200])
test_endpoint("Patients", "Delete Patient", "DELETE", f"/api/patients/{test_pat_id}", token=admin_token, expected_status=[204])

# 8. Clinical Records (PAT-001)
test_endpoint("Clinical", "Get Clinical Records", "GET", "/api/patients/PAT-001/clinical-records", token=admin_token, expected_status=[200])
test_endpoint("Clinical", "Create Clinical Record", "POST", "/api/patients/PAT-001/clinical-records", token=admin_token,
    body={"diagnosis": "Mild Hypertension", "clinicalNote": "Routine telemetry normal.", "allergies": "None"},
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
    body={"content": "Patient resting comfortably. Vitals recorded within normal limits."},
    expected_status=[201])

test_endpoint("Clinical", "Get Nursing Tasks", "GET", "/api/patients/PAT-001/nursing-tasks", token=admin_token, expected_status=[200])
st, bdy = test_endpoint("Clinical", "Create Nursing Task", "POST", "/api/patients/PAT-001/nursing-tasks", token=admin_token,
    body={"description": "Hourly vitals monitoring"},
    expected_status=[201])
if st == 201:
    task_id = json.loads(bdy).get("id")
    test_endpoint("Clinical", "Update Nursing Task Status", "PATCH", f"/api/patients/PAT-001/nursing-tasks/{task_id}/status",
        token=admin_token, body={"status": "COMPLETED"}, expected_status=[200])

# 9. Appointments
test_endpoint("Appointments", "Get All Appointments", "GET", "/api/appointments", token=admin_token, expected_status=[200])
apt_payload = {
    "patientName": "David Kim",
    "patientPhone": "+1 (555) 432-8765",
    "doctorName": "Dr. Alexander Chen",
    "department": "Neurology",
    "date": "2026-11-28",
    "time": "04:00 PM",
    "type": "In-Person",
    "reason": "Post-migraine neurology review"
}
st, bdy = test_endpoint("Appointments", "Create Appointment", "POST", "/api/appointments", token=admin_token, body=apt_payload, expected_status=[201])
if st == 201:
    apt_id = json.loads(bdy).get("id")
    test_endpoint("Appointments", "Update Appointment Status", "PATCH", f"/api/appointments/{apt_id}/status",
        token=admin_token, body={"status": "Confirmed"}, expected_status=[200])
    test_endpoint("Appointments", "Delete Appointment", "DELETE", f"/api/appointments/{apt_id}", token=admin_token, expected_status=[204])

# 10. Billing
test_endpoint("Billing", "Get Invoices", "GET", "/api/billing", token=admin_token, expected_status=[200])
test_endpoint("Billing", "Get Single Invoice INV-8901", "GET", "/api/billing/INV-8901", token=admin_token, expected_status=[200])
inv_id = f"INV-V{random.randint(1000, 9999)}"
inv_payload = {
    "id": inv_id,
    "patientName": "David Kim",
    "department": "Neurology",
    "date": "2026-11-15",
    "amount": 320.00,
    "status": "Pending",
    "method": "Insurance",
    "items": []
}
test_endpoint("Billing", "Create Invoice", "POST", "/api/billing", token=admin_token, body=inv_payload, expected_status=[201])
test_endpoint("Billing", "Pay Invoice", "PATCH", f"/api/billing/{inv_id}/pay", token=admin_token, expected_status=[200])

# 11. Dashboard & Activity
test_endpoint("Dashboard", "Get Dashboard Stats", "GET", "/api/dashboard/stats", token=admin_token, expected_status=[200])
test_endpoint("Activity", "Get Activity Feed", "GET", "/api/activity?limit=10", token=admin_token, expected_status=[200])

# 12. Staff Admin
test_endpoint("Admin", "Get Staff Accounts", "GET", "/api/admin/staff", token=admin_token, expected_status=[200])
new_staff_email = f"staff_{random.randint(10000, 99999)}@medicare.health"
test_endpoint("Admin", "Create Staff Account", "POST", "/api/admin/staff", token=admin_token,
    body={"email": new_staff_email, "fullName": "Automated Staff Account", "role": "NURSE", "password": "StaffPassword123!"},
    expected_status=[201])
test_endpoint("Admin", "Disable Staff Account", "PATCH", f"/api/admin/staff/{new_staff_email}/status",
    token=admin_token, body={"enabled": False}, expected_status=[200])

# 13. Patient Portal
test_endpoint("PatientPortal", "Get Patient Own Dashboard", "GET", "/api/patient-portal/me", token=patient_token, expected_status=[200])

# 14. Contact Form
test_endpoint("Contact", "Submit Contact Inquiry", "POST", "/api/contact",
    body={"name": "Jane Doe", "email": "jane@example.com", "subject": "General Inquiry", "message": "Hospital visit timing inquiry."},
    expected_status=[204])

# 15. Token Revocation (Logout)
logout_token = patient_token
test_endpoint("Auth", "Logout Revoke Token", "POST", "/api/auth/logout", token=logout_token, expected_status=[204])
test_endpoint("Security", "Revoked Token Blocked", "GET", "/api/auth/me", token=logout_token, expected_status=[401])

passed_tests = [r for r in results if r["status"] == "PASS"]
failed_tests = [r for r in results if r["status"] == "FAIL"]

print("\n" + "=" * 80)
print(f"VERIFICATION COMPLETE: {len(results)} Checks Executed | Passed: {len(passed_tests)} | Failed: {len(failed_tests)}")
print("=" * 80)

if failed_tests:
    print("\nFAILED CHECKS:")
    for f in failed_tests:
        print(f" - {f['category']}: {f['name']} ({f['method']} {f['path']}) -> Got {f['actual']}, Expected {f['expected']}")
        print(f"   Response: {f['body'][:200]}")
    sys.exit(1)
else:
    print("\nALL BACKEND CHECKS PASSED WITH 100% SUCCESS.")
    sys.exit(0)

