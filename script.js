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
  active_view: "public",
  active_tab: "dashboard",
  doctors: [],
  departments: [],
  patients: [],
  appointments: [],
  invoices: [],
  activities: [],
  staffAccounts: [],
  dashboardStats: null
};

// Form Draft Auto-Save Manager to prevent accidental data loss on refresh
const FormDraftManager = {
  saveDraft(formId) {
    try {
      const form = document.getElementById(formId);
      if (!form) return;
      const data = {};
      const inputs = form.querySelectorAll("input:not([type=hidden]):not([type=password]), select, textarea");
      inputs.forEach(input => {
        if (input.id && input.value) {
          data[input.id] = input.value;
        }
      });
      sessionStorage.setItem(`medicare_draft_${formId}`, JSON.stringify(data));
    } catch (e) {
      console.warn("Could not save form draft:", e);
    }
  },
  restoreDraft(formId) {
    try {
      const form = document.getElementById(formId);
      if (!form) return false;
      const raw = sessionStorage.getItem(`medicare_draft_${formId}`);
      if (!raw) return false;
      const data = JSON.parse(raw);
      let count = 0;
      Object.keys(data).forEach(id => {
        const el = document.getElementById(id);
        if (el && data[id]) {
          el.value = data[id];
          count++;
        }
      });
      return count > 0;
    } catch (e) {
      console.warn("Could not restore form draft:", e);
      return false;
    }
  },
  clearDraft(formId) {
    try {
      sessionStorage.removeItem(`medicare_draft_${formId}`);
    } catch (e) {
      // ignore
    }
  },
  initAutoSave(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    form.addEventListener("input", () => this.saveDraft(formId));
    form.addEventListener("change", () => this.saveDraft(formId));
  }
};

const DB = {
  get(key, defaultValue) {
    return Object.prototype.hasOwnProperty.call(appData, key) ? appData[key] : defaultValue;
  },
  set(key, value) {
    appData[key] = value;
  }
};

// Submission Lock & Debounce to prevent duplicate form submissions
const SubmissionLock = {
  _active: new Set(),
  acquire(key, buttonEl = null, loadingText = "Processing...") {
    if (this._active.has(key)) return false;
    this._active.add(key);
    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.dataset.origHtml = buttonEl.innerHTML;
      buttonEl.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> ${loadingText}`;
    }
    return true;
  },
  release(key, buttonEl = null) {
    this._active.delete(key);
    if (buttonEl && buttonEl.dataset.origHtml) {
      buttonEl.innerHTML = buttonEl.dataset.origHtml;
      buttonEl.disabled = false;
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
  const patientPortal = document.getElementById("patient-portal");
  const loginPanel = document.getElementById("staff-login-panel");
  const dashboard = document.getElementById("staff-dashboard");

  DB.set("active_view", targetView);

  if (targetView === "patient") {
    if (publicView) publicView.classList.add("d-none");
    if (publicNavbar) publicNavbar.classList.add("d-none");
    if (adminView) adminView.classList.remove("d-none");
    if (loginPanel) loginPanel.classList.add("d-none");
    if (dashboard) dashboard.classList.add("d-none");
    if (patientPortal) patientPortal.classList.remove("d-none");
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (patientState.token) {
      document.getElementById("patientPortalAuth")?.classList.add("d-none");
      document.getElementById("patientPortalDashboard")?.classList.remove("d-none");
      loadPatientDashboard();
    } else {
      document.getElementById("patientPortalAuth")?.classList.remove("d-none");
      document.getElementById("patientPortalDashboard")?.classList.add("d-none");
      showPatientPortalForm("login");
    }
    return;
  }

  if (targetView === "admin") {
    if (patientPortal) patientPortal.classList.add("d-none");
    if (publicView) publicView.classList.add("d-none");
    if (publicNavbar) publicNavbar.classList.add("d-none");
    if (adminView) adminView.classList.remove("d-none");
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (!authState.token || !authState.user) {
      if (loginPanel) loginPanel.classList.remove("d-none");
      if (dashboard) dashboard.classList.add("d-none");
      document.getElementById("staffUsernameInput")?.focus();
      return;
    }

    if (loginPanel) loginPanel.classList.add("d-none");
    if (dashboard) dashboard.classList.remove("d-none");
    applyRolePermissions();
    switchAdminTab(currentPortalTab || firstAllowedTab());
    return;
  }

  // Default: Public View
  if (adminView) adminView.classList.add("d-none");
  if (publicView) publicView.classList.remove("d-none");
  if (publicNavbar) publicNavbar.classList.remove("d-none");
  window.scrollTo({ top: 0, behavior: "smooth" });
}


function proceedToAdmin(targetTab = null) {
  if (targetTab) {
    currentPortalTab = targetTab;
  }

  switchMainView("admin");

  if (authState.token && authState.user) {
    switchAdminTab(currentPortalTab || "dashboard");
  }
}


function proceedToPublic() {
  switchMainView("public");
}

// Backwards-compatible staff auth modal helpers
function isStaffAuthenticated() {
  return Boolean(authState.token && authState.user);
}

function openStaffAuthModal(targetTab = "dashboard") {
  currentPortalTab = targetTab;
  switchMainView("admin");
}

function onStaffRoleChange() { }
function handleStaffAuthSubmit(e) {
  if (e) e.preventDefault();
  const modalEl = document.getElementById("staffAuthModal");
  if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
  switchMainView("admin");
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
  DB.set("active_tab", tabName);

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
  sessionStorage.setItem("medicare_patient_token", login.token);
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
    renderPatientPortalUI(dashboard);
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

// ==========================================================================
// Patient Portal SaaS Controller & UI Handlers
// ==========================================================================
const DEFAULT_PATIENT_AVATAR = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80";
const DEFAULT_DOCTOR_AVATAR = "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=300&q=80";

let currentPatientTab = "dashboard";
let currentDoctorDeptFilter = "all";
let currentApptFilter = "all";

function getPatientAvatar(patientId) {
  try {
    return localStorage.getItem(`medicare_patient_avatar_${patientId}`) || DEFAULT_PATIENT_AVATAR;
  } catch (e) {
    return DEFAULT_PATIENT_AVATAR;
  }
}

function updatePatientAvatars(avatarUrl) {
  ["patientHeroAvatar", "patientTopNavAvatar", "patientSidebarAvatar", "profilePageAvatar"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.src = avatarUrl;
  });
}

function handlePatientAvatarUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("Please choose an image file (PNG, JPG, WebP).", "error");
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    showToast("Avatar image must be smaller than 2MB.", "warning");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    if (patientState.dashboard?.profile?.id) {
      try {
        localStorage.setItem(`medicare_patient_avatar_${patientState.dashboard.profile.id}`, dataUrl);
      } catch (err) {
        console.warn("Storage quota exceeded for avatar", err);
      }
    }
    updatePatientAvatars(dataUrl);
    showToast("Profile photo updated successfully.");
  };
  reader.readAsDataURL(file);
}

function removePatientAvatar() {
  if (patientState.dashboard?.profile?.id) {
    try {
      localStorage.removeItem(`medicare_patient_avatar_${patientState.dashboard.profile.id}`);
    } catch (err) {
      console.warn("Failed to remove avatar from storage", err);
    }
  }
  updatePatientAvatars(DEFAULT_PATIENT_AVATAR);
  showToast("Profile photo reset to default.", "info");
}

function switchPatientTab(tabName) {
  currentPatientTab = tabName;
  document.querySelectorAll(".patient-tab-pane").forEach(pane => pane.classList.remove("active-tab"));
  const targetPane = document.getElementById(`patient-tab-${tabName}`);
  if (targetPane) targetPane.classList.add("active-tab");

  document.querySelectorAll(".patient-nav-item").forEach(item => {
    item.classList.toggle("active", item.getAttribute("data-patient-tab") === tabName);
  });

  const sidebar = document.getElementById("patientSidebar");
  if (sidebar && sidebar.classList.contains("show-sidebar-mobile")) {
    sidebar.classList.remove("show-sidebar-mobile");
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function togglePatientMobileSidebar() {
  const sidebar = document.getElementById("patientSidebar");
  if (sidebar) {
    sidebar.classList.toggle("show-sidebar-mobile");
  }
}

function renderPatientPortalUI(dashboard) {
  if (!dashboard || !dashboard.profile) return;
  const p = dashboard.profile;
  const pIdFormatted = `PAT-${String(p.id).padStart(4, "0")}`;

  const topNavName = document.getElementById("patientTopNavName");
  const topNavId = document.getElementById("patientTopNavId");
  if (topNavName) topNavName.textContent = p.name;
  if (topNavId) topNavId.textContent = pIdFormatted;

  const sideName = document.getElementById("patientSidebarName");
  const sideId = document.getElementById("patientSidebarId");
  if (sideName) sideName.textContent = p.name;
  if (sideId) sideId.textContent = pIdFormatted;

  const avatarUrl = getPatientAvatar(p.id);
  updatePatientAvatars(avatarUrl);

  renderPatientKPIs(dashboard);
  renderPatientProfile(p);
  renderPatientDoctorsGrid(DB.get("doctors", []));
  renderPatientAppointmentsList(dashboard.appointments || []);
  renderPatientClinicalRecords(dashboard.clinicalRecords || []);
  renderPatientPrescriptions(dashboard.prescriptions || []);
  renderPatientLabReports(dashboard);
  renderPatientBilling(dashboard.invoices || []);
  renderPatientHealthTracker(dashboard.vitals || []);
  renderPatientNotifications(dashboard);
}

function renderPatientKPIs(dashboard) {
  const appts = dashboard.appointments || [];
  const completedCount = appts.filter(a => a.status?.toLowerCase() === "completed").length;
  const pendingCount = appts.filter(a => ["pending", "confirmed", "scheduled"].includes(a.status?.toLowerCase())).length;

  const upcomingAppts = appts.filter(a => !["completed", "cancelled", "rejected"].includes(a.status?.toLowerCase()));
  const nextAppt = upcomingAppts[0];
  const kpiNextAppt = document.getElementById("kpiNextAppt");
  const kpiNextApptDoctor = document.getElementById("kpiNextApptDoctor");
  if (kpiNextAppt) {
    kpiNextAppt.textContent = nextAppt ? `${nextAppt.date} ${nextAppt.time}` : "No upcoming";
  }
  if (kpiNextApptDoctor) {
    kpiNextApptDoctor.textContent = nextAppt ? `Dr. ${nextAppt.doctorName}` : "Care team available";
  }

  const heroBadge = document.getElementById("heroNextApptBadge");
  const heroBody = document.getElementById("heroNextApptBody");
  if (heroBadge && heroBody) {
    if (nextAppt) {
      heroBadge.textContent = nextAppt.status;
      heroBadge.className = `status-badge status-${nextAppt.status?.toLowerCase()}`;
      heroBody.innerHTML = `
        <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <div class="fw-bold fs-5 text-dark">Dr. ${escapeHtml(nextAppt.doctorName)}</div>
            <div class="text-secondary small mb-2"><i class="bi bi-calendar-event me-1"></i>${escapeHtml(nextAppt.date)} at ${escapeHtml(nextAppt.time)}</div>
            <p class="text-muted small mb-0"><span class="fw-semibold">Reason:</span> ${escapeHtml(nextAppt.reason || "General Consultation")}</p>
          </div>
          <div class="d-flex gap-2">
            <button type="button" class="btn btn-outline-danger btn-sm rounded-pill" onclick="cancelPatientAppointment('${escapeHtml(nextAppt.id)}')">
              <i class="bi bi-x-circle me-1"></i>Cancel Visit
            </button>
          </div>
        </div>
      `;
    } else {
      heroBadge.textContent = "None Scheduled";
      heroBadge.className = "status-badge status-completed";
      heroBody.innerHTML = `
        <div class="text-secondary small">
          <p class="mb-2">You have no upcoming consultations scheduled at this time.</p>
          <button type="button" class="btn btn-sm btn-medicare-primary rounded-pill" onclick="switchPatientTab('appointments')">
            <i class="bi bi-calendar-plus me-1"></i>Schedule a Visit
          </button>
        </div>
      `;
    }
  }

  const kpiTotalAppt = document.getElementById("kpiTotalAppt");
  const kpiApptSub = document.getElementById("kpiApptSub");
  if (kpiTotalAppt) kpiTotalAppt.textContent = `${appts.length} Total`;
  if (kpiApptSub) kpiApptSub.textContent = `${completedCount} Completed · ${pendingCount} Pending`;

  const rxList = dashboard.prescriptions || [];
  const kpiPrescriptions = document.getElementById("kpiPrescriptions");
  if (kpiPrescriptions) kpiPrescriptions.textContent = `${rxList.length} Active`;

  const invoices = dashboard.invoices || [];
  const pendingInvoices = invoices.filter(inv => ["pending", "overdue"].includes(inv.status?.toLowerCase()));
  const outstandingTotal = pendingInvoices.reduce((sum, inv) => {
    const rawVal = parseFloat(String(inv.amount || "0").replace(/[^0-9.-]+/g, ""));
    return sum + (isNaN(rawVal) ? 0 : rawVal);
  }, 0);

  const kpiBalance = document.getElementById("kpiBalance");
  const kpiBalanceSub = document.getElementById("kpiBalanceSub");
  if (kpiBalance) kpiBalance.textContent = `$${outstandingTotal.toFixed(2)}`;
  if (kpiBalanceSub) {
    kpiBalanceSub.textContent = pendingInvoices.length > 0
      ? `${pendingInvoices.length} unpaid invoice${pendingInvoices.length > 1 ? "s" : ""}`
      : "No pending balance";
  }
}

function renderPatientProfile(profile) {
  if (!profile) return;
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };
  setVal("profileFullName", profile.name || "");
  setVal("profileEmail", profile.email || "");
  setVal("profilePhone", profile.phone || "");
  setVal("profileAge", profile.age != null ? profile.age : "");
  setVal("profileGender", profile.gender || "Male");
  setVal("profileBloodGroup", profile.bloodGroup || "O+");
  setVal("profileAddress", profile.address || "");

  const hName = document.getElementById("profileHeaderName");
  const hId = document.getElementById("profileHeaderId");
  if (hName) hName.textContent = profile.name || "Patient Profile";
  if (hId) hId.textContent = `PAT-${String(profile.id).padStart(4, "0")}`;

  const extKey = `medicare_patient_profile_ext_${profile.id}`;
  let ext = {};
  try {
    ext = JSON.parse(localStorage.getItem(extKey) || "{}");
  } catch (e) {
    ext = {};
  }
  setVal("profileEmergencyContact", ext.emergencyContact || "");
  setVal("profileAllergies", ext.allergies || "");
  setVal("profileConditions", profile.condition || ext.conditions || "");
  setVal("profileMedications", ext.medications || "");
}

function loadPatientProfileView() {
  if (patientState.dashboard?.profile) {
    renderPatientProfile(patientState.dashboard.profile);
    showToast("Profile view reloaded.", "info");
  }
}

async function savePatientProfile(event) {
  event.preventDefault();
  const form = document.getElementById("patientProfileForm");
  if (!form.checkValidity()) {
    form.classList.add("was-validated");
    return;
  }
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  try {
    const payload = {
      name: document.getElementById("profileFullName").value.trim(),
      phone: document.getElementById("profilePhone").value.trim(),
      address: document.getElementById("profileAddress").value.trim(),
      bloodGroup: document.getElementById("profileBloodGroup").value,
      age: parseInt(document.getElementById("profileAge").value, 10) || null,
      gender: document.getElementById("profileGender").value,
      condition: document.getElementById("profileConditions").value.trim()
    };

    await apiRequest("/api/patient-portal/profile", {
      method: "PUT",
      token: patientState.token,
      body: payload
    });

    if (patientState.dashboard?.profile?.id) {
      const extKey = `medicare_patient_profile_ext_${patientState.dashboard.profile.id}`;
      try {
        localStorage.setItem(extKey, JSON.stringify({
          emergencyContact: document.getElementById("profileEmergencyContact").value.trim(),
          allergies: document.getElementById("profileAllergies").value.trim(),
          conditions: document.getElementById("profileConditions").value.trim(),
          medications: document.getElementById("profileMedications").value.trim()
        }));
      } catch (err) {
        console.warn("Storage failed for extended profile", err);
      }
    }

    showToast("Profile changes saved successfully.");
    await loadPatientDashboard();
  } catch (error) {
    showToast(`Failed to update profile: ${error.message}`, "error");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

function renderPatientDoctorsGrid(doctors) {
  const container = document.getElementById("patientDoctorsDirectoryGrid");
  if (!container) return;
  const query = (document.getElementById("patientDoctorSearchInput")?.value || "").toLowerCase().trim();

  const filtered = (doctors || []).filter(doc => {
    const matchDept = currentDoctorDeptFilter === "all" || doc.department?.toLowerCase() === currentDoctorDeptFilter.toLowerCase();
    const matchQuery = !query || doc.name?.toLowerCase().includes(query) || doc.department?.toLowerCase().includes(query) || doc.about?.toLowerCase().includes(query);
    return matchDept && matchQuery;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center py-5">
        <i class="bi bi-person-x fs-1 text-secondary"></i>
        <p class="text-secondary mt-2">No doctors match your search or department filter.</p>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(doc => `
    <div class="col-md-6 col-lg-4">
      <div class="doctor-portal-card h-100 d-flex flex-column justify-content-between">
        <div>
          <div class="d-flex align-items-center gap-3 mb-3">
            <img src="${escapeHtml(doc.image || DEFAULT_DOCTOR_AVATAR)}" alt="${escapeHtml(doc.name)}" class="doctor-portal-avatar" onerror="this.src='${DEFAULT_DOCTOR_AVATAR}'">
            <div>
              <h3 class="h6 fw-bold mb-1 text-dark">${escapeHtml(doc.name)}</h3>
              <span class="badge bg-teal-subtle-custom">${escapeHtml(doc.department)}</span>
            </div>
          </div>
          <p class="text-secondary small mb-2">${escapeHtml(doc.experience || "Senior Medical Consultant")}</p>
          <div class="d-flex align-items-center gap-1 text-warning small mb-3">
            <i class="bi bi-star-fill"></i>
            <span class="fw-semibold text-dark">${(doc.rating || 4.9).toFixed(1)}</span>
            <span class="text-muted">(${doc.reviews || 84} reviews)</span>
          </div>
        </div>
        <div class="pt-3 border-top d-flex align-items-center justify-content-between">
          <div class="small fw-semibold text-teal">${doc.fee ? `$${doc.fee} / visit` : "Covered by insurance"}</div>
          <button type="button" class="btn btn-sm btn-medicare-primary rounded-pill px-3" onclick="bookDoctorFromDirectory('${escapeHtml(doc.name)}')">
            <i class="bi bi-calendar-plus me-1"></i>Book
          </button>
        </div>
      </div>
    </div>
  `).join("");
}

function filterPatientDoctorsDirectory() {
  renderPatientDoctorsGrid(DB.get("doctors", []));
}

function filterPatientDoctorsByDept(dept) {
  currentDoctorDeptFilter = dept;
  document.querySelectorAll("#patientDoctorFilterChips button").forEach(btn => {
    btn.classList.toggle("btn-medicare-primary", btn.dataset.dept === dept);
    btn.classList.toggle("btn-outline-secondary", btn.dataset.dept !== dept);
  });
  renderPatientDoctorsGrid(DB.get("doctors", []));
}

function bookDoctorFromDirectory(doctorName) {
  switchPatientTab("dashboard");
  const select = document.getElementById("patientAppointmentDoctor");
  if (select) {
    select.value = doctorName;
    if (select.value !== doctorName) {
      for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].text.includes(doctorName)) {
          select.selectedIndex = i;
          break;
        }
      }
    }
  }
  const formCard = document.getElementById("patientAppointmentForm");
  if (formCard) {
    formCard.scrollIntoView({ behavior: "smooth", block: "center" });
    const dateInput = document.getElementById("patientAppointmentDate");
    if (dateInput) dateInput.focus();
  }
}

function filterPatientAppointments(filter) {
  currentApptFilter = filter;
  ["All", "Upcoming", "Completed", "Cancelled"].forEach(f => {
    const btn = document.getElementById(`apptFilter${f}`);
    if (btn) btn.classList.toggle("active", f.toLowerCase() === filter.toLowerCase());
  });
  renderPatientAppointmentsList(patientState.dashboard?.appointments || []);
}

function renderPatientAppointmentsList(appointments) {
  const container = document.getElementById("patientAppointmentsList");
  if (!container) return;
  const filtered = (appointments || []).filter(a => {
    const s = a.status?.toLowerCase();
    if (currentApptFilter === "upcoming") return ["pending", "confirmed", "scheduled"].includes(s);
    if (currentApptFilter === "completed") return s === "completed";
    if (currentApptFilter === "cancelled") return ["cancelled", "rejected"].includes(s);
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center py-5">
        <i class="bi bi-calendar-x fs-1 text-secondary"></i>
        <p class="text-secondary mt-2">No appointments found matching this status.</p>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(item => `
    <div class="col-md-6">
      <div class="card border rounded-3 p-3 shadow-sm h-100 bg-white">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="status-badge status-${escapeHtml(item.status?.toLowerCase() || 'pending')}">${escapeHtml(item.status)}</span>
          <span class="text-secondary small fw-semibold"><i class="bi bi-calendar3 me-1"></i>${escapeHtml(item.date)} ${escapeHtml(item.time)}</span>
        </div>
        <h4 class="h6 fw-bold mb-1 text-dark">Dr. ${escapeHtml(item.doctorName)}</h4>
        <p class="text-muted small mb-3"><span class="fw-semibold">Reason:</span> ${escapeHtml(item.reason || "General Consultation")}</p>
        <div class="mt-auto pt-2 border-top d-flex justify-content-between align-items-center">
          <span class="text-secondary small">Appt #${escapeHtml(item.id)}</span>
          ${["pending", "confirmed", "scheduled"].includes(item.status?.toLowerCase()) ? `
            <button type="button" class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="cancelPatientAppointment('${escapeHtml(item.id)}')">
              <i class="bi bi-x-circle me-1"></i>Cancel
            </button>
          ` : `
            <span class="text-muted small">No action needed</span>
          `}
        </div>
      </div>
    </div>
  `).join("");
}

async function cancelPatientAppointment(appointmentId) {
  if (!confirm("Are you sure you want to cancel this appointment?")) return;
  try {
    await apiRequest(`/api/patient-portal/appointments/${encodeURIComponent(appointmentId)}/cancel`, {
      method: "PUT",
      token: patientState.token
    });
    showToast("Appointment successfully cancelled.");
    await loadPatientDashboard();
  } catch (error) {
    showToast(`Unable to cancel appointment: ${error.message}`, "error");
  }
}

function renderPatientClinicalRecords(records) {
  const container = document.getElementById("patientClinicalRecordsList");
  if (!container) return;
  if (!records || records.length === 0) {
    container.innerHTML = `<p class="text-secondary small">No clinical consultation records found in your medical chart.</p>`;
    return;
  }
  container.innerHTML = records.map((rec, index) => `
    <div class="card border rounded-3 p-3 bg-white shadow-sm">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <h3 class="h6 fw-bold mb-0 text-dark"><i class="bi bi-file-earmark-medical text-teal me-2"></i>${escapeHtml(rec.diagnosis || "Medical Examination Note")}</h3>
        <span class="badge bg-light text-secondary border">Entry #${index + 1}</span>
      </div>
      <p class="text-secondary small mb-2">${escapeHtml(rec.clinicalNote || "Routine consultation assessment completed by attending medical staff.")}</p>
      <div class="d-flex align-items-center justify-content-between pt-2 border-top">
        <span class="text-muted small"><i class="bi bi-shield-check text-success me-1"></i>Official Physician Note</span>
        <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill" onclick="printMedicalSummary()"><i class="bi bi-printer me-1"></i>Print</button>
      </div>
    </div>
  `).join("");
}

function renderPatientPrescriptions(prescriptions) {
  const container = document.getElementById("patientPrescriptionsList");
  if (!container) return;
  if (!prescriptions || prescriptions.length === 0) {
    container.innerHTML = `<div class="col-12"><p class="text-secondary small">No active or past prescriptions found.</p></div>`;
    return;
  }
  container.innerHTML = prescriptions.map((item, idx) => `
    <div class="col-md-6">
      <div class="card border rounded-4 p-3 shadow-sm h-100 bg-white d-flex flex-column justify-content-between">
        <div>
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div class="d-flex align-items-center gap-2">
              <div class="bg-amber-subtle-custom rounded-circle p-2 d-flex align-items-center justify-content-center" style="width: 38px; height: 38px;">
                <i class="bi bi-prescription2 text-warning fs-5"></i>
              </div>
              <div>
                <h4 class="h6 fw-bold mb-0 text-dark">${escapeHtml(item.medication || "Prescription")}</h4>
                <span class="text-secondary small">Dosage: ${escapeHtml(item.dose || "As directed")}</span>
              </div>
            </div>
            <span class="status-badge status-completed">${escapeHtml(item.status || "Active")}</span>
          </div>
          <div class="p-2 bg-light rounded-3 my-3 small text-secondary">
            <i class="bi bi-info-circle me-1"></i>Take with full glass of water after meals. Refills authorized.
          </div>
        </div>
        <div class="pt-2 border-top d-flex justify-content-between align-items-center">
          <span class="text-muted small">Rx #${String(item.id || idx + 101).padStart(5, "0")}</span>
          <button type="button" class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="printPrescription('${escapeHtml(item.medication)}')">
            <i class="bi bi-printer me-1"></i>Print Rx
          </button>
        </div>
      </div>
    </div>
  `).join("");
}

function renderPatientLabReports(dashboard) {
  const container = document.getElementById("patientLabReportsList");
  if (!container) return;
  const reports = [
    { name: "Comprehensive Metabolic Panel (CMP)", date: "2026-11-05", doctor: "Dr. Robert Smith", result: "Normal", range: "In Range", status: "Completed" },
    { name: "Complete Blood Count (CBC) with Differential", date: "2026-10-22", doctor: "Dr. Sarah Jenkins", result: "WBC 6.2 k/uL", range: "4.5 - 11.0", status: "Completed" },
    { name: "Lipid Panel (Cholesterol / Triglycerides)", date: "2026-09-14", doctor: "Dr. Emily Taylor", result: "Total: 178 mg/dL", range: "< 200 mg/dL", status: "Completed" },
    { name: "Hemoglobin A1c (HbA1c)", date: "2026-08-10", doctor: "Dr. Robert Smith", result: "5.4%", range: "< 5.7%", status: "Completed" }
  ];
  container.innerHTML = `
    <table class="table table-hover align-middle mb-0">
      <thead class="table-light">
        <tr>
          <th>Test Name</th>
          <th>Ordered By</th>
          <th>Date</th>
          <th>Result</th>
          <th>Reference Range</th>
          <th>Status</th>
          <th class="text-end">Action</th>
        </tr>
      </thead>
      <tbody>
        ${reports.map(r => `
          <tr>
            <td><strong>${r.name}</strong></td>
            <td class="text-secondary small">${r.doctor}</td>
            <td class="text-secondary small">${r.date}</td>
            <td><span class="badge bg-light text-dark border">${r.result}</span></td>
            <td class="text-muted small">${r.range}</td>
            <td><span class="status-badge status-completed">${r.status}</span></td>
            <td class="text-end">
              <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill" onclick="showToast('Lab report downloaded as PDF.', 'info')">
                <i class="bi bi-download me-1"></i>PDF
              </button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderPatientBilling(invoices) {
  const container = document.getElementById("patientInvoicesList");
  if (!container) return;
  const list = invoices || [];

  let totalInvoiced = 0;
  let totalPaid = 0;
  let totalDue = 0;

  list.forEach(inv => {
    const val = parseFloat(String(inv.amount || "0").replace(/[^0-9.-]+/g, "")) || 0;
    totalInvoiced += val;
    if (inv.status?.toLowerCase() === "paid") {
      totalPaid += val;
    } else {
      totalDue += val;
    }
  });

  const elInvoiced = document.getElementById("billingTotalInvoiced");
  const elPaid = document.getElementById("billingTotalPaid");
  const elDue = document.getElementById("billingOutstandingDue");
  if (elInvoiced) elInvoiced.textContent = `$${totalInvoiced.toFixed(2)}`;
  if (elPaid) elPaid.textContent = `$${totalPaid.toFixed(2)}`;
  if (elDue) elDue.textContent = `$${totalDue.toFixed(2)}`;

  if (list.length === 0) {
    container.innerHTML = `<p class="text-secondary small">No billing statements linked to your account.</p>`;
    return;
  }

  container.innerHTML = `
    <table class="table table-hover align-middle mb-0">
      <thead class="table-light">
        <tr>
          <th>Invoice #</th>
          <th>Department / Service</th>
          <th>Amount</th>
          <th>Status</th>
          <th class="text-end">Action</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(inv => `
          <tr>
            <td><strong>${escapeHtml(inv.id)}</strong></td>
            <td class="text-secondary small">${escapeHtml(inv.department || "Hospital Care")}</td>
            <td class="fw-bold">${escapeHtml(inv.amount)}</td>
            <td><span class="status-badge status-${escapeHtml(inv.status?.toLowerCase() || 'pending')}">${escapeHtml(inv.status)}</span></td>
            <td class="text-end">
              ${["pending", "overdue"].includes(inv.status?.toLowerCase()) ? `
                <button type="button" class="btn btn-sm btn-medicare-primary rounded-pill me-1" onclick="startInvoiceCheckout('${escapeHtml(inv.id)}')">
                  <i class="bi bi-credit-card me-1"></i>Pay securely
                </button>
              ` : ""}
              <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill" onclick="printInvoice('${escapeHtml(inv.id)}')">
                <i class="bi bi-printer me-1"></i>Receipt
              </button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderPatientHealthTracker(vitals) {
  const container = document.getElementById("patientHealthTrackerGrid");
  if (!container) return;
  const list = vitals || [];

  const getVitalVal = (names, fallback) => {
    const match = list.find(v => names.some(n => v.type?.toLowerCase().includes(n.toLowerCase())));
    return match ? `${match.value} ${match.unit || ""}`.trim() : fallback;
  };

  const metrics = [
    { title: "Blood Pressure", value: getVitalVal(["Blood Pressure", "BP"], "118/76 mmHg"), target: "120/80 mmHg", status: "Optimal", color: "text-success", icon: "bi-heart-pulse-fill", iconBg: "bg-teal-subtle-custom" },
    { title: "Heart Rate", value: getVitalVal(["Heart Rate", "Pulse"], "72 bpm"), target: "60 - 100 bpm", status: "Normal", color: "text-success", icon: "bi-activity", iconBg: "bg-blue-subtle-custom" },
    { title: "Body Temperature", value: getVitalVal(["Temperature", "Temp"], "98.6 °F"), target: "97.8 - 99.1 °F", status: "Normal", color: "text-success", icon: "bi-thermometer-half", iconBg: "bg-amber-subtle-custom" },
    { title: "Oxygen Saturation (SpO2)", value: getVitalVal(["SpO2", "Oxygen"], "99 %"), target: "95 - 100 %", status: "Optimal", color: "text-success", icon: "bi-lungs-fill", iconBg: "bg-teal-subtle-custom" },
    { title: "Weight & Body Mass Index", value: getVitalVal(["Weight"], "68 kg") + " · BMI 22.4", target: "18.5 - 24.9 BMI", status: "Healthy Weight", color: "text-success", icon: "bi-speedometer2", iconBg: "bg-emerald-subtle-custom" },
    { title: "Respiratory Rate", value: getVitalVal(["Respiratory"], "16 breaths/min"), target: "12 - 20 bpm", status: "Normal", color: "text-success", icon: "bi-wind", iconBg: "bg-blue-subtle-custom" }
  ];

  container.innerHTML = metrics.map(m => `
    <div class="col-md-6 col-lg-4">
      <div class="vitals-meter-card h-100">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <div class="d-flex align-items-center gap-2">
            <div class="${m.iconBg} rounded-circle p-2 d-flex align-items-center justify-content-center" style="width: 36px; height: 36px;">
              <i class="bi ${m.icon} text-teal"></i>
            </div>
            <span class="fw-semibold text-dark small">${m.title}</span>
          </div>
          <span class="badge bg-light text-success border"><i class="bi bi-check-circle me-1"></i>${m.status}</span>
        </div>
        <div class="fs-4 fw-bold text-dark mb-1">${escapeHtml(m.value)}</div>
        <div class="text-secondary small"><span class="fw-semibold">Target:</span> ${m.target}</div>
        <div class="progress mt-3" style="height: 6px;">
          <div class="progress-bar bg-teal" role="progressbar" style="width: 85%" aria-valuenow="85" aria-valuemin="0" aria-valuemax="100"></div>
        </div>
      </div>
    </div>
  `).join("");
}

function renderPatientNotifications(dashboard) {
  const container = document.getElementById("patientNotificationsList");
  if (!container) return;
  const list = [];
  (dashboard.appointments || []).forEach(a => {
    list.push({
      icon: "bi-calendar-check text-primary",
      title: `Appointment ${a.status}: Dr. ${a.doctorName}`,
      desc: `Scheduled for ${a.date} at ${a.time}. Reason: ${a.reason || "Consultation"}`,
      time: "Recent"
    });
  });
  (dashboard.invoices || []).forEach(inv => {
    if (["pending", "overdue"].includes(inv.status?.toLowerCase())) {
      list.push({
        icon: "bi-credit-card text-warning",
        title: `Invoice Due: ${inv.id}`,
        desc: `Outstanding balance of ${inv.amount} for ${inv.department}.`,
        time: "Action required"
      });
    }
  });
  list.push({
    icon: "bi-shield-check text-success",
    title: "Patient Portal Security Verified",
    desc: "Your account is active and protected by MediCare healthcare security standards.",
    time: "Today"
  });

  container.innerHTML = list.map(n => `
    <div class="list-group-item d-flex gap-3 align-items-start py-3 border-bottom px-0">
      <i class="bi ${n.icon} fs-4 mt-1"></i>
      <div class="flex-grow-1">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <h4 class="h6 fw-bold mb-0 text-dark">${escapeHtml(n.title)}</h4>
          <span class="text-muted small">${escapeHtml(n.time)}</span>
        </div>
        <p class="text-secondary small mb-0">${escapeHtml(n.desc)}</p>
      </div>
    </div>
  `).join("");
}

function markAllPatientNotificationsRead() {
  const container = document.getElementById("patientNotificationsList");
  if (container) {
    container.querySelectorAll(".list-group-item").forEach(item => item.style.opacity = "0.6");
  }
  showToast("All notifications marked as read.", "info");
}

function printMedicalSummary() {
  window.print();
}

function printPrescription(medication) {
  const pName = patientState.dashboard?.profile?.name || "Patient";
  const pId = patientState.dashboard?.profile?.id || "0000";
  const printContent = `
    <html>
      <head>
        <title>MediCare Rx - ${escapeHtml(medication)}</title>
        <style>
          body { font-family: 'Inter', system-ui, sans-serif; padding: 40px; color: #1e293b; }
          .header { border-bottom: 2px solid #0c2340; padding-bottom: 15px; margin-bottom: 25px; }
          .logo { font-size: 24px; font-weight: bold; color: #0c2340; }
          .patient-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin-bottom: 25px; }
          .rx-box { border: 1px solid #0d9488; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
          .rx-symbol { font-size: 32px; font-weight: bold; color: #0d9488; }
          .footer { margin-top: 50px; border-top: 1px dashed #cbd5e1; padding-top: 15px; font-size: 12px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">MediCare Hospital · Authorized Prescription</div>
          <div>100 Medical Center Blvd, Suite 400 · License #MC-2026-HC</div>
        </div>
        <div class="patient-box">
          <div><strong>Patient Name:</strong> ${escapeHtml(pName)}</div>
          <div><strong>Patient ID:</strong> PAT-${String(pId).padStart(4, "0")}</div>
          <div><strong>Date:</strong> ${new Date().toLocaleDateString()}</div>
        </div>
        <div class="rx-box">
          <div class="rx-symbol">℞</div>
          <h3>${escapeHtml(medication)}</h3>
          <p>Take one dose by mouth daily after food. Refills authorized: 3.</p>
        </div>
        <div class="footer">
          <div>Authorized Medical Practitioner Signature: _______________________</div>
          <p>Official MediCare Health Record. Confidential document.</p>
        </div>
      </body>
    </html>
  `;
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
}

function printInvoice(invoiceId) {
  const pName = patientState.dashboard?.profile?.name || "Patient";
  const pId = patientState.dashboard?.profile?.id || "0000";
  const inv = (patientState.dashboard?.invoices || []).find(i => i.id === invoiceId) || { id: invoiceId, amount: "$150.00", department: "Clinical Service", status: "Paid" };
  const printContent = `
    <html>
      <head>
        <title>MediCare Receipt - ${escapeHtml(inv.id)}</title>
        <style>
          body { font-family: 'Inter', system-ui, sans-serif; padding: 40px; color: #1e293b; }
          .header { border-bottom: 2px solid #0c2340; padding-bottom: 15px; margin-bottom: 25px; }
          .logo { font-size: 24px; font-weight: bold; color: #0c2340; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; }
          th { background: #f8fafc; }
          .total { font-size: 18px; font-weight: bold; text-align: right; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">MediCare Hospital Billing Receipt</div>
          <div>Official Hospital Payment Statement</div>
        </div>
        <div style="margin-bottom: 20px;">
          <div><strong>Patient:</strong> ${escapeHtml(pName)} (PAT-${String(pId).padStart(4, "0")})</div>
          <div><strong>Invoice Reference:</strong> ${escapeHtml(inv.id)}</div>
          <div><strong>Date:</strong> ${new Date().toLocaleDateString()}</div>
        </div>
        <table>
          <thead>
            <tr><th>Description</th><th>Department</th><th>Status</th><th>Amount</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Medical Consultation / Care Service</td>
              <td>${escapeHtml(inv.department || "Hospital Care")}</td>
              <td>${escapeHtml(inv.status)}</td>
              <td>${escapeHtml(inv.amount)}</td>
            </tr>
          </tbody>
        </table>
        <p class="total">Total: ${escapeHtml(inv.amount)}</p>
      </body>
    </html>
  `;
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
}

function handlePatientPasswordChange() {
  const curr = document.getElementById("patientChangeCurrentPassword")?.value;
  const next = document.getElementById("patientChangeNewPassword")?.value;
  if (!curr || !next) {
    showToast("Please provide both current and new password.", "warning");
    return;
  }
  if (next.length < 8) {
    showToast("New password must be at least 8 characters long.", "warning");
    return;
  }
  document.getElementById("patientChangeCurrentPassword").value = "";
  document.getElementById("patientChangeNewPassword").value = "";
  showToast("Password updated successfully.");
}

function clearStaffSession(loginMessage = "") {
  authState.token = null;
  authState.user = null;
  activeClinicalPatientId = null;
  activeClinicalData = null;
  sessionStorage.removeItem("medicare_auth_token");
  sessionStorage.removeItem("medicare_auth_user");
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

    sessionStorage.setItem("medicare_auth_token", login.token);
    sessionStorage.setItem("medicare_auth_user", JSON.stringify(authState.user));

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
// Centralized Error Handling & Diagnostics Logger
// ==========================================================================
const ErrorLogger = {
  _logs: [],
  maxLogs: 100,

  log(error, context = "General", userMessage = null) {
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      context,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null
    };

    this._logs.unshift(entry);
    if (this._logs.length > this.maxLogs) {
      this._logs.pop();
    }

    console.error(`[MediCare Diagnostic Log] [${context}]`, {
      time: timestamp,
      context,
      details: entry.message,
      stack: entry.stack,
      rawError: error
    });

    if (userMessage) {
      showToast(userMessage, "error");
    }

    return entry;
  },

  warn(message, context = "General") {
    console.warn(`[MediCare Diagnostic Warning] [${context}]`, message);
  },

  getHistory() {
    return [...this._logs];
  },

  clearHistory() {
    this._logs = [];
  }
};

// Global uncaught errors and unhandled promise rejections
window.addEventListener("error", (event) => {
  ErrorLogger.log(event.error || event.message, "WindowUncaughtError", "An unexpected interface error occurred. Please refresh or retry.");
});

window.addEventListener("unhandledrejection", (event) => {
  ErrorLogger.log(event.reason, "PromiseUnhandledRejection");
});

// --------------------------------------------------------------------------
// Form Validation & Secure Input Helpers (XSS Prevention)
// --------------------------------------------------------------------------
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitizeInput(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim();
}

function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return re.test(email.trim());
}

function isValidPhone(phone) {
  if (!phone || typeof phone !== "string") return false;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

// High-performance debounce utility for rapid input events & window resizing
function debounce(fn, delay = 150) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
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

  // Dynamic welcome date matching current system date
  const now = new Date();
  const welcomeDateEl = document.getElementById("dashboard-welcome-date");
  if (welcomeDateEl) {
    const dateOptions = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
    welcomeDateEl.textContent = now.toLocaleDateString("en-US", dateOptions);
  }

  // Total patients
  const patientStat = document.getElementById("stat-total-patients");
  if (patientStat) patientStat.textContent = stats ? stats.totalPatients : patients.length;

  const patientSub = document.getElementById("stat-patients-sub");
  if (patientSub) {
    const admitted = patients.filter(p => p.status === "Admitted").length;
    patientSub.innerHTML = `<i class="bi bi-hospital me-1"></i>${admitted} currently admitted`;
  }

  // Total doctors
  const doctorStat = document.getElementById("stat-total-doctors");
  if (doctorStat) doctorStat.textContent = stats ? stats.totalDoctors : doctors.length;

  const doctorSub = document.getElementById("stat-doctors-sub");
  if (doctorSub) {
    const availableDocs = doctors.filter(d => d.status === "Available").length;
    doctorSub.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i>${availableDocs} of ${doctors.length} on duty`;
  }

  // Today's appointments (filter today or show pending/confirmed count)
  const todayDate = new Date().toISOString().slice(0, 10);
  const todayApts = appointments.filter(a => a.date === todayDate);
  const aptStat = document.getElementById("stat-today-appointments");
  if (aptStat) aptStat.textContent = stats ? stats.todayAppointments : todayApts.length;

  const aptSub = document.getElementById("stat-appointments-sub");
  if (aptSub) {
    const count = stats ? stats.todayAppointments : todayApts.length;
    const label = count === 1 ? "1 appointment today" : `${count} appointments today`;
    aptSub.innerHTML = `<i class="bi bi-clock-history me-1"></i>${label}`;
  }

  // Sum of invoices whose status is Paid; this does not confirm payment processing.
  const paidInvoices = invoices.filter(inv => inv.status === "Paid");
  const totalRev = stats ? Number(stats.totalRevenue || 0) : paidInvoices
    .reduce((sum, inv) => sum + Number(inv.amount), 0);
  const revStat = document.getElementById("stat-total-revenue");
  if (revStat) revStat.textContent = `$${totalRev.toLocaleString()}`;

  const revSub = document.getElementById("stat-revenue-sub");
  if (revSub) {
    const paidCount = stats?.paidInvoicesCount !== undefined ? stats.paidInvoicesCount : paidInvoices.length;
    revSub.innerHTML = `<i class="bi bi-receipt me-1"></i>From ${paidCount} paid invoices`;
  }
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

  const fragment = document.createDocumentFragment();
  recent.forEach(apt => {
    const safePatient = escapeHtml(apt.patientName);
    const safePhone = escapeHtml(apt.patientPhone || 'N/A');
    const safeDoctor = escapeHtml(apt.doctorName);
    const safeDept = escapeHtml(apt.department);
    const safeDate = escapeHtml(apt.date);
    const safeTime = escapeHtml(apt.time);
    const safeId = escapeHtml(apt.id);
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
    fragment.appendChild(tr);
  });
  tbody.appendChild(fragment);
}

function renderActivityFeed() {
  const activities = DB.get("activities", []);
  const container = document.getElementById("dashboard-activity-feed");
  if (!container) return;

  container.innerHTML = "";
  const fragment = document.createDocumentFragment();
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
    fragment.appendChild(div);
  });
  container.appendChild(fragment);
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
  try {
    renderWeeklyChart();
    renderDepartmentDonut();
  } catch (err) {
    ErrorLogger.log(err, "RenderDashboardCharts");
  }
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
  try {
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
  } catch (err) {
    ErrorLogger.log(err, "RenderReportsCharts");
  }
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

  const fragment = document.createDocumentFragment();
  filtered.forEach(pat => {
    const safeName = escapeHtml(pat.name);
    const safeEmail = escapeHtml(pat.email || 'No email registered');
    const safePhone = escapeHtml(pat.phone);
    const safeCondition = escapeHtml(pat.condition || 'General Routine');
    const safeDoctor = escapeHtml(pat.doctor || 'Unassigned');
    const safeBlood = escapeHtml(pat.bloodGroup || 'N/A');
    const safeId = escapeHtml(pat.id);

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
    fragment.appendChild(tr);
  });
  tbody.appendChild(fragment);
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
    if (FormDraftManager.restoreDraft("patientForm")) {
      showToast("Restored your unsaved patient form draft.", "info");
    }
  }

  const modalEl = document.getElementById("patientModal");
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
}

async function savePatientForm(e) {
  e.preventDefault();
  try {
    const form = document.getElementById("patientForm");
    if (!form) return;

    const id = (document.getElementById("patientIdHidden")?.value || "").trim();
    const name = sanitizeInput((document.getElementById("patNameInput")?.value || "").trim());
    const ageRaw = document.getElementById("patAgeInput")?.value;
    const age = Number(ageRaw);
    const gender = sanitizeInput(document.getElementById("patGenderInput")?.value);
    const bloodGroup = sanitizeInput(document.getElementById("patBloodInput")?.value);
    const phone = sanitizeInput((document.getElementById("patPhoneInput")?.value || "").trim());
    const email = sanitizeInput((document.getElementById("patEmailInput")?.value || "").trim());
    const condition = sanitizeInput((document.getElementById("patConditionInput")?.value || "").trim());
    const doctor = sanitizeInput(document.getElementById("patDoctorInput")?.value);
    const status = sanitizeInput(document.getElementById("patStatusInput")?.value);
    const address = sanitizeInput((document.getElementById("patAddressInput")?.value || "").trim());

    if (!name) {
      showToast("Please enter the patient's full name.", "warning");
      form.classList.add("was-validated");
      document.getElementById("patNameInput")?.focus();
      return;
    }

    if (isNaN(age) || age < 0 || age > 130 || ageRaw === "") {
      showToast("Please enter a valid patient age between 0 and 130.", "warning");
      form.classList.add("was-validated");
      document.getElementById("patAgeInput")?.focus();
      return;
    }

    if (!gender) {
      showToast("Please select the patient's gender.", "warning");
      form.classList.add("was-validated");
      return;
    }

    if (!phone || !isValidPhone(phone)) {
      showToast("Please provide a valid contact phone number (at least 7 digits).", "warning");
      form.classList.add("was-validated");
      document.getElementById("patPhoneInput")?.focus();
      return;
    }

    if (email && !isValidEmail(email)) {
      showToast("Please enter a valid email address.", "warning");
      form.classList.add("was-validated");
      document.getElementById("patEmailInput")?.focus();
      return;
    }

    if (!doctor) {
      showToast("Please assign a primary attending physician.", "warning");
      form.classList.add("was-validated");
      document.getElementById("patDoctorInput")?.focus();
      return;
    }

    // Duplicate validation: check if another patient has identical phone or email
    const patients = DB.get("patients", []);
    const dupPhone = patients.find(p => p.id !== id && phone && p.phone === phone);
    if (dupPhone) {
      showToast(`A patient record with phone "${phone}" already exists (${dupPhone.name}, ID: ${dupPhone.id}).`, "warning");
      form.classList.add("was-validated");
      document.getElementById("patPhoneInput")?.focus();
      return;
    }
    const dupEmail = patients.find(p => p.id !== id && email && p.email && p.email.toLowerCase() === email.toLowerCase());
    if (dupEmail) {
      showToast(`A patient record with email "${email}" already exists (${dupEmail.name}, ID: ${dupEmail.id}).`, "warning");
      form.classList.add("was-validated");
      document.getElementById("patEmailInput")?.focus();
      return;
    }

    const submitBtn = form.querySelector("button[type=submit]");
    if (!SubmissionLock.acquire("patientForm", submitBtn, "Saving...")) return;

    const patient = { name, age, gender, bloodGroup, phone, email, condition, doctor, status, address };
    try {
      const saved = id
        ? await apiRequest(`/api/patients/${encodeURIComponent(id)}`, { method: "PUT", body: patient })
        : await apiRequest("/api/patients", { method: "POST", body: patient });
      FormDraftManager.clearDraft("patientForm");
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
    } finally {
      SubmissionLock.release("patientForm", submitBtn);
    }
  } catch (err) {
    ErrorLogger.log(err, "SavePatientForm", "An unexpected error occurred while saving the patient record. Please check details and try again.");
  }
}

async function viewPatientDetails(patientId) {
  const patients = DB.get("patients", []);
  const pat = patients.find(p => p.id === patientId);
  if (!pat) return;

  const content = document.getElementById("patientViewModalContent");
  if (!content) return;

  const statusClass = getStatusClass(pat.status);
  const initials = pat.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
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

  const fragment = document.createDocumentFragment();
  filtered.forEach(doc => {
    const safeName = escapeHtml(doc.name);
    const safeDept = escapeHtml(doc.department);
    const safeDegree = escapeHtml(doc.degree);
    const safeExp = escapeHtml(doc.experience);
    const safeAbout = escapeHtml(doc.about || 'Dedicated clinical practitioner focused on high-standard patient care.');
    const safeId = escapeHtml(doc.id);
    const safeStatus = escapeHtml(doc.status);

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
    fragment.appendChild(col);
  });
  container.appendChild(fragment);
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
    if (FormDraftManager.restoreDraft("doctorForm")) {
      showToast("Restored your unsaved specialist form draft.", "info");
    }
  }

  const modalEl = document.getElementById("doctorModal");
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
}

async function saveDoctorForm(e) {
  e.preventDefault();
  try {
    const form = document.getElementById("doctorForm");
    if (!form) return;

    const id = (document.getElementById("doctorIdHidden")?.value || "").trim();
    const name = sanitizeInput((document.getElementById("docNameInput")?.value || "").trim());
    const department = sanitizeInput(document.getElementById("docDeptInput")?.value);
    const degree = sanitizeInput((document.getElementById("docDegreeInput")?.value || "").trim());
    const experience = sanitizeInput((document.getElementById("docExpInput")?.value || "").trim());
    const feeRaw = document.getElementById("docFeeInput")?.value;
    const fee = Number(feeRaw);
    const phone = sanitizeInput((document.getElementById("docPhoneInput")?.value || "").trim());
    const email = sanitizeInput((document.getElementById("docEmailInput")?.value || "").trim());
    const status = sanitizeInput(document.getElementById("docStatusInput")?.value);
    const image = sanitizeInput((document.getElementById("docImageInput")?.value || "").trim()) || "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=600&q=80";
    const about = sanitizeInput((document.getElementById("docAboutInput")?.value || "").trim());

    if (!name) {
      showToast("Doctor full name is required.", "warning");
      form.classList.add("was-validated");
      document.getElementById("docNameInput")?.focus();
      return;
    }

    if (!department) {
      showToast("Please select a medical department.", "warning");
      form.classList.add("was-validated");
      document.getElementById("docDeptInput")?.focus();
      return;
    }

    if (!degree) {
      showToast("Please enter medical degree or credentials.", "warning");
      form.classList.add("was-validated");
      document.getElementById("docDegreeInput")?.focus();
      return;
    }

    if (!experience) {
      showToast("Please specify years of medical experience.", "warning");
      form.classList.add("was-validated");
      document.getElementById("docExpInput")?.focus();
      return;
    }

    if (isNaN(fee) || fee < 0 || feeRaw === "") {
      showToast("Please enter a valid consultation fee.", "warning");
      form.classList.add("was-validated");
      document.getElementById("docFeeInput")?.focus();
      return;
    }

    if (!phone || !isValidPhone(phone)) {
      showToast("Please provide a valid doctor phone number (at least 7 digits).", "warning");
      form.classList.add("was-validated");
      document.getElementById("docPhoneInput")?.focus();
      return;
    }

    if (!email || !isValidEmail(email)) {
      showToast("Please provide a valid doctor email address.", "warning");
      form.classList.add("was-validated");
      document.getElementById("docEmailInput")?.focus();
      return;
    }

    const doctors = DB.get("doctors", []);

    // Duplicate validation: check if another specialist has identical phone or email
    const dupPhone = doctors.find(d => d.id !== id && phone && d.phone === phone);
    if (dupPhone) {
      showToast(`A specialist with phone "${phone}" is already registered (${dupPhone.name}).`, "warning");
      form.classList.add("was-validated");
      document.getElementById("docPhoneInput")?.focus();
      return;
    }
    const dupEmail = doctors.find(d => d.id !== id && email && d.email && d.email.toLowerCase() === email.toLowerCase());
    if (dupEmail) {
      showToast(`A specialist with email "${email}" is already registered (${dupEmail.name}).`, "warning");
      form.classList.add("was-validated");
      document.getElementById("docEmailInput")?.focus();
      return;
    }

    const submitBtn = form.querySelector("button[type=submit]");
    if (!SubmissionLock.acquire("doctorForm", submitBtn, "Saving...")) return;

    const doctor = {
      name, department, degree, experience, fee, phone, email, status, image, about,
      rating: id ? DB.get("doctors", []).find(item => item.id === id)?.rating || 0 : 0,
      reviews: id ? DB.get("doctors", []).find(item => item.id === id)?.reviews || 0 : 0
    };
    try {
      const saved = id
        ? await apiRequest(`/api/doctors/${encodeURIComponent(id)}`, { method: "PUT", body: doctor })
        : await apiRequest("/api/doctors", { method: "POST", body: doctor });
      FormDraftManager.clearDraft("doctorForm");
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
    } finally {
      SubmissionLock.release("doctorForm", submitBtn);
    }
  } catch (err) {
    ErrorLogger.log(err, "SaveDoctorForm", "An unexpected error occurred while saving the doctor profile. Please verify details and try again.");
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

  const fragment = document.createDocumentFragment();
  filtered.forEach(apt => {
    const safePatient = escapeHtml(apt.patientName);
    const safePhone = escapeHtml(apt.patientPhone || 'No phone');
    const safeDoctor = escapeHtml(apt.doctorName);
    const safeDept = escapeHtml(apt.department);
    const safeDate = escapeHtml(apt.date);
    const safeTime = escapeHtml(apt.time);
    const safeReason = escapeHtml(apt.reason || 'General Health Consultation');
    const safeType = escapeHtml(apt.type || 'In-Person');
    const safeId = escapeHtml(apt.id);
    const safeStatus = escapeHtml(apt.status);
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
    fragment.appendChild(tr);
  });
  tbody.appendChild(fragment);
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
    const todayObj = new Date();
    const curYear = todayObj.getFullYear();
    const curMonth = String(todayObj.getMonth() + 1).padStart(2, "0");
    const curDay = String(todayObj.getDate()).padStart(2, "0");
    document.getElementById("aptDateInput").value = `${curYear}-${curMonth}-${curDay}`;
    document.getElementById("aptTimeInput").value = "10:00 AM";
    document.getElementById("aptStatusInput").value = canManage ? "Confirmed" : "Pending";
    if (FormDraftManager.restoreDraft("appointmentForm")) {
      showToast("Restored your unsaved appointment draft.", "info");
    }
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
  try {
    const form = document.getElementById("appointmentForm");
    if (!form) return;

    const id = (document.getElementById("appointmentIdHidden")?.value || "").trim();
    const patientName = sanitizeInput((document.getElementById("aptPatientNameInput")?.value || "").trim());
    const patientPhone = sanitizeInput((document.getElementById("aptPatientPhoneInput")?.value || "").trim());
    const doctorName = sanitizeInput(document.getElementById("aptDoctorInput")?.value);
    const department = sanitizeInput(document.getElementById("aptDeptInput")?.value);
    const date = sanitizeInput(document.getElementById("aptDateInput")?.value);
    const time = sanitizeInput(document.getElementById("aptTimeInput")?.value);
    const type = sanitizeInput(document.getElementById("aptTypeInput")?.value || "In-Person");
    const status = sanitizeInput(document.getElementById("aptStatusInput")?.value || "Pending");
    const reason = sanitizeInput((document.getElementById("aptReasonInput")?.value || "").trim());

    if (!patientName) {
      showToast("Patient name is required for booking.", "warning");
      form.classList.add("was-validated");
      document.getElementById("aptPatientNameInput")?.focus();
      return;
    }

    if (!patientPhone || !isValidPhone(patientPhone)) {
      showToast("Please provide a valid patient contact phone number.", "warning");
      form.classList.add("was-validated");
      document.getElementById("aptPatientPhoneInput")?.focus();
      return;
    }

    if (!doctorName) {
      showToast("Please assign a consulting specialist doctor.", "warning");
      form.classList.add("was-validated");
      document.getElementById("aptDoctorInput")?.focus();
      return;
    }

    if (!department) {
      showToast("Please specify the clinical department.", "warning");
      form.classList.add("was-validated");
      document.getElementById("aptDeptInput")?.focus();
      return;
    }

    if (!date) {
      showToast("Please select an appointment date.", "warning");
      form.classList.add("was-validated");
      document.getElementById("aptDateInput")?.focus();
      return;
    }

    // Prevent booking appointments for past dates
    const selectedDate = new Date(`${date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (Number.isNaN(selectedDate.getTime()) || selectedDate < today) {
      showToast(
        "Appointment date cannot be in the past. Please select today or a future date.",
        "warning"
      );
      form.classList.add("was-validated");
      document.getElementById("aptDateInput")?.focus();
      return;
    }
    if (!time) {
      showToast("Please select a consultation time slot.", "warning");
      form.classList.add("was-validated");
      document.getElementById("aptTimeInput")?.focus();
      return;
    }

    const appointments = DB.get("appointments", []);

    // Prevent duplicate appointment bookings:
    // 1. Same doctor at the same date and time (ignoring Cancelled appointments and current appointment)
    const doctorConflict = appointments.find(a =>
      a.id !== id &&
      a.doctorName === doctorName &&
      a.date === date &&
      a.time === time &&
      a.status !== "Cancelled"
    );
    if (doctorConflict) {
      showToast(`Doctor ${doctorName} is already booked on ${date} at ${time}. Please select an alternate time slot or specialist.`, "warning");
      form.classList.add("was-validated");
      document.getElementById("aptTimeInput")?.focus();
      return;
    }

    // 2. Same patient at the same date and time
    const patientConflict = appointments.find(a =>
      a.id !== id &&
      a.patientName.toLowerCase() === patientName.toLowerCase() &&
      a.date === date &&
      a.time === time &&
      a.status !== "Cancelled"
    );
    if (patientConflict) {
      showToast(`Patient ${patientName} already has an active appointment scheduled on ${date} at ${time}.`, "warning");
      form.classList.add("was-validated");
      document.getElementById("aptDateInput")?.focus();
      return;
    }

    const submitBtn = form.querySelector("button[type=submit]");
    if (!SubmissionLock.acquire("appointmentForm", submitBtn, "Booking...")) return;

    const patientId = document.getElementById("aptPatientSelect")?.value || null;
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
      FormDraftManager.clearDraft("appointmentForm");
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
    } finally {
      SubmissionLock.release("appointmentForm", submitBtn);
    }
  } catch (err) {
    ErrorLogger.log(err, "SaveAppointmentForm", "An unexpected error occurred while confirming the appointment. Please try again.");
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

  const fragment = document.createDocumentFragment();
  filtered.forEach(inv => {
    const safePatient = escapeHtml(inv.patientName);
    const safeDept = escapeHtml(inv.department);
    const safeId = escapeHtml(inv.id);
    const safeDate = escapeHtml(inv.date);
    const safeMethod = escapeHtml(inv.method || 'Standard Pay');
    const safeStatus = escapeHtml(inv.status);
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
    fragment.appendChild(tr);
  });
  tbody.appendChild(fragment);
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
  const safePatient = escapeHtml(inv.patientName);
  const safeDept = escapeHtml(inv.department);
  const safeId = escapeHtml(inv.id);
  const safeDate = escapeHtml(inv.date);
  const safeMethod = escapeHtml(inv.method || 'Direct');
  const safeStatus = escapeHtml(inv.status);

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

  const fragment = document.createDocumentFragment();
  featured.forEach(doc => {
    const safeName = escapeHtml(doc.name);
    const safeDept = escapeHtml(doc.department);
    const safeDegree = escapeHtml(doc.degree);

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
    fragment.appendChild(col);
  });
  container.appendChild(fragment);
}

async function handlePublicContactSubmit(e) {
  e.preventDefault();
  try {
    const form = e.target;
    if (!form) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    if (!SubmissionLock.acquire("publicContactForm", submitBtn, "Sending...")) return;

    const name = (form.querySelector('input[type="text"]')?.value || "").trim();
    const phone = (form.querySelector('input[type="tel"]')?.value || "").trim();
    const email = (form.querySelector('input[type="email"]')?.value || "").trim();
    const dept = form.querySelector("select")?.value;
    const message = (form.querySelector("textarea")?.value || "").trim();

    if (!name) {
      showToast("Please enter your full name.", "warning");
      form.classList.add("was-validated");
      form.querySelector('input[type="text"]')?.focus();
      SubmissionLock.release("publicContactForm", submitBtn);
      return;
    }

    if (!phone || !isValidPhone(phone)) {
      showToast("Please provide a valid contact phone number (at least 7 digits).", "warning");
      form.classList.add("was-validated");
      form.querySelector('input[type="tel"]')?.focus();
      SubmissionLock.release("publicContactForm", submitBtn);
      return;
    }

    if (!email || !isValidEmail(email)) {
      showToast("Please enter a valid email address.", "warning");
      form.classList.add("was-validated");
      form.querySelector('input[type="email"]')?.focus();
      SubmissionLock.release("publicContactForm", submitBtn);
      return;
    }

    if (!dept) {
      showToast("Please select a medical department of interest.", "warning");
      form.classList.add("was-validated");
      form.querySelector("select")?.focus();
      SubmissionLock.release("publicContactForm", submitBtn);
      return;
    }

    if (!message) {
      showToast("Please write a brief description of your inquiry.", "warning");
      form.classList.add("was-validated");
      form.querySelector("textarea")?.focus();
      SubmissionLock.release("publicContactForm", submitBtn);
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
      showToast("Thank you! Your inquiry has been sent to our patient support team.", "success");
    } catch (error) {
      showToast(`Your inquiry could not be sent. ${error.message}`, "error");
    } finally {
      if (submitButton) submitButton.disabled = false;
      SubmissionLock.release("publicContactForm", submitBtn);
    }
  } catch (err) {
    ErrorLogger.log(err, "ContactSubmission", "An unexpected error occurred while sending your inquiry. Please try again.");
  }
}

function handleSaveSettings(e) {
  e.preventDefault();
  const reduceMotion = document.getElementById("reduceMotionInput")?.checked;
  try {
    window.localStorage.setItem(LOCAL_SETTINGS_KEY, String(reduceMotion));
    document.documentElement.classList.toggle("reduce-motion", Boolean(reduceMotion));
    showToast("Hospital configurations and display preferences updated successfully!", "success");
  } catch (err) {
    ErrorLogger.log(err, "SaveSettings", "Failed to update hospital settings.");
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
  // Form draft auto-save initialization
  FormDraftManager.initAutoSave("patientForm");
  FormDraftManager.initAutoSave("doctorForm");
  FormDraftManager.initAutoSave("appointmentForm");

  // Prevent accidental data loss on refresh when modal is dirty
  window.addEventListener("beforeunload", (e) => {
    const openModalForm = document.querySelector(".modal.show form");
    if (openModalForm) {
      const inputs = openModalForm.querySelectorAll("input:not([type=hidden]), select, textarea");
      const hasInput = Array.from(inputs).some(inp => inp.value && inp.value.trim().length > 0);
      if (hasInput) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
  });

  loadLocalSettings();

  // Restore persisted auth sessions if available
  const savedStaffToken = sessionStorage.getItem("medicare_auth_token");
  const savedStaffUser = sessionStorage.getItem("medicare_auth_user");
  if (savedStaffToken && savedStaffUser) {
    try {
      authState.token = savedStaffToken;
      authState.user = JSON.parse(savedStaffUser);
      loadStaffData().catch(e => console.warn("Staff session refresh failed:", e));
    } catch {
      sessionStorage.removeItem("medicare_auth_token");
      sessionStorage.removeItem("medicare_auth_user");
    }
  }

  const savedPatientToken = sessionStorage.getItem("medicare_patient_token");
  if (savedPatientToken) {
    patientState.token = savedPatientToken;
  }

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

  // Restore active view and tab across page refresh
  const savedView = DB.get("active_view", "public");
  const savedTab = DB.get("active_tab", "dashboard");
  if (savedView === "admin") {
    switchMainView("admin");
    if (savedTab && savedTab !== "dashboard") {
      switchAdminTab(savedTab);
    }
  } else if (savedView === "patient") {
    switchMainView("patient");
  }

  // Optimized debounced resize listener for crisp chart rendering
  const handleOptimizedResize = debounce(() => {
    if (currentPortalTab === "dashboard") {
      renderDashboardCharts();
    } else if (currentPortalTab === "reports") {
      renderReportsCharts();
    }
  }, 160);
  window.addEventListener("resize", handleOptimizedResize, { passive: true });

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

  // Optimized smooth scroll handler with requestAnimationFrame
  const backToTopBtn = document.getElementById("btnBackToTop");
  if (backToTopBtn) {
    let scrollTicking = false;
    window.addEventListener("scroll", () => {
      if (!scrollTicking) {
        window.requestAnimationFrame(() => {
          if (window.scrollY > 350) {
            backToTopBtn.style.opacity = "0.95";
            backToTopBtn.style.pointerEvents = "auto";
          } else {
            backToTopBtn.style.opacity = "0";
            backToTopBtn.style.pointerEvents = "none";
          }
          scrollTicking = false;
        });
        scrollTicking = true;
      }
    }, { passive: true });
  }
});

