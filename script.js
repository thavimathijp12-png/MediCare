/**
 * MediCare - Premium Hospital Management Web Application
 * Vanilla JavaScript Controller & Data Store
 * strictly HTML5, CSS3, Vanilla JS, Bootstrap 5, Bootstrap Icons
 */

// ==========================================================================
// 1. Public Doctor Catalog
// ==========================================================================
const INITIAL_DOCTORS = [];
const DOCTOR_PLACEHOLDER_IMAGE = "assets/doctor-placeholder.svg";

const LEGACY_LOCAL_STORAGE_KEYS = [
  "medicare_activities",
  "medicare_invoices",
  "medicare_doctors",
  "medicare_patients",
  "medicare_appointments"
];
try {
  LEGACY_LOCAL_STORAGE_KEYS.forEach(key => window.localStorage.removeItem(key));
} catch (error) {
  console.error("Unable to clear the retired browser-side hospital data cache.", error);
}

// ==========================================================================
// 2. API-backed Session State
// ==========================================================================
function getApiBaseUrl() {
  const configured = document.querySelector('meta[name="medicare-api-base-url"]')?.content.trim();
  if (configured) {
    const url = new URL(configured, window.location.origin);
    if (!["http:", "https:"].includes(url.protocol)
        || url.username
        || url.password
        || (url.pathname !== "/" && url.pathname !== "")
        || url.search
        || url.hash) {
      throw new Error("The MediCare API base URL must be an HTTP(S) origin without credentials or a path.");
    }
    return url.origin;
  }

  const hostname = window.location.hostname || "127.0.0.1";
  if (["localhost", "127.0.0.1", "::1"].includes(hostname)) {
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    return `${protocol}//${hostname}:8080`;
  }
  return window.location.origin;
}

const API_BASE_URL = getApiBaseUrl();
const LOCAL_SETTINGS_KEY = "medicare_settings_reduce_motion";
const authState = { token: null, user: null };
const patientState = { token: null, dashboard: null };
let activeClinicalPatientId = null;
let activeClinicalData = null;
const appData = {
  doctors: [],
  departments: [],
  patients: [],
  appointments: [],
  invoices: [],
  activities: [],
  staffAccounts: [],
  dashboardStats: null
};

const DB = {
  get(key, defaultValue) {
    return Object.prototype.hasOwnProperty.call(appData, key) ? appData[key] : defaultValue;
  },
  set(key, value) {
    if (Object.prototype.hasOwnProperty.call(appData, key)) {
      appData[key] = value;
    }
  }
};

// ==========================================================================
// 3. Navigation & View Controller
// ==========================================================================
let currentPortalTab = "dashboard";

function switchMainView(targetView) {
  const publicView = document.getElementById("public-view");
  const adminView = document.getElementById("admin-view");
  const publicNavbar = document.querySelector(".public-navbar");

  if (targetView === "patient") {
    publicView.classList.add("d-none");
    if (publicNavbar) publicNavbar.classList.add("d-none");
    adminView.classList.remove("d-none");
    document.getElementById("staff-login-panel")?.classList.add("d-none");
    document.getElementById("staff-dashboard")?.classList.add("d-none");
    document.getElementById("patient-portal")?.classList.remove("d-none");
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (patientState.token) loadPatientDashboard();
    return;
  }

  if (targetView === "admin") {
    document.getElementById("patient-portal")?.classList.add("d-none");
    publicView.classList.add("d-none");
    if (publicNavbar) publicNavbar.classList.add("d-none");
    adminView.classList.remove("d-none");
    window.scrollTo({ top: 0, behavior: "smooth" });
    const loginPanel = document.getElementById("staff-login-panel");
    const dashboard = document.getElementById("staff-dashboard");
    if (!authState.token || !authState.user) {
      if (loginPanel) loginPanel.classList.remove("d-none");
      if (dashboard) dashboard.classList.add("d-none");
      document.getElementById("staffUsernameInput")?.focus();
      return;
    }
    if (loginPanel) loginPanel.classList.add("d-none");
    if (dashboard) dashboard.classList.remove("d-none");
    applyRolePermissions();
    switchAdminTab(firstAllowedTab());
  } else {
    adminView.classList.add("d-none");
    publicView.classList.remove("d-none");
    if (publicNavbar) publicNavbar.classList.remove("d-none");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function switchAdminTab(tabName) {
  if (!authState.token || !authState.user) {
    switchMainView("admin");
    return;
  }
  const allowedTabs = allowedTabsForRole(authState.user.role);
  if (!allowedTabs.includes(tabName)) {
    showToast("Your staff role does not have access to that page.", "error");
    return;
  }
  currentPortalTab = tabName;

  // Update sidebar active state
  document.querySelectorAll(".sidebar-nav-link").forEach(link => {
    if (link.dataset.tab === tabName) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });

  // Hide all tab panes
  document.querySelectorAll(".admin-tab-pane").forEach(pane => {
    pane.classList.remove("active-view");
  });

  // Show active tab pane
  const targetPane = document.getElementById(`tab-${tabName}`);
  if (targetPane) {
    targetPane.classList.add("active-view");
  }

  // Close mobile sidebar if open
  closeMobileSidebar();

  // Tab specific updates
  if (tabName === "dashboard") {
    updateDashboardStats();
    renderRecentAppointmentsTable();
    renderActivityFeed();
    setTimeout(renderDashboardCharts, 100);
  } else if (tabName === "patients") {
    renderPatientsTable();
  } else if (tabName === "doctors") {
    renderDoctorsGrid();
  } else if (tabName === "appointments") {
    renderAppointmentsTable();
  } else if (tabName === "billing") {
    renderBillingTable();
  } else if (tabName === "departments") {
    renderDepartments();
  } else if (tabName === "reports") {
    setTimeout(() => {
      renderReportsCharts();
      updateReportMetrics();
    }, 100);
  } else if (tabName === "staff") {
    renderStaffAccounts();
  }
}

function allowedTabsForRole(role) {
  const permissions = {
    ADMIN: ["dashboard", "patients", "doctors", "appointments", "departments", "billing", "reports", "settings", "staff"],
    DOCTOR: ["patients", "appointments"],
    RECEPTIONIST: ["patients", "appointments", "billing"],
    NURSE: ["patients", "appointments"]
  };
  return permissions[role] || [];
}

function firstAllowedTab() {
  return allowedTabsForRole(authState.user?.role)[0] || "patients";
}

function applyRolePermissions() {
  const allowedTabs = new Set(allowedTabsForRole(authState.user.role));
  document.querySelectorAll(".sidebar-nav-link[data-tab]").forEach(link => {
    link.classList.toggle("d-none", !allowedTabs.has(link.dataset.tab));
  });
  document.querySelectorAll(".admin-tab-pane").forEach(pane => {
    const tabName = pane.id.replace("tab-", "");
    pane.classList.toggle("d-none", !allowedTabs.has(tabName));
  });

  const dashboardHeaderName = document.getElementById("staffDisplayName");
  const dashboardHeaderRole = document.getElementById("staffDisplayRole");
  const welcomeName = document.getElementById("staffWelcomeName");
  const todayDate = document.getElementById("staffTodayDate");
  if (dashboardHeaderName) dashboardHeaderName.textContent = authState.user.fullName;
  if (dashboardHeaderRole) dashboardHeaderRole.textContent = authState.user.role;
  if (welcomeName) welcomeName.textContent = authState.user.fullName;
  if (todayDate) todayDate.textContent = new Date().toLocaleDateString();
  document.querySelectorAll(".staff-dashboard .admin-only").forEach(element => {
    element.classList.toggle("d-none", authState.user.role !== "ADMIN");
  });
  document.querySelectorAll(".staff-dashboard .patient-create-action").forEach(element => {
    element.classList.toggle("d-none", !["ADMIN", "RECEPTIONIST"].includes(authState.user.role));
  });
  document.querySelectorAll(".staff-dashboard .appointment-create-action").forEach(element => {
    element.classList.toggle("d-none", !["ADMIN", "RECEPTIONIST"].includes(authState.user.role));
  });
}

function toggleMobileSidebar() {
  const sidebar = document.querySelector(".admin-sidebar");
  if (sidebar) {
    sidebar.classList.toggle("show-sidebar-mobile");
  }
}

function closeMobileSidebar() {
  const sidebar = document.querySelector(".admin-sidebar");
  if (sidebar) {
    sidebar.classList.remove("show-sidebar-mobile");
  }
}

// ==========================================================================
// 4. Toast Notification System
// ==========================================================================
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toastEl = document.createElement("div");
  toastEl.className = "toast-custom";

  let iconClass = "bi-check-circle-fill text-success";
  let bgClass = "var(--pastel-mint)";
  if (type === "error" || type === "danger") {
    iconClass = "bi-x-circle-fill text-danger";
    bgClass = "var(--pastel-pink)";
  } else if (type === "info") {
    iconClass = "bi-info-circle-fill text-primary";
    bgClass = "var(--pastel-blue)";
  } else if (type === "warning") {
    iconClass = "bi-exclamation-triangle-fill text-warning";
    bgClass = "var(--pastel-cream)";
  }

  toastEl.style.borderLeft = `5px solid ${type === 'error' ? '#E11D48' : '#0E9F6E'}`;
  toastEl.innerHTML = `
    <i class="bi ${iconClass} fs-5"></i>
    <div class="flex-grow-1">
      <div class="fw-bold" style="font-size: 0.9rem;">${type.toUpperCase()}</div>
      <div style="font-size: 0.85rem; color: var(--text-secondary);">${escapeHtml(message)}</div>
    </div>
    <button type="button" class="btn-close ms-2" style="font-size: 0.75rem;" onclick="this.parentElement.remove()"></button>
  `;

  container.appendChild(toastEl);

  setTimeout(() => {
    toastEl.style.opacity = "0";
    toastEl.style.transform = "translateX(50px)";
    setTimeout(() => toastEl.remove(), 300);
  }, 4000);
}

async function apiRequest(path, options = {}) {
  const headers = { Accept: "application/json" };
  const request = { method: options.method || "GET", headers };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    request.body = JSON.stringify(options.body);
  }
  const requestToken = options.token !== undefined ? options.token : authState.token;
  if (options.authenticated !== false && requestToken) {
    headers.Authorization = `Bearer ${requestToken}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, request);
  } catch (error) {
    console.error("MediCare API request could not reach the server.", error);
    throw new Error(`Unable to connect to the MediCare API at ${API_BASE_URL}. Check that the backend is running and CORS allows this page.`);
  }
  if (response.status === 204) return null;
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const error = await response.json();
      if (error.message) message = error.message;
    } catch (error) {
      message = `Request failed (${response.status}); the server returned an unreadable error response.`;
    }

    if (response.status === 401 && authState.token && requestToken === authState.token && path !== "/api/auth/login") {
      clearStaffSession("Your staff session expired. Please sign in again.");
    }
    throw new Error(message);
  }
  return response.json();
}

function showPatientPortalForm(mode) {
  const isRegister = mode === "register";
  document.getElementById("patientLoginForm").classList.toggle("d-none", isRegister);
  document.getElementById("patientRegisterForm").classList.toggle("d-none", !isRegister);
  document.getElementById("patientLoginTab").classList.toggle("btn-medicare-primary", !isRegister);
  document.getElementById("patientLoginTab").classList.toggle("btn-medicare-secondary", isRegister);
  document.getElementById("patientRegisterTab").classList.toggle("btn-medicare-primary", isRegister);
  document.getElementById("patientRegisterTab").classList.toggle("btn-medicare-secondary", !isRegister);
}

async function establishPatientSession(login) {
  if (login.role !== "PATIENT") {
    throw new Error("This sign-in is only for patient accounts. Use Staff Login for hospital staff.");
  }
  patientState.token = login.token;
  document.getElementById("patientPortalAuth").classList.add("d-none");
  document.getElementById("patientPortalDashboard").classList.remove("d-none");
  await loadPatientDashboard();
}

async function handlePatientLogin(event) {
  event.preventDefault();
  const form = document.getElementById("patientLoginForm");
  const error = document.getElementById("patientLoginError");
  if (!form.checkValidity()) {
    form.classList.add("was-validated");
    return;
  }
  error.textContent = "";
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    const login = await apiRequest("/api/auth/login", {
      method: "POST",
      authenticated: false,
      body: {
        email: document.getElementById("patientLoginEmail").value.trim(),
        password: document.getElementById("patientLoginPassword").value
      }
    });
    await establishPatientSession(login);
    form.reset();
    form.classList.remove("was-validated");
  } catch (requestError) {
    patientState.token = null;
    error.textContent = requestError.message;
  } finally {
    submit.disabled = false;
  }
}

async function handlePatientRegistration(event) {
  event.preventDefault();
  const form = document.getElementById("patientRegisterForm");
  const error = document.getElementById("patientRegisterError");
  if (!form.checkValidity()) {
    form.classList.add("was-validated");
    return;
  }
  error.textContent = "";
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    const registration = await apiRequest("/api/auth/register", {
      method: "POST",
      authenticated: false,
      body: {
        fullName: document.getElementById("patientRegisterName").value.trim(),
        email: document.getElementById("patientRegisterEmail").value.trim(),
        password: document.getElementById("patientRegisterPassword").value,
        age: Number(document.getElementById("patientRegisterAge").value),
        gender: document.getElementById("patientRegisterGender").value.trim(),
        phone: document.getElementById("patientRegisterPhone").value.trim(),
        address: document.getElementById("patientRegisterAddress").value.trim()
      }
    });
    await establishPatientSession(registration);
    form.reset();
    form.classList.remove("was-validated");
  } catch (requestError) {
    patientState.token = null;
    error.textContent = requestError.message;
  } finally {
    submit.disabled = false;
  }
}

async function loadPatientDashboard() {
  const content = document.getElementById("patientDashboardContent");
  const error = document.getElementById("patientDashboardError");
  error.textContent = "";
  content.textContent = "Loading your records…";
  try {
    const dashboard = await apiRequest("/api/patient-portal/me", { token: patientState.token });
    patientState.dashboard = dashboard;
    document.getElementById("patientDashboardName").textContent =
      `${dashboard.profile.name} · Patient ID ${dashboard.profile.id}`;
    const doctorSelect = document.getElementById("patientAppointmentDoctor");
    if (DB.get("doctors", []).length === 0) {
      await loadPublicCatalog();
    }
    const doctors = DB.get("doctors", []);
    doctorSelect.innerHTML = doctors.map(doctor =>
      `<option value="${escapeHtml(doctor.name)}">${escapeHtml(doctor.name)} · ${escapeHtml(doctor.department)}</option>`
    ).join("");
    const section = (title, items, render, emptyText) => `
      <section class="mb-4">
        <h2 class="h5 fw-bold">${escapeHtml(title)}</h2>
        ${items.length ? `<div class="list-group">${items.map(item => `<div class="list-group-item">${render(item)}</div>`).join("")}</div>`
          : `<p class="text-secondary small">${escapeHtml(emptyText)}</p>`}
      </section>`;
    content.innerHTML = `
      ${section("Appointments", dashboard.appointments, item =>
        `<strong>${escapeHtml(item.date)} ${escapeHtml(item.time)}</strong> · ${escapeHtml(item.doctorName)} · ${escapeHtml(item.status)}`,
      "No appointments are currently linked to your account.")}
      ${section("Invoices", dashboard.invoices, item =>
        `<strong>${escapeHtml(item.id)}</strong> · ${escapeHtml(item.department)} · ${escapeHtml(item.status)} · ${escapeHtml(item.amount)}`
        + (["pending", "overdue"].includes(item.status?.toLowerCase()) && item.patientId
          ? ` <button type="button" class="btn btn-sm btn-outline-primary ms-2" data-pay-invoice="${escapeHtml(item.id)}">Pay securely</button>`
          : ""),
      "No invoices are currently linked to your account.")}
      ${section("Clinical records", dashboard.clinicalRecords, item =>
        `<strong>${escapeHtml(item.diagnosis || "Clinical record")}</strong><div>${escapeHtml(item.clinicalNote || "")}</div>`,
      "No clinical records are available.")}
      ${section("Prescriptions", dashboard.prescriptions, item =>
        `<strong>${escapeHtml(item.medication || "Prescription")}</strong> · ${escapeHtml(item.dose || "")} · ${escapeHtml(item.status || "")}`,
      "No prescriptions are available.")}
      ${section("Vitals", dashboard.vitals, item =>
        `<strong>${escapeHtml(item.type || "Vital")}</strong> · ${escapeHtml(item.value)} ${escapeHtml(item.unit || "")}`,
      "No vitals are available.")}`;
    content.querySelectorAll("[data-pay-invoice]").forEach(button => {
      button.addEventListener("click", () => startInvoiceCheckout(button.dataset.payInvoice));
    });
  } catch (requestError) {
    content.replaceChildren();
    error.textContent = requestError.message;
  }
}

async function startInvoiceCheckout(invoiceNumber) {
  const checkoutWindow = window.open("about:blank", "_blank");
  if (checkoutWindow) checkoutWindow.opener = null;
  const error = document.getElementById("patientDashboardError");
  error.textContent = "";
  try {
    const checkout = await apiRequest(
      `/api/patient-portal/invoices/${encodeURIComponent(invoiceNumber)}/checkout`,
      { method: "POST", token: patientState.token }
    );
    const checkoutUrl = new URL(checkout.checkoutUrl);
    if (checkoutUrl.protocol !== "https:" || checkoutUrl.hostname !== "checkout.stripe.com") {
      throw new Error("The payment provider returned an unsafe checkout URL.");
    }
    if (checkoutWindow) {
      checkoutWindow.location.assign(checkoutUrl.href);
    } else {
      error.innerHTML = `Checkout is ready. <a href="${escapeHtml(checkoutUrl.href)}" target="_blank" rel="noopener noreferrer">Continue to Stripe</a>.`;
    }
  } catch (requestError) {
    if (checkoutWindow) checkoutWindow.close();
    error.textContent = requestError.message;
  }
}

async function bookPatientAppointment(event) {
  event.preventDefault();
  const form = document.getElementById("patientAppointmentForm");
  const error = document.getElementById("patientAppointmentError");
  if (!form.checkValidity()) {
    form.classList.add("was-validated");
    return;
  }
  error.textContent = "";
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    await apiRequest("/api/patient-portal/appointments", {
      method: "POST",
      token: patientState.token,
      body: {
        patientName: patientState.dashboard.profile.name,
        patientPhone: patientState.dashboard.profile.phone,
        doctorName: document.getElementById("patientAppointmentDoctor").value,
        date: document.getElementById("patientAppointmentDate").value,
        time: document.getElementById("patientAppointmentTime").value,
        reason: document.getElementById("patientAppointmentReason").value.trim()
      }
    });
    form.reset();
    form.classList.remove("was-validated");
    await loadPatientDashboard();
    showToast("Appointment request submitted. It is pending care-team confirmation.");
  } catch (requestError) {
    error.textContent = requestError.message;
  } finally {
    submit.disabled = false;
  }
}

async function logoutPatient() {
  let logoutError = null;
  if (patientState.token) {
    try {
      await apiRequest("/api/auth/logout", { method: "POST", token: patientState.token });
    } catch (error) {
      logoutError = error;
    }
  }
  patientState.token = null;
  patientState.dashboard = null;
  document.getElementById("patientPortalDashboard").classList.add("d-none");
  document.getElementById("patientPortalAuth").classList.remove("d-none");
  document.getElementById("patientDashboardContent").replaceChildren();
  document.getElementById("patientDashboardName").textContent = "";
  document.getElementById("patientDashboardError").textContent = "";
  showPatientPortalForm("login");
  switchMainView("public");
  showToast(logoutError
    ? `Signed out in this browser; server revocation could not be confirmed: ${logoutError.message}`
    : "You have been securely signed out.", logoutError ? "warning" : "success");
}

function clearStaffSession(loginMessage = "") {
  authState.token = null;
  authState.user = null;
  activeClinicalPatientId = null;
  activeClinicalData = null;
  const patientProfile = document.getElementById("patientViewModalContent");
  if (patientProfile) patientProfile.replaceChildren();
  DB.set("patients", []);
  DB.set("appointments", []);
  DB.set("invoices", []);
  DB.set("activities", []);
  DB.set("staffAccounts", []);
  DB.set("dashboardStats", null);

  ["patients-table-body", "appointments-table-body", "billing-table-body",
    "dashboard-recent-appointments-body", "dashboard-activity-feed", "staff-account-table-body"]
    .forEach(id => {
      const element = document.getElementById(id);
      if (element) element.replaceChildren();
    });

  const dashboard = document.getElementById("staff-dashboard");
  const loginPanel = document.getElementById("staff-login-panel");
  if (dashboard) dashboard.classList.add("d-none");
  if (loginPanel && !document.getElementById("admin-view").classList.contains("d-none")) {
    loginPanel.classList.remove("d-none");
  }
  const message = document.getElementById("staffLoginError");
  if (message) message.textContent = loginMessage;
}

function normalizeDoctor(doctor) {
  return {
    ...doctor,
    image: doctor.image || "",
    rating: Number(doctor.rating || 0),
    reviews: Number(doctor.reviews || 0),
    experience: doctor.experience || "Experience not listed",
    fee: Number(doctor.fee || 0),
    about: doctor.about || ""
  };
}

async function loadPublicCatalog() {
  const [doctors, departments] = await Promise.all([
    apiRequest("/api/doctors", { authenticated: false }),
    apiRequest("/api/departments", { authenticated: false })
  ]);
  DB.set("doctors", doctors.map(normalizeDoctor));
  DB.set("departments", departments);
  renderPublicFeaturedDoctors();
  renderDepartments();
  populateDepartmentOptions();
}

async function loadStaffData() {
  const role = authState.user.role;
  const requests = [
    loadPublicCatalog(),
    apiRequest("/api/patients").then(data => DB.set("patients", data)),
    apiRequest("/api/appointments").then(data => DB.set("appointments", data))
  ];

  if (role === "ADMIN" || role === "RECEPTIONIST") {
    requests.push(apiRequest("/api/billing").then(data => DB.set("invoices", data)));
  }
  if (role === "ADMIN") {
    requests.push(
      apiRequest("/api/dashboard/stats").then(data => DB.set("dashboardStats", data)),
      apiRequest("/api/activity?limit=10").then(data => {
        DB.set("activities", data.map(activity => ({
          ...activity,
          time: activity.time || formatActivityTime(activity.timestamp)
        })));
      }),
      apiRequest("/api/admin/staff").then(data => DB.set("staffAccounts", data))
    );
  }
  await Promise.all(requests);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function safeHttpUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(String(value || ""), window.location.origin);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function populateDepartmentOptions() {
  const departments = DB.get("departments", []);
  ["docDeptInput", "aptDeptInput", "appointmentFilterDept", "doctorFilterDept"].forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;
    const selected = select.value;
    const includeAll = id.endsWith("FilterDept");
    select.innerHTML = includeAll ? `<option value="">All Departments</option>` : `<option value="">Select Department</option>`;
    select.insertAdjacentHTML("beforeend", departments
      .map(department => `<option value="${escapeHtml(department.name)}">${escapeHtml(department.name)}</option>`)
      .join(""));
    select.value = departments.some(department => department.name === selected) ? selected : "";
  });
}

function renderDepartments() {
  const departments = DB.get("departments", []);
  const colors = ["badge-pink", "badge-lavender", "badge-cream", "badge-mint", "badge-blue"];
  const icons = ["bi-heart-pulse", "bi-diagram-3", "bi-person-walking", "bi-balloon", "bi-droplet-half"];
  const containers = [
    { element: document.getElementById("public-departments-grid"), publicView: true },
    { element: document.getElementById("departments-cards-grid"), publicView: false }
  ];

  containers.forEach(({ element, publicView }) => {
    if (!element) return;
    element.replaceChildren();
    if (departments.length === 0) {
      element.innerHTML = `<div class="col-12 text-center text-muted py-4">Department information is not available.</div>`;
      return;
    }

    departments.forEach((department, index) => {
      const doctor = DB.get("doctors", []).find(item => item.department === department.name);
      const occupancy = department.totalBeds > 0
        ? Math.round((department.occupiedBeds / department.totalBeds) * 100)
        : 0;
      const col = document.createElement("div");
      col.className = "col-lg-4 col-md-6";
      col.innerHTML = publicView ? `
        <div class="dept-card">
          <div class="dept-icon-circle ${colors[index % colors.length]}">
            <i class="bi ${icons[index % icons.length]}"></i>
          </div>
          <h4 class="fw-bold mb-2">${escapeHtml(department.name)}</h4>
          <p class="text-secondary small mb-3">${escapeHtml(department.description || "Hospital clinical department.")}</p>
          <div class="small text-muted mb-3">${escapeHtml(department.location || "Location not listed")}</div>
          <div class="mt-auto d-flex justify-content-between align-items-center pt-3 border-top">
            <span class="small fw-semibold text-muted">${escapeHtml(department.headDoctorName || "Clinical team")}</span>
            ${doctor ? `<button class="btn btn-sm btn-outline-primary" onclick="openBookAppointmentForDoctor(${escapeHtml(JSON.stringify(doctor.name))}, ${escapeHtml(JSON.stringify(department.name))})">Book Consult</button>` : ""}
          </div>
        </div>
      ` : `
        <div class="card-custom p-4 h-100">
          <div class="d-flex align-items-center gap-3 mb-3">
            <div class="dept-icon-circle ${colors[index % colors.length]} mb-0" style="width: 52px; height: 52px; font-size: 1.4rem;">
              <i class="bi ${icons[index % icons.length]}"></i>
            </div>
            <div>
              <h5 class="fw-bold mb-0">${escapeHtml(department.name)}</h5>
              <span class="small text-muted">${escapeHtml(department.location || "Location not listed")}</span>
            </div>
          </div>
          <p class="small text-secondary">${escapeHtml(department.description || "No description available.")}</p>
          <div class="p-3 bg-light rounded-3 mb-3 small">
            <div class="d-flex justify-content-between mb-1"><span class="text-secondary">Head of Department:</span><strong>${escapeHtml(department.headDoctorName || "Not assigned")}</strong></div>
            <div class="d-flex justify-content-between"><span class="text-secondary">Bed capacity:</span><strong>${Number(department.occupiedBeds || 0)} / ${Number(department.totalBeds || 0)} (${occupancy}%)</strong></div>
          </div>
          <div class="d-flex gap-2 admin-only">
            <button class="btn btn-sm btn-outline-primary flex-grow-1" onclick="openDepartmentModal(${Number(department.id)})">Edit</button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteDepartment(${Number(department.id)})">Delete</button>
          </div>
        </div>
      `;
      element.appendChild(col);
    });
  });
}

function openDepartmentModal(departmentId = null) {
  const form = document.getElementById("departmentForm");
  if (!form) return;
  form.reset();
  const department = DB.get("departments", []).find(item => Number(item.id) === Number(departmentId));
  document.getElementById("departmentIdHidden").value = department ? department.id : "";
  document.getElementById("departmentModalTitle").textContent = department ? "Edit Department" : "Add Department";
  if (department) {
    document.getElementById("departmentNameInput").value = department.name || "";
    document.getElementById("departmentCodeInput").value = department.code || "";
    document.getElementById("departmentDescriptionInput").value = department.description || "";
    document.getElementById("departmentLocationInput").value = department.location || "";
    document.getElementById("departmentHeadInput").value = department.headDoctorName || "";
    document.getElementById("departmentTotalBedsInput").value = department.totalBeds || 0;
    document.getElementById("departmentOccupiedBedsInput").value = department.occupiedBeds || 0;
  }
  bootstrap.Modal.getOrCreateInstance(document.getElementById("departmentModal")).show();
}

async function saveDepartmentForm(event) {
  event.preventDefault();
  const form = document.getElementById("departmentForm");
  if (!form.checkValidity()) {
    form.classList.add("was-validated");
    return;
  }
  const id = document.getElementById("departmentIdHidden").value;
  const department = {
    name: document.getElementById("departmentNameInput").value.trim(),
    code: document.getElementById("departmentCodeInput").value.trim(),
    description: document.getElementById("departmentDescriptionInput").value.trim(),
    location: document.getElementById("departmentLocationInput").value.trim(),
    headDoctorName: document.getElementById("departmentHeadInput").value.trim(),
    totalBeds: Number(document.getElementById("departmentTotalBedsInput").value),
    occupiedBeds: Number(document.getElementById("departmentOccupiedBedsInput").value)
  };
  try {
    await apiRequest(id ? `/api/departments/${encodeURIComponent(id)}` : "/api/departments", {
      method: id ? "PUT" : "POST",
      body: department
    });
    bootstrap.Modal.getInstance(document.getElementById("departmentModal"))?.hide();
    await loadPublicCatalog();
    renderDepartments();
    showToast(`Department ${department.name} saved.`);
  } catch (error) {
    showToast(`Unable to save department: ${error.message}`, "error");
  }
}

async function deleteDepartment(id) {
  if (!confirm("Delete this department? The server may reject deletion if existing records reference it.")) return;
  try {
    await apiRequest(`/api/departments/${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadPublicCatalog();
    renderDepartments();
    showToast("Department deleted.", "warning");
  } catch (error) {
    showToast(`Unable to delete department: ${error.message}`, "error");
  }
}

function toggleDoctorAccountLink() {
  const role = document.getElementById("staffRoleInput")?.value;
  const group = document.getElementById("staffDoctorLinkGroup");
  const doctorSelect = document.getElementById("staffDoctorIdInput");
  if (!group || !doctorSelect) return;
  const isDoctor = role === "DOCTOR";
  group.classList.toggle("d-none", !isDoctor);
  doctorSelect.required = isDoctor;
  doctorSelect.innerHTML = DB.get("doctors", [])
    .map(doctor => `<option value="${escapeHtml(doctor.id)}">${escapeHtml(doctor.name)} (${escapeHtml(doctor.department)})</option>`)
    .join("");
}

function renderStaffAccounts() {
  const tbody = document.getElementById("staff-account-table-body");
  if (!tbody) return;
  const accounts = DB.get("staffAccounts", []);
  if (accounts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No staff accounts found.</td></tr>`;
    return;
  }
  tbody.innerHTML = accounts.map(account => `
    <tr>
      <td>${escapeHtml(account.fullName)}</td>
      <td>${escapeHtml(account.email)}</td>
      <td>${escapeHtml(account.role)}</td>
      <td>${escapeHtml(account.doctorName || "—")}</td>
      <td><span class="status-badge ${account.enabled ? "status-confirmed" : "status-cancelled"}">${account.enabled ? "Enabled" : "Disabled"}</span></td>
      <td><button class="btn btn-sm ${account.enabled ? "btn-outline-danger" : "btn-outline-success"}" onclick="setStaffAccountEnabled(${escapeHtml(JSON.stringify(account.email))}, ${!account.enabled})">${account.enabled ? "Disable" : "Enable"}</button></td>
    </tr>
  `).join("");
}

async function createStaffAccount(event) {
  event.preventDefault();
  const form = document.getElementById("staffAccountForm");
  if (!form.checkValidity()) {
    form.classList.add("was-validated");
    return;
  }
  const role = document.getElementById("staffRoleInput").value;
  const account = {
    fullName: document.getElementById("staffFullNameInput").value.trim(),
    email: document.getElementById("staffEmailInput").value.trim(),
    password: document.getElementById("staffAccountPasswordInput").value,
    role,
    doctorId: role === "DOCTOR" ? document.getElementById("staffDoctorIdInput").value : null
  };
  try {
    await apiRequest("/api/admin/staff", { method: "POST", body: account });
    form.reset();
    form.classList.remove("was-validated");
    toggleDoctorAccountLink();
    await loadStaffData();
    renderStaffAccounts();
    showToast(`Staff account for ${account.fullName} created.`);
  } catch (error) {
    showToast(`Unable to create staff account: ${error.message}`, "error");
  }
}

async function setStaffAccountEnabled(email, enabled) {
  try {
    await apiRequest(`/api/admin/staff/${encodeURIComponent(email)}/status`, {
      method: "PATCH",
      body: { enabled }
    });
    await loadStaffData();
    renderStaffAccounts();
    showToast(`Staff account ${enabled ? "enabled" : "disabled"}.`, enabled ? "success" : "warning");
  } catch (error) {
    showToast(`Unable to update staff account: ${error.message}`, "error");
  }
}

function formatActivityTime(timestamp) {
  if (!timestamp) return "Recently";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

async function handleStaffLogin(event) {
  event.preventDefault();
  const form = document.getElementById("staffLoginForm");
  const error = document.getElementById("staffLoginError");
  const submitButton = form.querySelector('button[type="submit"]');
  if (!form.checkValidity()) {
    form.classList.add("was-validated");
    return;
  }

  if (error) error.textContent = "";
  submitButton.disabled = true;
  try {
    const credentials = {
      email: document.getElementById("staffUsernameInput").value.trim(),
      password: document.getElementById("staffPasswordInput").value
    };
    const login = await apiRequest("/api/auth/login", {
      method: "POST",
      body: credentials,
      authenticated: false
    });
    authState.token = login.token;
    authState.user = await apiRequest("/api/auth/me");
    if (!allowedTabsForRole(authState.user.role).length) {
      clearStaffSession();
      throw new Error("This account is not permitted to access the staff portal.");
    }

    await loadStaffData();
    document.getElementById("staff-login-panel").classList.add("d-none");
    document.getElementById("staff-dashboard").classList.remove("d-none");
    applyRolePermissions();
    switchAdminTab(firstAllowedTab());
    form.reset();
    form.classList.remove("was-validated");
    showToast(`Welcome, ${authState.user.fullName}.`);
  } catch (requestError) {
    clearStaffSession();
    if (error) error.textContent = requestError.message;
  } finally {
    submitButton.disabled = false;
  }
}

async function logoutStaff() {
  let logoutError = null;
  if (authState.token) {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } catch (error) {
      logoutError = error;
    }
  }
  clearStaffSession();
  switchMainView("public");
  showToast(logoutError
    ? `Signed out in this browser, but the server could not confirm token revocation: ${logoutError.message}`
    : "You have been securely signed out.", logoutError ? "warning" : "success");
}

async function refreshStaffData() {
  if (!authState.token || !authState.user) {
    switchMainView("admin");
    return;
  }
  try {
    await loadStaffData();
    refreshAllViews();
    showToast("Hospital data refreshed from the server.", "info");
  } catch (error) {
    showToast(`Unable to refresh hospital data: ${error.message}`, "error");
  }
}

// ==========================================================================
// 5. Dashboard Stats & Calculations
// ==========================================================================
function updateDashboardStats() {
  const patients = DB.get("patients", []);
  const doctors = DB.get("doctors", []);
  const appointments = DB.get("appointments", []);
  const invoices = DB.get("invoices", []);
  const stats = DB.get("dashboardStats");

  // Total patients
  const patientStat = document.getElementById("stat-total-patients");
  if (patientStat) patientStat.textContent = stats ? stats.totalPatients : patients.length;

  // Total doctors
  const doctorStat = document.getElementById("stat-total-doctors");
  if (doctorStat) doctorStat.textContent = stats ? stats.totalDoctors : doctors.length;

  // Today's appointments (filter today or show pending/confirmed count)
  const todayDate = new Date().toISOString().slice(0, 10);
  const todayApts = appointments.filter(a => a.date === todayDate);
  const aptStat = document.getElementById("stat-today-appointments");
  if (aptStat) aptStat.textContent = stats ? stats.todayAppointments : todayApts.length;

  // Sum of invoices whose status is Paid; this does not confirm payment processing.
  const totalRev = stats ? Number(stats.totalRevenue || 0) : invoices
    .filter(inv => inv.status === "Paid")
    .reduce((sum, inv) => sum + Number(inv.amount), 0);
  const revStat = document.getElementById("stat-total-revenue");
  if (revStat) revStat.textContent = `$${totalRev.toLocaleString()}`;
}

function renderRecentAppointmentsTable() {
  const appointments = DB.get("appointments", []);
  const tbody = document.getElementById("dashboard-recent-appointments-body");
  if (!tbody) return;

  tbody.innerHTML = "";
  const recent = appointments.slice(0, 5);

  if (recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No appointments recorded yet.</td></tr>`;
    return;
  }

  recent.forEach(apt => {
    const statusClass = getStatusClass(apt.status);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="fw-bold">${escapeHtml(apt.id)}</span></td>
      <td>
        <div class="fw-semibold">${escapeHtml(apt.patientName)}</div>
        <div class="small text-muted">${escapeHtml(apt.patientPhone || "N/A")}</div>
      </td>
      <td>
        <div>${escapeHtml(apt.doctorName)}</div>
        <span class="badge-pill-pastel badge-blue" style="font-size: 0.72rem; padding: 2px 8px;">${escapeHtml(apt.department)}</span>
      </td>
      <td>
        <div>${escapeHtml(apt.date)}</div>
        <div class="small text-muted">${escapeHtml(apt.time)}</div>
      </td>
      <td>
        <span class="status-badge ${statusClass}">${escapeHtml(apt.status)}</span>
      </td>
      <td>
        <div class="d-flex gap-1">
          <button class="btn-table-action" title="Mark Completed" onclick="quickUpdateAppointmentStatus(${escapeHtml(JSON.stringify(apt.id))}, 'Completed')">
            <i class="bi bi-check2"></i>
          </button>
          <button class="btn-table-action btn-delete" title="Cancel Appointment" onclick="quickUpdateAppointmentStatus(${escapeHtml(JSON.stringify(apt.id))}, 'Cancelled')">
            <i class="bi bi-x"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderActivityFeed() {
  const activities = DB.get("activities", []);
  const container = document.getElementById("dashboard-activity-feed");
  if (!container) return;

  container.innerHTML = "";
  activities.forEach(act => {
    const div = document.createElement("div");
    div.className = "activity-item";
    div.innerHTML = `
      <div class="activity-dot-circle ${escapeHtml(act.color)}">
        <i class="bi ${escapeHtml(act.icon)}"></i>
      </div>
      <div>
        <div class="fw-semibold" style="font-size: 0.92rem;">${escapeHtml(act.title)}</div>
        <div class="text-secondary" style="font-size: 0.85rem;">${escapeHtml(act.detail)}</div>
        <div class="text-muted" style="font-size: 0.75rem; margin-top: 2px;">${escapeHtml(act.time)}</div>
      </div>
    `;
    container.appendChild(div);
  });
}

function getStatusClass(status) {
  switch (String(status).toLowerCase()) {
    case "confirmed":
    case "admitted":
    case "paid":
    case "available":
    case "active":
      return "status-confirmed";
    case "pending":
    case "outpatient":
    case "in surgery":
      return "status-pending";
    case "completed":
    case "discharged":
      return "status-completed";
    case "cancelled":
    case "overdue":
    case "on leave":
    case "inactive":
      return "status-cancelled";
    default:
      return "status-pending";
  }
}

// ==========================================================================
// 6. Pure HTML5 Canvas Interactive Charts (No external libraries!)
// ==========================================================================
function renderDashboardCharts() {
  renderWeeklyChart();
  renderDepartmentDonut();
}

function renderWeeklyChart() {
  const canvas = document.getElementById("appointmentsChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Handle Retina resolution
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = 260 * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = 260;
  ctx.clearRect(0, 0, w, h);

  const stats = DB.get("dashboardStats");
  const days = stats?.weeklyDays || [];
  const appointmentsData = stats?.weeklyAppointments || [];
  const admissionsData = stats?.weeklyAdmissions || [];
  const maxVal = Math.max(1, ...appointmentsData, ...admissionsData);

  const paddingLeft = 40;
  const paddingBottom = 35;
  const chartW = w - paddingLeft - 20;
  const chartH = h - paddingBottom - 20;

  // Draw subtle grid lines
  ctx.strokeStyle = "#E8ECEF";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = 20 + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(w - 20, y);
    ctx.stroke();

    // Y Axis labels
    ctx.fillStyle = "#8F9CAE";
    ctx.font = "11px 'Plus Jakarta Sans', sans-serif";
    ctx.textAlign = "right";
    const labelVal = Math.round(maxVal - (maxVal / 4) * i);
    ctx.fillText(labelVal, paddingLeft - 8, y + 4);
  }

  // Draw Dual Column Bars
  const barGroupWidth = chartW / days.length;
  const barWidth = Math.min(16, barGroupWidth * 0.28);

  days.forEach((day, idx) => {
    const groupX = paddingLeft + idx * barGroupWidth + (barGroupWidth - barWidth * 2 - 6) / 2;

    // Bar 1: Appointments (Pastel Blue to Navy)
    const val1 = appointmentsData[idx];
    const barHeight1 = (val1 / maxVal) * chartH;
    const y1 = 20 + chartH - barHeight1;

    ctx.fillStyle = "#1C5D99";
    roundRect(ctx, groupX, y1, barWidth, barHeight1, 4);

    // Bar 2: Admissions (Mint Green)
    const val2 = admissionsData[idx];
    const barHeight2 = (val2 / maxVal) * chartH;
    const y2 = 20 + chartH - barHeight2;

    ctx.fillStyle = "#0E9F6E";
    roundRect(ctx, groupX + barWidth + 6, y2, barWidth, barHeight2, 4);

    // X Axis Label
    ctx.fillStyle = "#5C6B7E";
    ctx.font = "600 12px 'Plus Jakarta Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(day, groupX + barWidth + 3, h - 10);
  });
}

function renderDepartmentDonut() {
  const canvas = document.getElementById("departmentDonutChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = 260 * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = 260;
  ctx.clearRect(0, 0, w, h);

  const data = DB.get("dashboardStats")?.departmentShare || [];

  const total = data.reduce((acc, d) => acc + d.value, 0);
  if (!total) {
    ctx.fillStyle = "#8F9CAE";
    ctx.font = "14px 'Plus Jakarta Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("No appointment data available", w / 2, h / 2);
    return;
  }
  const centerX = w / 2;
  const centerY = h / 2 - 10;
  const outerRadius = 85;
  const innerRadius = 55;

  let startAngle = -Math.PI / 2;

  data.forEach(slice => {
    const sliceAngle = (slice.value / total) * (Math.PI * 2);
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, startAngle, startAngle + sliceAngle);
    ctx.arc(centerX, centerY, innerRadius, startAngle + sliceAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = slice.color;
    ctx.fill();

    startAngle += sliceAngle;
  });

  // Donut center text
  ctx.fillStyle = "#27364B";
  ctx.font = "bold 20px 'Plus Jakarta Sans', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${Math.round(total)}%`, centerX, centerY + 2);
  ctx.fillStyle = "#8F9CAE";
  ctx.font = "11px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("Appointments", centerX, centerY + 18);
}

function renderReportsCharts() {
  const canvas = document.getElementById("revenueTrendChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = 280 * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = 280;
  ctx.clearRect(0, 0, w, h);

  const monthlyRevenue = new Map();
  DB.get("invoices", []).forEach(invoice => {
    if (invoice.status !== "Paid" || !invoice.date) return;
    const month = invoice.date.slice(0, 7);
    monthlyRevenue.set(month, (monthlyRevenue.get(month) || 0) + Number(invoice.amount || 0));
  });
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (5 - index));
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
  const revenue = months.map(month => monthlyRevenue.get(month) || 0);
  const max = Math.max(1, ...revenue);
  const monthLabels = months.map(month =>
    new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, { month: "short" }));

  const padLeft = 60;
  const padBottom = 35;
  const chartW = w - padLeft - 20;
  const chartH = h - padBottom - 20;

  // Grid
  ctx.strokeStyle = "#E8ECEF";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = 20 + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(w - 20, y);
    ctx.stroke();

    ctx.fillStyle = "#8F9CAE";
    ctx.font = "11px 'Plus Jakarta Sans', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`$${Math.round((max * (4 - i) / 4) / 1000)}k`, padLeft - 10, y + 4);
  }

  // Draw smooth gradient curve
  const points = months.map((m, i) => ({
    x: padLeft + (chartW / (months.length - 1)) * i,
    y: 20 + chartH - (revenue[i] / max) * chartH
  }));

  // Create gradient area
  const gradient = ctx.createLinearGradient(0, 20, 0, 20 + chartH);
  gradient.addColorStop(0, "rgba(28, 93, 153, 0.28)");
  gradient.addColorStop(1, "rgba(28, 93, 153, 0.0)");

  ctx.beginPath();
  ctx.moveTo(points[0].x, 20 + chartH);
  ctx.lineTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.lineTo(points[points.length - 1].x, 20 + chartH);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Draw stroke line
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.strokeStyle = "#1C5D99";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Draw point circles
  points.forEach((p, idx) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#1C5D99";
    ctx.stroke();

    // Month label
    ctx.fillStyle = "#5C6B7E";
    ctx.font = "600 12px 'Plus Jakarta Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(monthLabels[idx], p.x, h - 10);
  });
}

function updateReportMetrics() {
  const departments = DB.get("departments", []);
  const totalBeds = departments.reduce((total, department) => total + Number(department.totalBeds || 0), 0);
  const occupiedBeds = departments.reduce((total, department) => total + Number(department.occupiedBeds || 0), 0);
  const occupancy = totalBeds ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
  const invoices = DB.get("invoices", []);
  const appointments = DB.get("appointments", []);
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const occupancyElement = document.getElementById("report-bed-occupancy");
  const bedCountElement = document.getElementById("report-bed-count");
  const invoiceCountElement = document.getElementById("report-invoice-count");
  const outstandingElement = document.getElementById("report-outstanding-count");
  const monthAppointmentsElement = document.getElementById("report-month-appointments");
  if (occupancyElement) occupancyElement.textContent = `${occupancy}%`;
  if (bedCountElement) bedCountElement.textContent = `${occupiedBeds} of ${totalBeds} beds`;
  if (invoiceCountElement) invoiceCountElement.textContent = invoices.length;
  if (outstandingElement) outstandingElement.textContent = invoices.filter(invoice => invoice.status !== "Paid").length;
  if (monthAppointmentsElement) {
    monthAppointmentsElement.textContent = appointments.filter(appointment =>
      (appointment.date || "").slice(0, 7) === currentMonth).length;
  }
}

function roundRect(ctx, x, y, width, height, radius) {
  if (height <= 0) return;
  if (radius > height / 2) radius = height / 2;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

// ==========================================================================
// 7. Patient Management (CRUD)
// ==========================================================================
function renderPatientsTable() {
  const patients = DB.get("patients", []);
  const tbody = document.getElementById("patients-table-body");
  if (!tbody) return;

  const searchInput = document.getElementById("patientSearchInput");
  const filterGender = document.getElementById("patientFilterGender");
  const filterStatus = document.getElementById("patientFilterStatus");

  const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
  const gender = filterGender ? filterGender.value : "";
  const status = filterStatus ? filterStatus.value : "";

  const filtered = patients.filter(p => {
    const matchQuery = !query ||
      String(p.name || "").toLowerCase().includes(query) ||
      String(p.id || "").toLowerCase().includes(query) ||
      (p.condition && p.condition.toLowerCase().includes(query)) ||
      (p.doctor && p.doctor.toLowerCase().includes(query));

    const matchGender = !gender || p.gender === gender;
    const matchStatus = !status || p.status === status;

    return matchQuery && matchGender && matchStatus;
  });

  tbody.innerHTML = "";

  const countBadge = document.getElementById("patients-count-badge");
  if (countBadge) countBadge.textContent = `${filtered.length} Patients`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-5 text-muted">
      <i class="bi bi-people display-6 d-block mb-2 text-secondary"></i>
      No patient records found matching your filters.
    </td></tr>`;
    return;
  }

  filtered.forEach(pat => {
    const initials = pat.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
    const avatarColor = pat.gender === "Female" ? "background-color: var(--pastel-pink); color: var(--pastel-pink-dark);" : "background-color: var(--pastel-blue); color: var(--pastel-blue-dark);";
    const statusClass = getStatusClass(pat.status);

    const role = authState.user?.role;
    const canEdit = role === "ADMIN" || role === "RECEPTIONIST" || role === "DOCTOR";
    const canDelete = role === "ADMIN";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="fw-bold">${escapeHtml(pat.id)}</span></td>
      <td>
        <div class="d-flex align-items-center gap-3">
          <div class="patient-avatar-box" style="${avatarColor}">${escapeHtml(initials)}</div>
          <div>
            <div class="fw-bold text-dark">${escapeHtml(pat.name)}</div>
            <div class="small text-muted">${escapeHtml(pat.email || "No email registered")}</div>
          </div>
        </div>
      </td>
      <td>${Number(pat.age)} yrs / ${escapeHtml(pat.gender)}</td>
      <td>
        <div>${escapeHtml(pat.phone)}</div>
        <span class="badge-pill-pastel badge-cream py-0 px-2" style="font-size: 0.7rem;">Blood: ${escapeHtml(pat.bloodGroup || "N/A")}</span>
      </td>
      <td>
        <div class="fw-semibold text-truncate" style="max-width: 180px;">${escapeHtml(pat.condition || "No condition recorded")}</div>
        <div class="small text-muted">${escapeHtml(pat.doctor || "Unassigned")}</div>
      </td>
      <td>
        <span class="status-badge ${statusClass}">${escapeHtml(pat.status)}</span>
      </td>
      <td>
        <div class="d-flex gap-1">
          <button class="btn-table-action" title="View Patient Profile" onclick="viewPatientDetails(${escapeHtml(JSON.stringify(pat.id))})">
            <i class="bi bi-eye"></i>
          </button>
          ${canEdit ? `<button class="btn-table-action" title="Edit Patient" onclick="openPatientModal(${escapeHtml(JSON.stringify(pat.id))})"><i class="bi bi-pencil"></i></button>` : ""}
          ${canDelete ? `<button class="btn-table-action btn-delete" title="Delete Patient" onclick="deletePatientRecord(${escapeHtml(JSON.stringify(pat.id))})"><i class="bi bi-trash3"></i></button>` : ""}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openPatientModal(patientId = null) {
  const form = document.getElementById("patientForm");
  if (!form) return;
  form.reset();

  const titleEl = document.getElementById("patientModalTitle");
  const idInput = document.getElementById("patientIdHidden");

  // Populate doctor select options dynamically
  const doctors = DB.get("doctors", []);
  const docSelect = document.getElementById("patDoctorInput");
  if (docSelect) {
    const doctorRole = authState.user?.role === "DOCTOR";
    const availableDoctors = doctorRole
      ? doctors.filter(d => d.name === authState.user.doctorName)
      : doctors;
    docSelect.innerHTML = `<option value="">Select Primary Physician</option>` +
      availableDoctors.map(d => `<option value="${escapeHtml(d.name)}">${escapeHtml(d.name)} (${escapeHtml(d.department)})</option>`).join("");
    docSelect.disabled = doctorRole;
  }

  if (patientId) {
    const patients = DB.get("patients", []);
    const pat = patients.find(p => p.id === patientId);
    if (pat) {
      if (titleEl) titleEl.textContent = "Edit Patient Record";
      idInput.value = pat.id;
      document.getElementById("patNameInput").value = pat.name;
      document.getElementById("patAgeInput").value = pat.age;
      document.getElementById("patGenderInput").value = pat.gender;
      document.getElementById("patBloodInput").value = pat.bloodGroup || "O+";
      document.getElementById("patPhoneInput").value = pat.phone;
      document.getElementById("patEmailInput").value = pat.email || "";
      document.getElementById("patConditionInput").value = pat.condition || "";
      document.getElementById("patDoctorInput").value = pat.doctor || "";
      document.getElementById("patStatusInput").value = pat.status;
      document.getElementById("patAddressInput").value = pat.address || "";
    }
  } else {
    if (titleEl) titleEl.textContent = "Add New Patient Record";
    idInput.value = "";
  }

  const modalEl = document.getElementById("patientModal");
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
}

async function savePatientForm(e) {
  e.preventDefault();
  const form = document.getElementById("patientForm");
  if (!form.checkValidity()) {
    form.classList.add("was-validated");
    return;
  }

  const id = document.getElementById("patientIdHidden").value;
  const name = document.getElementById("patNameInput").value.trim();
  const age = Number(document.getElementById("patAgeInput").value);
  const gender = document.getElementById("patGenderInput").value;
  const bloodGroup = document.getElementById("patBloodInput").value;
  const phone = document.getElementById("patPhoneInput").value.trim();
  const email = document.getElementById("patEmailInput").value.trim();
  const condition = document.getElementById("patConditionInput").value.trim();
  const doctor = document.getElementById("patDoctorInput").value;
  const status = document.getElementById("patStatusInput").value;
  const address = document.getElementById("patAddressInput").value.trim();

  const patient = { name, age, gender, bloodGroup, phone, email, condition, doctor, status, address };
  try {
    const saved = id
      ? await apiRequest(`/api/patients/${encodeURIComponent(id)}`, { method: "PUT", body: patient })
      : await apiRequest("/api/patients", { method: "POST", body: patient });
    const modal = bootstrap.Modal.getInstance(document.getElementById("patientModal"));
    if (modal) modal.hide();
    showToast(id
      ? `Patient record for ${saved.name} updated.`
      : `Patient ${saved.name} registered as ${saved.id}.`);
    try {
      await loadStaffData();
      refreshAllViews();
    } catch (refreshError) {
      showToast(`Patient record saved, but the latest data could not be loaded: ${refreshError.message}`, "warning");
    }
  } catch (error) {
    showToast(`Unable to save patient record: ${error.message}`, "error");
  }
}

async function viewPatientDetails(patientId) {
  const patients = DB.get("patients", []);
  const pat = patients.find(p => p.id === patientId);
  if (!pat) return;

  const content = document.getElementById("patientViewModalContent");
  if (!content) return;

  const statusClass = getStatusClass(pat.status);
  const initials = pat.name.split(" ").map(n => n[0]).join("");
  content.innerHTML = `
    <div class="text-center pb-3 border-bottom">
      <div class="patient-avatar-box mx-auto mb-2" style="width: 64px; height: 64px; font-size: 1.5rem; background: var(--pastel-blue); color: var(--brand-primary);">
        ${escapeHtml(initials)}
      </div>
      <h4 class="fw-bold mb-1">${escapeHtml(pat.name)}</h4>
      <div class="text-muted small">Record ID: ${escapeHtml(pat.id)}</div>
      <span class="status-badge ${statusClass} mt-2">${escapeHtml(pat.status)}</span>
    </div>
    <div class="row g-3 mt-2">
      <div class="col-6">
        <label class="small text-muted">Age / Gender</label>
        <div class="fw-semibold">${Number(pat.age)} Years (${escapeHtml(pat.gender)})</div>
      </div>
      <div class="col-6">
        <label class="small text-muted">Blood Group</label>
        <div class="fw-semibold text-danger">${escapeHtml(pat.bloodGroup || "Not Recorded")}</div>
      </div>
      <div class="col-6">
        <label class="small text-muted">Contact Phone</label>
        <div class="fw-semibold">${escapeHtml(pat.phone)}</div>
      </div>
      <div class="col-6">
        <label class="small text-muted">Email Address</label>
        <div class="fw-semibold text-truncate">${escapeHtml(pat.email || "N/A")}</div>
      </div>
      <div class="col-12">
        <label class="small text-muted">Primary Diagnosed Condition</label>
        <div class="p-2 rounded bg-light border fw-semibold text-primary">${escapeHtml(pat.condition || "No condition recorded")}</div>
      </div>
      <div class="col-6">
        <label class="small text-muted">Assigned Physician</label>
        <div class="fw-semibold">${escapeHtml(pat.doctor || "Unassigned")}</div>
      </div>
      <div class="col-6">
        <label class="small text-muted">Admission Date</label>
        <div class="fw-semibold">${escapeHtml(pat.admissionDate || "Not recorded")}</div>
      </div>
      <div class="col-12">
        <label class="small text-muted">Residential Address</label>
        <div class="text-secondary small">${escapeHtml(pat.address || "Not recorded")}</div>
      </div>
    </div>
    <div id="patientClinicalPanel" class="mt-4"></div>
  `;

  const modalEl = document.getElementById("patientViewModal");
  if (!modalEl.dataset.clinicalCleanupBound) {
    modalEl.addEventListener("hidden.bs.modal", () => {
      activeClinicalPatientId = null;
      activeClinicalData = null;
      document.getElementById("patientViewModalContent")?.replaceChildren();
    });
    modalEl.dataset.clinicalCleanupBound = "true";
  }
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
  await loadPatientClinicalData(patientId);
}

async function loadPatientClinicalData(patientId) {
  const panel = document.getElementById("patientClinicalPanel");
  if (!panel) return;
  activeClinicalPatientId = patientId;
  activeClinicalData = null;
  const role = authState.user?.role;
  if (!["ADMIN", "DOCTOR", "NURSE"].includes(role)) {
    panel.innerHTML = `<div class="alert alert-secondary mb-0">Clinical records are not available for your role.</div>`;
    return;
  }

  panel.innerHTML = `<div class="text-center text-muted py-3"><span class="spinner-border spinner-border-sm me-2"></span>Loading assigned clinical data...</div>`;
  const base = `/api/patients/${encodeURIComponent(patientId)}`;
  try {
    const [clinicalRecords, prescriptions, vitals, nursingNotes, careTasks] = await Promise.all([
      apiRequest(`${base}/clinical-records`),
      apiRequest(`${base}/prescriptions`),
      apiRequest(`${base}/vitals`),
      apiRequest(`${base}/nursing-notes`),
      apiRequest(`${base}/nursing-tasks`)
    ]);
    if (activeClinicalPatientId !== patientId) return;
    activeClinicalData = { clinicalRecords, prescriptions, vitals, nursingNotes, careTasks };
    panel.innerHTML = renderPatientClinicalData(patientId, activeClinicalData, role);
  } catch (error) {
    if (activeClinicalPatientId === patientId) {
      panel.innerHTML = `<div class="alert alert-danger mb-0">Unable to load clinical data: ${escapeHtml(error.message)}</div>`;
    }
  }
}

function renderPatientClinicalData(patientId, data, role) {
  const canEditDoctorData = role === "ADMIN" || role === "DOCTOR";
  const canEditVitals = canEditDoctorData || role === "NURSE";
  const canEditNursingNotes = role === "ADMIN" || role === "NURSE";
  const canUpdateTasks = role === "ADMIN" || role === "DOCTOR" || role === "NURSE";
  const sections = [];

  sections.push(renderPatientClinicalSection(
    "clinicalRecords",
    "Doctor Clinical Records",
    data.clinicalRecords,
    [
      { name: "diagnosis", label: "Diagnosis", type: "text", required: true, maxLength: 500 },
      { name: "clinicalNote", label: "Clinical note", type: "textarea", required: true, maxLength: 5000 },
      { name: "allergies", label: "Allergies", type: "text", maxLength: 2000 }
    ],
    canEditDoctorData,
    record => `
      <div class="fw-semibold">${escapeHtml(record.diagnosis)}</div>
      <div class="small text-secondary mt-1">${escapeHtml(record.clinicalNote)}</div>
      <div class="small mt-1"><strong>Allergies:</strong> ${escapeHtml(record.allergies || "Not recorded")}</div>
      <div class="small text-muted mt-1">${escapeHtml(record.author)} · ${formatClinicalDateTime(record.recordedAt)}</div>`
  ));

  sections.push(renderPatientClinicalSection(
    "prescriptions",
    "Prescriptions",
    data.prescriptions,
    [
      { name: "medication", label: "Medication", type: "text", required: true, maxLength: 120 },
      { name: "strength", label: "Strength", type: "text", required: true, maxLength: 80 },
      { name: "dose", label: "Dose", type: "text", required: true, maxLength: 120 },
      { name: "route", label: "Route", type: "text", required: true, maxLength: 80 },
      { name: "frequency", label: "Frequency", type: "text", required: true, maxLength: 120 },
      { name: "duration", label: "Duration", type: "text", required: true, maxLength: 120 },
      { name: "refills", label: "Refills", type: "number", min: 0, max: 99, required: true },
      { name: "status", label: "Status", type: "text", required: true, maxLength: 32 }
    ],
    canEditDoctorData,
    prescription => `
      <div class="fw-semibold">${escapeHtml(prescription.medication)} ${escapeHtml(prescription.strength)}</div>
      <div class="small text-secondary">${escapeHtml(prescription.dose)} · ${escapeHtml(prescription.route)} · ${escapeHtml(prescription.frequency)} · ${escapeHtml(prescription.duration)}</div>
      <div class="small text-muted mt-1">Refills: ${Number(prescription.refills)} · ${escapeHtml(prescription.status)} · ${escapeHtml(prescription.author)}</div>`
  ));

  sections.push(renderPatientClinicalSection(
    "vitals",
    "Vital Signs",
    data.vitals,
    [
      {
        name: "type",
        label: "Measurement",
        type: "select",
        required: true,
        options: [
          ["TEMPERATURE_C", "Temperature (°C)"],
          ["HEART_RATE_BPM", "Heart rate (bpm)"],
          ["RESPIRATORY_RATE_PER_MIN", "Respiratory rate (breaths/min)"],
          ["SYSTOLIC_BP_MMHG", "Systolic blood pressure (mmHg)"],
          ["DIASTOLIC_BP_MMHG", "Diastolic blood pressure (mmHg)"],
          ["OXYGEN_SATURATION_PERCENT", "Oxygen saturation (%)"],
          ["WEIGHT_KG", "Weight (kg)"],
          ["HEIGHT_CM", "Height (cm)"]
        ]
      },
      { name: "value", label: "Value", type: "number", min: 0.001, step: 0.001, required: true }
    ],
    canEditVitals,
    vital => `
      <div class="fw-semibold">${escapeHtml(vital.type.replaceAll("_", " "))}: ${escapeHtml(vital.value)} ${escapeHtml(vital.unit)}</div>
      <div class="small text-muted">${escapeHtml(vital.author)} · ${formatClinicalDateTime(vital.recordedAt)}</div>`
  ));

  sections.push(renderPatientClinicalSection(
    "nursingNotes",
    "Nursing Notes",
    data.nursingNotes,
    [{ name: "content", label: "Nursing note", type: "textarea", required: true, maxLength: 10000 }],
    canEditNursingNotes,
    note => `
      <div class="small text-secondary">${escapeHtml(note.content)}</div>
      <div class="small text-muted mt-1">${escapeHtml(note.author)} · ${formatClinicalDateTime(note.createdAt)}</div>`
  ));

  sections.push(renderPatientCareTasks(patientId, data.careTasks, role, canUpdateTasks));
  return sections.join("");
}

function renderPatientClinicalSection(kind, title, items, fields, canEdit, renderItem) {
  const form = canEdit ? `
    <form id="${kind}Form" class="bg-light border rounded-3 p-3 mb-3" onsubmit="savePatientClinicalData(event, '${kind}')" novalidate>
      <input type="hidden" name="id">
      <div class="row g-2">
        ${fields.map(renderPatientClinicalField).join("")}
      </div>
      <div class="d-flex justify-content-end gap-2 mt-3">
        <button type="button" class="btn btn-sm btn-medicare-outline" onclick="resetPatientClinicalForm('${kind}')">Clear</button>
        <button type="submit" class="btn btn-sm btn-medicare-primary">Save</button>
      </div>
    </form>` : "";
  const list = items.length ? items.map(item => `
    <div class="border rounded-3 p-3 mb-2">
      ${renderItem(item)}
      ${canEdit ? `<button type="button" class="btn btn-sm btn-medicare-outline mt-2" onclick="editPatientClinicalItem('${kind}', ${escapeHtml(JSON.stringify(item.id))})">Edit</button>` : ""}
    </div>`).join("") : `<div class="small text-muted py-2">No records yet.</div>`;

  return `
    <section class="border-top pt-3 mt-3">
      <h6 class="fw-bold mb-3">${title}</h6>
      ${form}
      <div>${list}</div>
    </section>`;
}

function renderPatientClinicalField(field) {
  const required = field.required ? "required" : "";
  const min = field.min !== undefined ? `min="${field.min}"` : "";
  const max = field.max !== undefined ? `max="${field.max}"` : "";
  const step = field.step ? `step="${field.step}"` : "";
  const maxLength = field.maxLength || 240;
  let input;
  if (field.type === "textarea") {
    input = `<textarea class="form-control form-control-sm" name="${field.name}" rows="2" ${required} maxlength="${maxLength}"></textarea>`;
  } else if (field.type === "select") {
    input = `<select class="form-select form-select-sm" name="${field.name}" ${required}>${field.options.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select>`;
  } else {
    input = `<input class="form-control form-control-sm" name="${field.name}" type="${field.type}" ${min} ${max} ${step} ${required} ${field.type === "text" ? `maxlength="${maxLength}"` : ""}>`;
  }
  return `<div class="col-md-6"><label class="form-label small fw-semibold">${field.label}</label>${input}</div>`;
}

function renderPatientCareTasks(patientId, tasks, role, canUpdate) {
  const canCreate = role === "ADMIN" || role === "DOCTOR";
  const form = canCreate ? `
    <form id="nursingTasksForm" class="bg-light border rounded-3 p-3 mb-3" onsubmit="savePatientClinicalData(event, 'nursingTasks')" novalidate>
      <input type="hidden" name="id">
      <label class="form-label small fw-semibold">New care task</label>
      <input class="form-control form-control-sm" name="description" maxlength="500" required>
      <div class="d-flex justify-content-end mt-2"><button type="submit" class="btn btn-sm btn-medicare-primary">Add task</button></div>
    </form>` : "";
  const list = tasks.length ? tasks.map(task => `
    <div class="border rounded-3 p-3 mb-2">
      <div class="fw-semibold">${escapeHtml(task.description)}</div>
      <div class="small text-muted mb-2">Added by ${escapeHtml(task.createdBy)} · ${formatClinicalDateTime(task.createdAt)}</div>
      ${canUpdate
        ? `<select class="form-select form-select-sm" aria-label="Care task status" onchange="saveCareTaskStatus(event, ${escapeHtml(JSON.stringify(patientId))}, ${escapeHtml(JSON.stringify(task.id))})">
             ${[["PENDING", "Pending"], ["IN_PROGRESS", "In Progress"], ["COMPLETED", "Completed"]]
               .map(([value, label]) => `<option value="${value}" ${task.status === value ? "selected" : ""}>${label}</option>`).join("")}
           </select>`
        : `<span class="badge text-bg-secondary">${escapeHtml(task.status.replaceAll("_", " "))}</span>`}
    </div>`).join("") : `<div class="small text-muted py-2">No care tasks yet.</div>`;
  return `
    <section class="border-top pt-3 mt-3">
      <h6 class="fw-bold mb-3">Nursing Care Tasks</h6>
      ${form}
      <div>${list}</div>
    </section>`;
}

function formatClinicalDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time not recorded" : date.toLocaleString();
}

function editPatientClinicalItem(kind, id) {
  const item = activeClinicalData?.[kind]?.find(entry => entry.id === id);
  const form = document.getElementById(`${kind}Form`);
  if (!item || !form) return;
  form.elements.namedItem("id").value = item.id;
  Object.keys(item).forEach(key => {
    const field = form.elements.namedItem(key);
    if (field && item[key] !== null && item[key] !== undefined) field.value = item[key];
  });
  form.scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetPatientClinicalForm(kind) {
  const form = document.getElementById(`${kind}Form`);
  if (form) form.reset();
}

async function savePatientClinicalData(event, kind) {
  event.preventDefault();
  const form = event.currentTarget;
  for (const element of form.elements) {
    if (element.name && element.type !== "hidden" && typeof element.value === "string") {
      element.value = element.value.trim();
    }
  }
  if (!form.checkValidity()) {
    form.classList.add("was-validated");
    return;
  }

  const config = {
    clinicalRecords: { path: "clinical-records", fields: ["diagnosis", "clinicalNote", "allergies"] },
    prescriptions: { path: "prescriptions", fields: ["medication", "strength", "dose", "route", "frequency", "duration", "refills", "status"] },
    vitals: { path: "vitals", fields: ["type", "value"] },
    nursingNotes: { path: "nursing-notes", fields: ["content"] },
    nursingTasks: { path: "nursing-tasks", fields: ["description"] }
  }[kind];
  if (!config || !activeClinicalPatientId) return;

  const recordId = form.elements.namedItem("id").value;
  const body = {};
  config.fields.forEach(field => {
    const input = form.elements.namedItem(field);
    body[field] = input.type === "number" ? Number(input.value) : input.value;
  });
  const path = `/api/patients/${encodeURIComponent(activeClinicalPatientId)}/${config.path}`;
  try {
    await apiRequest(recordId ? `${path}/${encodeURIComponent(recordId)}` : path, {
      method: recordId ? "PUT" : "POST",
      body
    });
    showToast("Clinical information saved.");
    await loadPatientClinicalData(activeClinicalPatientId);
  } catch (error) {
    showToast(`Unable to save clinical information: ${error.message}`, "error");
  }
}

async function saveCareTaskStatus(event, patientId, taskId) {
  try {
    await apiRequest(`/api/patients/${encodeURIComponent(patientId)}/nursing-tasks/${encodeURIComponent(taskId)}/status`, {
      method: "PATCH",
      body: { status: event.currentTarget.value }
    });
    showToast("Care task status updated.");
    await loadPatientClinicalData(patientId);
  } catch (error) {
    showToast(`Unable to update care task: ${error.message}`, "error");
    await loadPatientClinicalData(patientId);
  }
}

async function deletePatientRecord(patientId) {
  if (!confirm(`Are you sure you want to permanently delete patient ${patientId}?`)) return;
  try {
    await apiRequest(`/api/patients/${encodeURIComponent(patientId)}`, { method: "DELETE" });
    showToast(`Patient record ${patientId} deleted.`, "warning");
    await loadStaffData();
    refreshAllViews();
  } catch (error) {
    showToast(`Unable to delete patient record: ${error.message}`, "error");
  }
}

// ==========================================================================
// 8. Doctor Management (CRUD)
// ==========================================================================
function renderDoctorsGrid() {
  const doctors = DB.get("doctors", []);
  const container = document.getElementById("doctors-cards-grid");
  if (!container) return;

  const searchInput = document.getElementById("doctorSearchInput");
  const filterDept = document.getElementById("doctorFilterDept");

  const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
  const dept = filterDept ? filterDept.value : "";

  const filtered = doctors.filter(d => {
    const matchQuery = !query ||
      d.name.toLowerCase().includes(query) ||
      d.department.toLowerCase().includes(query) ||
      (d.degree && d.degree.toLowerCase().includes(query));

    const matchDept = !dept || d.department === dept;

    return matchQuery && matchDept;
  });

  container.innerHTML = "";

  const countBadge = document.getElementById("doctors-count-badge");
  if (countBadge) countBadge.textContent = `${filtered.length} Specialists`;

  if (filtered.length === 0) {
    container.innerHTML = `<div class="col-12 text-center py-5 text-muted">
      <i class="bi bi-person-x display-6 d-block mb-2 text-secondary"></i>
      No doctors found matching your criteria.
    </div>`;
    return;
  }

  filtered.forEach(doc => {
    const isAvail = doc.status === "Available";
    const statusBg = isAvail ? "background: #DFF3EA; color: #0E9F6E;" : "background: #FFF4E5; color: #D97706;";
    const canManage = authState.user?.role === "ADMIN";

    const col = document.createElement("div");
    col.className = "col-lg-4 col-md-6";
    col.innerHTML = `
      <div class="doctor-card">
        <div class="doctor-img-wrap">
          <img src="${escapeHtml(safeHttpUrl(doc.image) || DOCTOR_PLACEHOLDER_IMAGE)}" alt="${escapeHtml(doc.name)}" loading="lazy">
          <span class="doctor-dept-pill">${escapeHtml(doc.department)}</span>
          <span class="doctor-availability-pill" style="${statusBg}">
            <i class="bi bi-circle-fill me-1" style="font-size: 0.5rem;"></i>${escapeHtml(doc.status)}
          </span>
        </div>
        <div class="doctor-body">
          <div>
            <div class="d-flex justify-content-between align-items-start mb-1">
              <h5 class="doctor-name mb-0">${escapeHtml(doc.name)}</h5>
              <div class="doctor-rating">
                <i class="bi bi-star-fill"></i> ${Number(doc.rating || 0)}
              </div>
            </div>
            <div class="doctor-sub">${escapeHtml(doc.degree)}</div>
            <p class="small text-secondary mb-3" style="line-height: 1.5; height: 42px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
              ${escapeHtml(doc.about || "Professional biography not provided.")}
            </p>
            <div class="d-flex justify-content-between align-items-center py-2 px-3 rounded bg-light border mb-3 small">
              <span class="text-muted"><i class="bi bi-briefcase me-1"></i> ${escapeHtml(doc.experience)}</span>
              <span class="fw-bold text-primary"><i class="bi bi-cash me-1"></i> $${Number(doc.fee || 0)}/Visit</span>
            </div>
          </div>
          <div class="d-flex gap-2">
            ${canManage ? `<button class="btn btn-sm btn-outline-secondary flex-grow-1" onclick="openDoctorModal(${escapeHtml(JSON.stringify(doc.id))})">
              <i class="bi bi-pencil me-1"></i> Edit
            </button>` : ""}
            <button class="btn btn-sm btn-medicare-primary flex-grow-1" onclick="openBookAppointmentForDoctor(${escapeHtml(JSON.stringify(doc.name))}, ${escapeHtml(JSON.stringify(doc.department))})">
              <i class="bi bi-calendar-plus me-1"></i> Book
            </button>
            ${canManage ? `<button class="btn btn-sm btn-outline-danger" title="Remove Doctor" onclick="deleteDoctorRecord(${escapeHtml(JSON.stringify(doc.id))})">
              <i class="bi bi-trash"></i>
            </button>` : ""}
          </div>
        </div>
      </div>
    `;
    col.querySelector("img").addEventListener("error", event => {
      const image = event.currentTarget;
      if (image.getAttribute("src") !== DOCTOR_PLACEHOLDER_IMAGE) {
        image.src = DOCTOR_PLACEHOLDER_IMAGE;
      }
    }, { once: true });
    container.appendChild(col);
  });
}

function openDoctorModal(doctorId = null) {
  const form = document.getElementById("doctorForm");
  if (!form) return;
  form.reset();

  const titleEl = document.getElementById("doctorModalTitle");
  const idInput = document.getElementById("doctorIdHidden");

  if (doctorId) {
    const doctors = DB.get("doctors", []);
    const doc = doctors.find(d => d.id === doctorId);
    if (doc) {
      if (titleEl) titleEl.textContent = "Edit Doctor Profile";
      idInput.value = doc.id;
      document.getElementById("docNameInput").value = doc.name;
      document.getElementById("docDeptInput").value = doc.department;
      document.getElementById("docDegreeInput").value = doc.degree;
      document.getElementById("docExpInput").value = doc.experience;
      document.getElementById("docFeeInput").value = doc.fee;
      document.getElementById("docPhoneInput").value = doc.phone;
      document.getElementById("docEmailInput").value = doc.email;
      document.getElementById("docStatusInput").value = doc.status;
      document.getElementById("docImageInput").value = doc.image;
      document.getElementById("docAboutInput").value = doc.about || "";
    }
  } else {
    if (titleEl) titleEl.textContent = "Add New Specialist";
    idInput.value = "";
    document.getElementById("docImageInput").value = "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=600&q=80";
  }

  const modalEl = document.getElementById("doctorModal");
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
}

async function saveDoctorForm(e) {
  e.preventDefault();
  const form = document.getElementById("doctorForm");
  if (!form.checkValidity()) {
    form.classList.add("was-validated");
    return;
  }

  const id = document.getElementById("doctorIdHidden").value;
  const name = document.getElementById("docNameInput").value.trim();
  const department = document.getElementById("docDeptInput").value;
  const degree = document.getElementById("docDegreeInput").value.trim();
  const experience = document.getElementById("docExpInput").value.trim();
  const fee = Number(document.getElementById("docFeeInput").value);
  const phone = document.getElementById("docPhoneInput").value.trim();
  const email = document.getElementById("docEmailInput").value.trim();
  const status = document.getElementById("docStatusInput").value;
  const image = document.getElementById("docImageInput").value.trim() || "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=600&q=80";
  const about = document.getElementById("docAboutInput").value.trim();

  const doctor = {
    name, department, degree, experience, fee, phone, email, status, image, about,
    rating: id ? DB.get("doctors", []).find(item => item.id === id)?.rating || 0 : 0,
    reviews: id ? DB.get("doctors", []).find(item => item.id === id)?.reviews || 0 : 0
  };
  try {
    const saved = id
      ? await apiRequest(`/api/doctors/${encodeURIComponent(id)}`, { method: "PUT", body: doctor })
      : await apiRequest("/api/doctors", { method: "POST", body: doctor });
    const modal = bootstrap.Modal.getInstance(document.getElementById("doctorModal"));
    if (modal) modal.hide();
    showToast(id
      ? `Doctor profile for ${saved.name} updated.`
      : `Specialist ${saved.name} added to the directory.`);
    try {
      await loadStaffData();
      refreshAllViews();
    } catch (refreshError) {
      showToast(`Doctor profile saved, but the latest data could not be loaded: ${refreshError.message}`, "warning");
    }
  } catch (error) {
    showToast(`Unable to save doctor profile: ${error.message}`, "error");
  }
}

async function deleteDoctorRecord(doctorId) {
  if (!confirm(`Are you sure you want to remove doctor record ${doctorId}?`)) return;
  try {
    await apiRequest(`/api/doctors/${encodeURIComponent(doctorId)}`, { method: "DELETE" });
    showToast("Specialist profile removed.", "warning");
    await loadStaffData();
    refreshAllViews();
  } catch (error) {
    showToast(`Unable to remove the doctor profile: ${error.message}`, "error");
  }
}

// ==========================================================================
// 9. Appointment Management (CRUD)
// ==========================================================================
function renderAppointmentsTable() {
  const appointments = DB.get("appointments", []);
  const tbody = document.getElementById("appointments-table-body");
  if (!tbody) return;

  const searchInput = document.getElementById("appointmentSearchInput");
  const filterStatus = document.getElementById("appointmentFilterStatus");
  const filterDept = document.getElementById("appointmentFilterDept");

  const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
  const status = filterStatus ? filterStatus.value : "";
  const dept = filterDept ? filterDept.value : "";

  const filtered = appointments.filter(a => {
    const matchQuery = !query ||
      a.id.toLowerCase().includes(query) ||
      a.patientName.toLowerCase().includes(query) ||
      a.doctorName.toLowerCase().includes(query);

    const matchStatus = !status || a.status === status;
    const matchDept = !dept || a.department === dept;

    return matchQuery && matchStatus && matchDept;
  });

  tbody.innerHTML = "";

  const countBadge = document.getElementById("appointments-count-badge");
  if (countBadge) countBadge.textContent = `${filtered.length} Bookings`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-muted">
      <i class="bi bi-calendar2-x display-6 d-block mb-2 text-secondary"></i>
      No appointments match your search criteria.
    </td></tr>`;
    return;
  }

  filtered.forEach(apt => {
    const statusClass = getStatusClass(apt.status);
    const canManage = ["ADMIN", "RECEPTIONIST"].includes(authState.user?.role);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="fw-bold">${escapeHtml(apt.id)}</span></td>
      <td>
        <div class="fw-bold">${escapeHtml(apt.patientName)}</div>
        <div class="small text-muted">${escapeHtml(apt.patientPhone || "No phone")}</div>
      </td>
      <td>
        <div class="fw-semibold">${escapeHtml(apt.doctorName)}</div>
        <span class="badge-pill-pastel badge-blue" style="font-size: 0.72rem; padding: 2px 8px;">${escapeHtml(apt.department)}</span>
      </td>
      <td>
        <div><i class="bi bi-calendar3 me-1 text-muted"></i> ${escapeHtml(apt.date)}</div>
        <div class="small text-muted"><i class="bi bi-clock me-1"></i> ${escapeHtml(apt.time)}</div>
      </td>
      <td>
        <div class="text-truncate" style="max-width: 180px;">${escapeHtml(apt.reason || "No reason provided")}</div>
        <span class="badge bg-light text-secondary border" style="font-size: 0.7rem;">${escapeHtml(apt.type || "In-Person")}</span>
      </td>
      <td>
        <span class="status-badge ${statusClass}">${escapeHtml(apt.status)}</span>
      </td>
      <td>
        ${canManage ? `
        <div class="dropdown">
          <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
            Action
          </button>
          <ul class="dropdown-menu dropdown-menu-end shadow-sm">
            <li><a class="dropdown-item" href="javascript:void(0)" onclick="quickUpdateAppointmentStatus(${escapeHtml(JSON.stringify(apt.id))}, 'Confirmed')"><i class="bi bi-check2-circle text-success me-2"></i> Confirm</a></li>
            <li><a class="dropdown-item" href="javascript:void(0)" onclick="quickUpdateAppointmentStatus(${escapeHtml(JSON.stringify(apt.id))}, 'Completed')"><i class="bi bi-clipboard2-check text-primary me-2"></i> Mark Completed</a></li>
            <li><a class="dropdown-item" href="javascript:void(0)" onclick="quickUpdateAppointmentStatus(${escapeHtml(JSON.stringify(apt.id))}, 'Cancelled')"><i class="bi bi-x-circle text-danger me-2"></i> Cancel</a></li>
            <li><hr class="dropdown-divider"></li>
            <li><a class="dropdown-item" href="javascript:void(0)" onclick="openAppointmentModal(${escapeHtml(JSON.stringify(apt.id))})"><i class="bi bi-pencil me-2"></i> Edit Details</a></li>
          </ul>
        </div>
        ` : `<span class="text-muted">Read only</span>`}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openAppointmentModal(appointmentId = null) {
  const form = document.getElementById("appointmentForm");
  if (!form) return;
  form.reset();

  const titleEl = document.getElementById("appointmentModalTitle");
  const idInput = document.getElementById("appointmentIdHidden");

  // Populate doctor select
  const doctors = DB.get("doctors", []);
  const docSelect = document.getElementById("aptDoctorInput");
  if (docSelect) {
    docSelect.innerHTML = `<option value="">Select Doctor</option>` +
      doctors.map(d => `<option value="${escapeHtml(d.name)}" data-dept="${escapeHtml(d.department)}">${escapeHtml(d.name)} (${escapeHtml(d.department)})</option>`).join("");
  }

  // Populate patient suggestions
  const patients = DB.get("patients", []);
  const patientSelect = document.getElementById("aptPatientSelect");
  if (patientSelect) {
    patientSelect.innerHTML = `<option value="">-- Or Select Existing Registered Patient --</option>` +
      patients.map(p => `<option value="${escapeHtml(p.id)}" data-name="${escapeHtml(p.name)}" data-phone="${escapeHtml(p.phone)}">${escapeHtml(p.name)} (${escapeHtml(p.id)})</option>`).join("");
  }
  const canManage = ["ADMIN", "RECEPTIONIST"].includes(authState.user?.role);
  const patientPicker = document.getElementById("aptPatientPickerGroup");
  const statusGroup = document.getElementById("aptStatusGroup");
  if (patientPicker) patientPicker.classList.toggle("d-none", !canManage);
  if (statusGroup) statusGroup.classList.toggle("d-none", !canManage);

  if (appointmentId) {
    const appointments = DB.get("appointments", []);
    const apt = appointments.find(a => a.id === appointmentId);
    if (apt) {
      if (titleEl) titleEl.textContent = "Update Appointment";
      idInput.value = apt.id;
      document.getElementById("aptPatientNameInput").value = apt.patientName;
      document.getElementById("aptPatientPhoneInput").value = apt.patientPhone || "";
      if (patientSelect) patientSelect.value = apt.patientId || "";
      document.getElementById("aptDoctorInput").value = apt.doctorName;
      document.getElementById("aptDeptInput").value = apt.department;
      document.getElementById("aptDateInput").value = apt.date;
      document.getElementById("aptTimeInput").value = apt.time;
      document.getElementById("aptTypeInput").value = apt.type || "In-Person";
      document.getElementById("aptStatusInput").value = apt.status;
      document.getElementById("aptReasonInput").value = apt.reason || "";
    }
  } else {
    if (titleEl) titleEl.textContent = "Book New Appointment";
    idInput.value = "";
    document.getElementById("aptDateInput").value = new Date().toISOString().split("T")[0];
    document.getElementById("aptTimeInput").value = "10:00 AM";
    document.getElementById("aptStatusInput").value = canManage ? "Confirmed" : "Pending";
  }

  const modalEl = document.getElementById("appointmentModal");
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
}

function openBookAppointmentForDoctor(doctorName, department) {
  openAppointmentModal();
  setTimeout(() => {
    const docSelect = document.getElementById("aptDoctorInput");
    const deptSelect = document.getElementById("aptDeptInput");
    if (docSelect) docSelect.value = doctorName;
    if (deptSelect) deptSelect.value = department;
  }, 100);
}

function onAptPatientSelected(selectEl) {
  const selected = selectEl.options[selectEl.selectedIndex];
  if (selected.value) {
    document.getElementById("aptPatientNameInput").value = selected.dataset.name || "";
    document.getElementById("aptPatientPhoneInput").value = selected.dataset.phone || "";
  }
}

function onAptDoctorSelected(selectEl) {
  const selected = selectEl.options[selectEl.selectedIndex];
  const dept = selected.dataset.dept;
  if (dept) {
    document.getElementById("aptDeptInput").value = dept;
  }
}

async function saveAppointmentForm(e) {
  e.preventDefault();
  const form = document.getElementById("appointmentForm");
  if (!form.checkValidity()) {
    form.classList.add("was-validated");
    return;
  }

  const id = document.getElementById("appointmentIdHidden").value;
  const patientName = document.getElementById("aptPatientNameInput").value.trim();
  const patientPhone = document.getElementById("aptPatientPhoneInput").value.trim();
  const doctorName = document.getElementById("aptDoctorInput").value;
  const department = document.getElementById("aptDeptInput").value;
  const date = document.getElementById("aptDateInput").value;
  const time = document.getElementById("aptTimeInput").value;
  const type = document.getElementById("aptTypeInput").value;
  const status = document.getElementById("aptStatusInput").value;
  const reason = document.getElementById("aptReasonInput").value.trim();
  const patientId = document.getElementById("aptPatientSelect")?.value || "";

  const canManage = ["ADMIN", "RECEPTIONIST"].includes(authState.user?.role);
  const appointment = {
    patientId: patientId || null,
    patientName, patientPhone, doctorName, department, date, time, type,
    status: canManage ? status : "Pending",
    reason
  };
  try {
    const saved = id
      ? await apiRequest(`/api/appointments/${encodeURIComponent(id)}`, { method: "PUT", body: appointment })
      : await apiRequest("/api/appointments", { method: "POST", body: appointment });
    const modal = bootstrap.Modal.getInstance(document.getElementById("appointmentModal"));
    if (modal) modal.hide();

    if (!authState.token) {
      showToast(`Appointment request ${saved.id} submitted for ${saved.patientName}. It is pending hospital confirmation.`, "success");
      return;
    }

    showToast(id
      ? `Appointment ${saved.id} updated.`
      : `Appointment request ${saved.id} created.`);
    try {
      await loadStaffData();
      refreshAllViews();
    } catch (refreshError) {
      showToast(`Appointment saved, but the latest data could not be loaded: ${refreshError.message}`, "warning");
    }
  } catch (error) {
    showToast(`Unable to save appointment: ${error.message}`, "error");
  }
}

async function quickUpdateAppointmentStatus(aptId, newStatus) {
  try {
    await apiRequest(`/api/appointments/${encodeURIComponent(aptId)}/status`, {
      method: "PATCH",
      body: { status: newStatus }
    });
    showToast(`Appointment ${aptId} status set to ${newStatus}.`, newStatus === "Cancelled" ? "warning" : "success");
    await loadStaffData();
    refreshAllViews();
  } catch (error) {
    showToast(`Unable to update appointment status: ${error.message}`, "error");
  }
}

// ==========================================================================
// 10. Billing Management & Printable Invoice Modal
// ==========================================================================
function renderBillingTable() {
  const invoices = DB.get("invoices", []);
  const tbody = document.getElementById("billing-table-body");
  if (!tbody) return;

  const searchInput = document.getElementById("billingSearchInput");
  const filterStatus = document.getElementById("billingFilterStatus");

  const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
  const status = filterStatus ? filterStatus.value : "";

  const filtered = invoices.filter(inv => {
    const matchQuery = !query ||
      inv.id.toLowerCase().includes(query) ||
      inv.patientName.toLowerCase().includes(query) ||
      inv.department.toLowerCase().includes(query);

    const matchStatus = !status || inv.status === status;

    return matchQuery && matchStatus;
  });

  tbody.innerHTML = "";

  // Update billing summary cards
  const totalBilled = invoices.reduce((s, i) => s + Number(i.amount), 0);
  const totalPaid = invoices.filter(i => i.status === "Paid").reduce((s, i) => s + Number(i.amount), 0);
  const totalOutstanding = invoices.filter(i => i.status !== "Paid").reduce((s, i) => s + Number(i.amount), 0);

  const bBilled = document.getElementById("billing-total-billed");
  const bPaid = document.getElementById("billing-total-paid");
  const bOut = document.getElementById("billing-total-outstanding");

  if (bBilled) bBilled.textContent = `$${totalBilled.toLocaleString()}`;
  if (bPaid) bPaid.textContent = `$${totalPaid.toLocaleString()}`;
  if (bOut) bOut.textContent = `$${totalOutstanding.toLocaleString()}`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-muted">
      <i class="bi bi-receipt display-6 d-block mb-2 text-secondary"></i>
      No invoice records found.
    </td></tr>`;
    return;
  }

  filtered.forEach(inv => {
    const statusClass = getStatusClass(inv.status);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="fw-bold">${escapeHtml(inv.id)}</span></td>
      <td>
        <div class="fw-bold">${escapeHtml(inv.patientName)}</div>
        <div class="small text-muted">${escapeHtml(inv.department)}</div>
      </td>
      <td>${escapeHtml(inv.date)}</td>
      <td class="fw-bold text-dark">$${Number(inv.amount).toLocaleString()}.00</td>
      <td>
        <span class="small text-secondary"><i class="bi bi-credit-card me-1"></i> ${escapeHtml(inv.method || "Direct Payment")}</span>
      </td>
      <td>
        <span class="status-badge ${statusClass}">${escapeHtml(inv.status)}</span>
      </td>
      <td>
        <div class="d-flex gap-1">
          <button class="btn btn-sm btn-medicare-secondary py-1 px-3" onclick="viewInvoiceModal(${escapeHtml(JSON.stringify(inv.id))})">
            <i class="bi bi-file-earmark-text me-1"></i> View Invoice
          </button>
          ${inv.status !== 'Paid' ? `
            <button class="btn btn-sm btn-outline-success py-1 px-2" title="Record the payment status; no payment is processed" onclick="markInvoicePaid(${escapeHtml(JSON.stringify(inv.id))})">
              <i class="bi bi-check-lg"></i>
            </button>
          ` : ''}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function viewInvoiceModal(invoiceId) {
  const invoices = DB.get("invoices", []);
  const inv = invoices.find(i => i.id === invoiceId);
  if (!inv) return;

  const content = document.getElementById("invoiceModalContent");
  if (!content) return;

  const itemsHtml = (inv.items || [
    { desc: "General Medical Examination & Clinical Assessment", cost: inv.amount }
  ]).map(item => `
    <tr>
      <td class="py-2">${escapeHtml(item.desc)}</td>
      <td class="text-end py-2">$${Number(item.cost).toFixed(2)}</td>
    </tr>
  `).join("");

  const statusClass = getStatusClass(inv.status);

  content.innerHTML = `
    <div class="invoice-container">
      <div class="invoice-header-bar">
        <div>
          <div class="d-flex align-items-center gap-2 mb-2">
            <div class="brand-icon-box" style="width: 36px; height: 36px; font-size: 1.1rem;">
              <i class="bi bi-hospital"></i>
            </div>
            <h4 class="fw-bold mb-0">MediCare <span style="color: var(--brand-primary); font-size: 0.9rem;">HOSPITAL</span></h4>
          </div>
          <p class="small text-muted mb-0">100 Healthcare Boulevard, Metro City, NY 10001</p>
          <p class="small text-muted mb-0">Emergency Hotline: +1 (800) 555-CARE</p>
        </div>
        <div class="text-end">
          <h5 class="fw-bold text-primary mb-1">INVOICE</h5>
          <div class="fw-bold">${escapeHtml(inv.id)}</div>
          <div class="small text-muted">Date: ${escapeHtml(inv.date)}</div>
          <span class="status-badge ${statusClass} mt-2">${escapeHtml(inv.status)}</span>
        </div>
      </div>

      <div class="row g-3 mb-4">
        <div class="col-6">
          <div class="small text-muted text-uppercase fw-bold">Billed To</div>
          <div class="fw-bold fs-6">${escapeHtml(inv.patientName)}</div>
          <div class="small text-muted">Department: ${escapeHtml(inv.department)}</div>
          <div class="small text-muted">Payment: ${escapeHtml(inv.method || "Direct")}</div>
        </div>
        <div class="col-6 text-end">
          <div class="small text-muted text-uppercase fw-bold">Hospital Tax ID</div>
          <div class="fw-semibold small">MED-TAX-9844201</div>
          <div class="small text-muted">Accredited by Joint Commission</div>
        </div>
      </div>

      <table class="table table-bordered mb-4">
        <thead class="bg-light">
          <tr>
            <th class="small">Service Description</th>
            <th class="small text-end" style="width: 140px;">Amount ($)</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
          <tr>
            <td class="text-end fw-bold pt-3">Subtotal:</td>
            <td class="text-end fw-bold pt-3">$${Number(inv.amount).toFixed(2)}</td>
          </tr>
          <tr>
            <td class="text-end text-muted small">Applicable Taxes (0% Medical):</td>
            <td class="text-end text-muted small">$0.00</td>
          </tr>
          <tr class="table-active">
            <td class="text-end fw-bold fs-6">Grand Total:</td>
            <td class="text-end fw-bold fs-6 text-primary">$${Number(inv.amount).toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <div class="d-flex justify-content-between align-items-center pt-3 border-top">
        <div class="small text-muted">
          Thank you for trusting MediCare Healthcare Systems.
        </div>
        <button class="btn btn-sm btn-outline-secondary" onclick="window.print()">
          <i class="bi bi-printer me-1"></i> Print Invoice
        </button>
      </div>
    </div>
  `;

  const modalEl = document.getElementById("invoiceModal");
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
}

async function markInvoicePaid(invoiceId) {
  try {
    await apiRequest(`/api/billing/${encodeURIComponent(invoiceId)}/pay`, { method: "PATCH" });
    showToast(`Invoice ${invoiceId} was marked Paid in the record. No payment was processed.`);
    await loadStaffData();
    refreshAllViews();
  } catch (error) {
    showToast(`Unable to update invoice payment: ${error.message}`, "error");
  }
}

function openInvoiceModal() {
  const form = document.getElementById("invoiceCreateForm");
  if (!form) return;
  form.reset();
  const patientSelect = document.getElementById("invoicePatientInput");
  const departmentSelect = document.getElementById("invoiceDepartmentInput");
  patientSelect.innerHTML = DB.get("patients", [])
    .map(patient => `<option value="${escapeHtml(patient.id)}">${escapeHtml(patient.name)} (${escapeHtml(patient.id)})</option>`)
    .join("");
  departmentSelect.innerHTML = DB.get("departments", [])
    .map(department => `<option value="${escapeHtml(department.name)}">${escapeHtml(department.name)}</option>`)
    .join("");
  if (patientSelect.options.length === 0 || departmentSelect.options.length === 0) {
    showToast("A patient and department are required before creating an invoice.", "warning");
    return;
  }
  bootstrap.Modal.getOrCreateInstance(document.getElementById("invoiceCreateModal")).show();
}

async function createInvoice(event) {
  event.preventDefault();
  const form = document.getElementById("invoiceCreateForm");
  const descriptionInput = document.getElementById("invoiceDescriptionInput");
  descriptionInput.value = descriptionInput.value.trim();
  if (!form.checkValidity()) {
    form.classList.add("was-validated");
    return;
  }
  const amount = Number(document.getElementById("invoiceAmountInput").value);
  const selectedPatient = DB.get("patients", []).find(patient =>
    patient.id === document.getElementById("invoicePatientInput").value);
  if (!selectedPatient) {
    showToast("Select a valid patient record before creating an invoice.", "error");
    return;
  }
  const invoice = {
    patientId: selectedPatient.id,
    patientName: selectedPatient.name,
    department: document.getElementById("invoiceDepartmentInput").value,
    date: new Date().toISOString().slice(0, 10),
    amount,
    method: document.getElementById("invoiceMethodInput").value,
    items: [{ desc: descriptionInput.value, cost: amount }]
  };
  try {
    const saved = await apiRequest("/api/billing", { method: "POST", body: invoice });
    bootstrap.Modal.getInstance(document.getElementById("invoiceCreateModal"))?.hide();
    showToast(`Invoice ${saved.id} created.`);
    await loadStaffData();
    refreshAllViews();
  } catch (error) {
    showToast(`Unable to create invoice: ${error.message}`, "error");
  }
}

// ==========================================================================
// 11. Public Homepage Dynamic Populate & Actions
// ==========================================================================
function renderPublicFeaturedDoctors() {
  const doctors = DB.get("doctors", []);
  const container = document.getElementById("public-featured-doctors-grid");
  if (!container) return;

  container.innerHTML = "";
  // Show first 4
  const featured = doctors.slice(0, 4);
  if (featured.length === 0) {
    container.innerHTML = `<div class="col-12 text-center text-muted py-4">Doctor profiles are currently unavailable.</div>`;
    return;
  }

  featured.forEach(doc => {
    const col = document.createElement("div");
    col.className = "col-lg-3 col-md-6";
    col.innerHTML = `
      <div class="doctor-card">
        <div class="doctor-img-wrap">
          <img src="${escapeHtml(safeHttpUrl(doc.image) || DOCTOR_PLACEHOLDER_IMAGE)}" alt="${escapeHtml(doc.name)}" loading="lazy">
          <span class="doctor-dept-pill">${escapeHtml(doc.department)}</span>
        </div>
        <div class="doctor-body">
          <div>
            <div class="d-flex justify-content-between align-items-start mb-1">
              <h5 class="doctor-name mb-0">${escapeHtml(doc.name)}</h5>
            </div>
            <div class="doctor-sub">${escapeHtml(doc.degree)}</div>
            <div class="doctor-rating mb-3">
              <i class="bi bi-star-fill"></i> ${Number(doc.rating || 0)} <span class="text-muted fw-normal">(${Number(doc.reviews || 0)} reviews)</span>
            </div>
          </div>
          <button class="btn btn-medicare-secondary w-100 btn-sm" onclick="openBookAppointmentForDoctor(${escapeHtml(JSON.stringify(doc.name))}, ${escapeHtml(JSON.stringify(doc.department))})">
            <i class="bi bi-calendar-event me-1"></i> Consult Specialist
          </button>
        </div>
      </div>
    `;
    col.querySelector("img").addEventListener("error", event => {
      const image = event.currentTarget;
      if (image.getAttribute("src") !== DOCTOR_PLACEHOLDER_IMAGE) {
        image.src = DOCTOR_PLACEHOLDER_IMAGE;
      }
    }, { once: true });
    container.appendChild(col);
  });
}

async function handlePublicContactSubmit(e) {
  e.preventDefault();
  const form = e.target;
  if (!form.checkValidity()) {
    form.classList.add("was-validated");
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = true;
  const formData = new FormData(form);
  try {
    await apiRequest("/api/contact", {
      method: "POST",
      authenticated: false,
      body: Object.fromEntries(formData.entries())
    });
    form.reset();
    form.classList.remove("was-validated");
    showToast("Your inquiry was accepted by the email service.", "success");
  } catch (error) {
    showToast(`Your inquiry could not be sent. ${error.message}`, "error");
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

function handleSaveSettings(e) {
  e.preventDefault();
  const reduceMotion = document.getElementById("reduceMotionInput").checked;
  try {
    window.localStorage.setItem(LOCAL_SETTINGS_KEY, String(reduceMotion));
    document.documentElement.classList.toggle("reduce-motion", reduceMotion);
    showToast("Display preference saved in this browser.", "success");
  } catch (error) {
    console.error("Unable to save the browser display preference.", error);
    showToast("Unable to save this preference. Check browser storage permissions.", "error");
  }
}

function loadLocalSettings() {
  const input = document.getElementById("reduceMotionInput");
  if (!input) return;
  try {
    const reduceMotion = window.localStorage.getItem(LOCAL_SETTINGS_KEY) === "true";
    input.checked = reduceMotion;
    document.documentElement.classList.toggle("reduce-motion", reduceMotion);
  } catch (error) {
    console.error("Unable to load the browser display preference.", error);
    showToast("Browser display preferences could not be loaded.", "warning");
  }
}

// ==========================================================================
// 12. Global Search Handler
// ==========================================================================
function handleGlobalSearch(query) {
  if (!query || query.trim() === "") return;
  query = query.toLowerCase().trim();

  // Search across doctors, patients, appointments
  const patients = DB.get("patients", []);
  const doctors = DB.get("doctors", []);

  const patientMatch = patients.find(p => p.name.toLowerCase().includes(query) || p.id.toLowerCase().includes(query));
  const doctorMatch = doctors.find(d => d.name.toLowerCase().includes(query) || d.department.toLowerCase().includes(query));

  if (patientMatch) {
    switchAdminTab("patients");
    const input = document.getElementById("patientSearchInput");
    if (input) {
      input.value = query;
      renderPatientsTable();
    }
  } else if (doctorMatch) {
    switchAdminTab("doctors");
    const input = document.getElementById("doctorSearchInput");
    if (input) {
      input.value = query;
      renderDoctorsGrid();
    }
  } else {
    switchAdminTab("appointments");
    const input = document.getElementById("appointmentSearchInput");
    if (input) {
      input.value = query;
      renderAppointmentsTable();
    }
  }
}

// Refresh all UI views
function refreshAllViews() {
  updateDashboardStats();
  renderRecentAppointmentsTable();
  renderActivityFeed();
  renderPatientsTable();
  renderDoctorsGrid();
  renderAppointmentsTable();
  renderBillingTable();
  renderPublicFeaturedDoctors();
  renderDepartments();
  if (authState.user?.role === "ADMIN") renderStaffAccounts();
  setTimeout(renderDashboardCharts, 100);
}

// ==========================================================================
// 13. DOM Ready Initialization & Event Wiring
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  loadLocalSettings();
  // Initial renders
  refreshAllViews();
  loadPublicCatalog().catch(error => {
    showToast(`Public hospital information could not be loaded: ${error.message}`, "error");
  });
  const paymentResult = new URLSearchParams(window.location.search).get("payment");
  if (paymentResult === "success") {
    showToast("Checkout completed. The invoice changes only after verified payment confirmation arrives.", "info");
  } else if (paymentResult === "cancelled") {
    showToast("Checkout was cancelled. No payment was confirmed.", "warning");
  }
  toggleDoctorAccountLink();

  // Resize listener to re-draw canvas charts sharply
  window.addEventListener("resize", () => {
    if (currentPortalTab === "dashboard") {
      renderDashboardCharts();
    } else if (currentPortalTab === "reports") {
      renderReportsCharts();
    }
  });

  // Global search input enter listener
  const topSearch = document.getElementById("globalSearchInput");
  if (topSearch) {
    topSearch.addEventListener("keyup", (e) => {
      if (e.key === "Enter") {
        handleGlobalSearch(e.target.value);
      }
    });
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId.startsWith("#section-")) {
        e.preventDefault();
        const target = document.querySelector(targetId);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });
});

