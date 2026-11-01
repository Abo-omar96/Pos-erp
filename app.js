import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  runTransaction,
  setDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const isConfigured = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("YOUR_");
const loginScreen = document.querySelector("#login-screen");
const appShell = document.querySelector("#app-shell");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const pageContent = document.querySelector("#page-content");
const modalRoot = document.querySelector("#modal-root");
const toastRoot = document.querySelector("#toast-root");

const app = isConfigured ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const state = {
  user: null,
  page: "dashboard",
  collections: {
    items: [],
    customers: [],
    suppliers: [],
    warehouses: [],
    cashboxes: [],
    expenseTypes: [],
    sales: [],
    purchases: [],
    payments: [],
    expenses: [],
    stockMoves: [],
    returns: [],
    employees: [],
    payroll: [],
  },
  company: { name: "منشأتك", vatRate: 15, currency: "ر.س" },
  filter: "",
  report: null,
  statement: null,
  themeDraft: null,
  themeDirty: false,
  themeScope: "",
  themeApplied: null,
  analytics: null,
  unsubscribers: [],
};

const titles = {
  dashboard: "الرئيسية",
  sales: "فواتير المبيعات",
  purchases: "فواتير المشتريات",
  items: "الأصناف والمخزون",
  customers: "العملاء",
  suppliers: "الموردون",
  payments: "سندات القبض والصرف",
  expenses: "المصروفات",
  inventory: "حركة المخزون",
  reports: "التقارير",
  returns: "المرتجعات",
  statements: "كشف حساب عميل / مورد",
  analytics: "التحليلات والرسوم البيانية",
  employees: "الموظفون",
  payroll: "الرواتب",
  settings: "الإعدادات",
};

const entityConfig = {
  items: {
    title: "الأصناف",
    collection: "items",
    add: "صنف جديد",
    search: "ابحث بالاسم أو الكود أو الباركود",
    fields: [
      { key: "code", label: "كود الصنف", required: true },
      { key: "name", label: "اسم الصنف", required: true },
      { key: "category", label: "المجموعة" },
      { key: "unit", label: "الوحدة", default: "قطعة" },
      { key: "salePrice", label: "سعر البيع قبل الضريبة", type: "number", required: true, min: 0 },
      { key: "costPrice", label: "التكلفة", type: "number", min: 0 },
      { key: "quantity", label: "الرصيد الافتتاحي", type: "number", min: 0 },
      { key: "lowStock", label: "حد التنبيه", type: "number", min: 0 },
      { key: "vatRate", label: "الضريبة %", type: "number", default: 15, min: 0, max: 100 },
      { key: "trackInventory", label: "صنف مخزني", type: "checkbox", default: true },
      { key: "barcode", label: "الباركود" },
    ],
    columns: [
      ["code", "الكود"],
      ["name", "اسم الصنف"],
      ["category", "المجموعة"],
      ["quantity", "الرصيد"],
      ["salePrice", "سعر البيع", "money"],
      ["costPrice", "التكلفة", "money"],
      ["lastSalePrice", "آخر سعر بيع", "money"],
    ],
  },
  customers: {
    title: "العملاء",
    collection: "customers",
    add: "عميل جديد",
    search: "ابحث باسم العميل أو الكود أو الجوال",
    fields: [
      { key: "code", label: "كود العميل", required: true },
      { key: "name", label: "اسم العميل", required: true },
      { key: "phone", label: "رقم الجوال", type: "tel" },
      { key: "email", label: "البريد الإلكتروني", type: "email" },
      { key: "taxNumber", label: "الرقم الضريبي" },
      { key: "openingBalance", label: "الرصيد الافتتاحي", type: "number" },
    ],
    columns: [
      ["code", "الكود"],
      ["name", "اسم العميل"],
      ["phone", "الجوال"],
      ["taxNumber", "الرقم الضريبي"],
      ["balance", "الرصيد", "money"],
    ],
  },
  suppliers: {
    title: "الموردون",
    collection: "suppliers",
    add: "مورد جديد",
    search: "ابحث باسم المورد أو الكود أو الجوال",
    fields: [
      { key: "code", label: "كود المورد", required: true },
      { key: "name", label: "اسم المورد", required: true },
      { key: "phone", label: "رقم الجوال", type: "tel" },
      { key: "taxNumber", label: "الرقم الضريبي" },
      { key: "openingBalance", label: "الرصيد الافتتاحي", type: "number" },
    ],
    columns: [
      ["code", "الكود"],
      ["name", "اسم المورد"],
      ["phone", "الجوال"],
      ["taxNumber", "الرقم الضريبي"],
      ["balance", "الرصيد", "money"],
    ],
  },
  warehouses: {
    title: "المخازن",
    collection: "warehouses",
    add: "مخزن جديد",
    fields: [
      { key: "code", label: "كود المخزن", required: true },
      { key: "name", label: "اسم المخزن", required: true },
      { key: "location", label: "الموقع" },
    ],
    columns: [["code", "الكود"], ["name", "المخزن"], ["location", "الموقع"]],
  },
  cashboxes: {
    title: "الخزن والبنوك",
    collection: "cashboxes",
    add: "خزينة أو بنك جديد",
    fields: [
      { key: "code", label: "الكود", required: true },
      { key: "name", label: "اسم الخزينة أو البنك", required: true },
      { key: "type", label: "النوع", type: "select", options: ["خزينة", "بنك"] },
      { key: "openingBalance", label: "الرصيد الافتتاحي", type: "number" },
    ],
    columns: [["code", "الكود"], ["name", "الاسم"], ["type", "النوع"], ["balance", "الرصيد", "money"]],
  },
  employees: {
    title: "الموظفون",
    collection: "employees",
    add: "موظف جديد",
    search: "ابحث باسم الموظف أو الكود أو الوظيفة",
    fields: [
      { key: "code", label: "كود الموظف", required: true },
      { key: "name", label: "اسم الموظف", required: true },
      { key: "jobTitle", label: "الوظيفة" },
      { key: "phone", label: "رقم الجوال", type: "tel" },
      { key: "hireDate", label: "تاريخ التعيين", type: "date" },
      { key: "basicSalary", label: "الراتب الأساسي", type: "number", required: true, min: 0 },
      { key: "allowances", label: "البدلات الثابتة", type: "number", default: 0, min: 0 },
      { key: "deductions", label: "خصومات ثابتة (تأمينات...)", type: "number", default: 0, min: 0 },
      { key: "status", label: "الحالة", type: "select", options: ["نشط", "موقوف"] },
    ],
    columns: [["code", "الكود"], ["name", "الموظف"], ["jobTitle", "الوظيفة"], ["basicSalary", "الأساسي", "money"], ["allowances", "البدلات", "money"], ["netSalary", "الصافي الشهري", "money"], ["status", "الحالة"]],
  },
  expenseTypes: {
    title: "أنواع المصروفات",
    collection: "expenseTypes",
    add: "نوع مصروف جديد",
    fields: [{ key: "name", label: "نوع المصروف", required: true }],
    columns: [["name", "نوع المصروف"]],
  },
};

const money = (value) => `${new Intl.NumberFormat("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)} ${escapeHTML(state.company.currency || "ر.س")}`;
const number = (value) => new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(Number(value) || 0);
const localDateValue = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const isoToday = () => localDateValue(new Date());
const makeCode = (prefix) => `${prefix}-${Date.now().toString().slice(-7)}`;
const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));
const selected = (value, current) => value === current ? " selected" : "";
const list = (name) => state.collections[name] || [];

// ---- بحث: تطبيع النص العربي (تشكيل/همزات/ة/ى/أرقام) ----
const normalizeText = (value) => String(value ?? "").toLowerCase()
  .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
  .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
  .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
  .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
  .trim();
const matchesFilter = (values, query = state.filter) => {
  const q = normalizeText(query);
  if (!q) return true;
  const haystack = normalizeText(values.join(" "));
  return q.split(/\s+/).every((part) => haystack.includes(part));
};
const searchBar = (placeholder, count, unit) => `<div class="toolbar"><input class="toolbar-search" data-filter placeholder="${escapeHTML(placeholder)}" value="${escapeHTML(state.filter)}" /><span class="muted">${number(count)} ${unit}</span></div>`;

let renderQueued = false;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; if (state.user) renderPage(); });
}

// ---- قائمة منسدلة قابلة للبحث (الأصناف / العملاء / الموردون) ----
const comboSources = {
  items: () => list("items").map((r) => ({ id: r.id, label: r.name || r.code, sub: `${r.code || ""} · الرصيد ${number(r.quantity)}${r.barcode ? ` · ${r.barcode}` : ""}`, search: [r.name, r.code, r.barcode, r.category], low: r.trackInventory !== false && Number(r.quantity || 0) <= 0 })),
  customers: () => list("customers").map((r) => ({ id: r.id, label: r.name, sub: [r.code, r.phone].filter(Boolean).join(" · "), search: [r.name, r.code, r.phone, r.taxNumber] })),
  suppliers: () => list("suppliers").map((r) => ({ id: r.id, label: r.name, sub: [r.code, r.phone].filter(Boolean).join(" · "), search: [r.name, r.code, r.phone, r.taxNumber] })),
};
const comboRows = (combo) => comboSources[combo.dataset.source]?.() || [];

function comboHTML({ name = "", source, value = "", placeholder = "اكتب للبحث...", className = "" }) {
  const current = (comboSources[source]?.() || []).find((r) => r.id === value);
  return `<div class="combo" data-combo data-source="${source}"><input type="text" class="combo-input" autocomplete="off" placeholder="${escapeHTML(placeholder)}" value="${escapeHTML(current?.label || "")}" /><input type="hidden" class="combo-value ${className}" ${name ? `name="${name}"` : ""} value="${escapeHTML(value)}" /><div class="combo-list is-hidden" role="listbox"></div></div>`;
}
function closeCombos() {
  document.querySelectorAll(".combo-list:not(.is-hidden)").forEach((el) => el.classList.add("is-hidden"));
}
function openCombo(combo, query = "") {
  closeCombos();
  const listEl = combo.querySelector(".combo-list");
  const rows = comboRows(combo).filter((r) => matchesFilter(r.search, query)).slice(0, 40);
  listEl.innerHTML = rows.length
    ? rows.map((r, i) => `<div class="combo-option${i === 0 ? " active" : ""}" role="option" data-id="${escapeHTML(r.id)}"><strong>${escapeHTML(r.label)}</strong><small${r.low ? ' class="is-low"' : ""}>${escapeHTML(r.sub || "")}</small></div>`).join("")
    : `<div class="combo-empty">لا توجد نتائج مطابقة</div>`;
  const rect = combo.getBoundingClientRect();
  const width = Math.max(rect.width, 280);
  listEl.style.width = `${width}px`;
  listEl.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
  const below = window.innerHeight - rect.bottom;
  if (below < 220 && rect.top > below) { listEl.style.top = "auto"; listEl.style.bottom = `${window.innerHeight - rect.top + 4}px`; }
  else { listEl.style.bottom = "auto"; listEl.style.top = `${rect.bottom + 4}px`; }
  listEl.classList.remove("is-hidden");
}
function pickCombo(combo, id) {
  const row = comboRows(combo).find((r) => r.id === id);
  if (!row) return;
  combo.querySelector(".combo-input").value = row.label;
  const hidden = combo.querySelector(".combo-value");
  hidden.value = row.id;
  hidden.dispatchEvent(new Event("change", { bubbles: true }));
  closeCombos();
}
function bindComboEvents() {
  document.addEventListener("focusin", (event) => {
    if (event.target.matches?.(".combo-input")) { event.target.select(); openCombo(event.target.closest(".combo"), ""); }
  });
  document.addEventListener("click", (event) => {
    const input = event.target.closest?.(".combo-input");
    if (input) { const combo = input.closest(".combo"); if (combo.querySelector(".combo-list").classList.contains("is-hidden")) openCombo(combo, ""); return; }
    if (!event.target.closest?.(".combo")) closeCombos();
  });
  document.addEventListener("input", (event) => {
    if (!event.target.matches?.(".combo-input")) return;
    const combo = event.target.closest(".combo");
    const hidden = combo.querySelector(".combo-value");
    if (hidden.value) { hidden.value = ""; hidden.dispatchEvent(new Event("change", { bubbles: true })); }
    openCombo(combo, event.target.value);
  });
  document.addEventListener("mousedown", (event) => {
    const option = event.target.closest?.(".combo-option");
    if (!option) return;
    event.preventDefault();
    pickCombo(option.closest(".combo"), option.dataset.id);
  });
  document.addEventListener("focusout", (event) => {
    if (!event.target.matches?.(".combo-input")) return;
    const combo = event.target.closest(".combo");
    if (combo.contains(event.relatedTarget)) return;
    const hidden = combo.querySelector(".combo-value");
    const row = comboRows(combo).find((r) => r.id === hidden.value);
    event.target.value = row ? row.label : "";
    combo.querySelector(".combo-list").classList.add("is-hidden");
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (document.querySelector(".combo-list:not(.is-hidden)")) closeCombos();
      else if (modalRoot.firstElementChild) closeModal();
      return;
    }
    const input = event.target.matches?.(".combo-input") ? event.target : null;
    if (!input) return;
    const combo = input.closest(".combo");
    const listEl = combo.querySelector(".combo-list");
    const open = !listEl.classList.contains("is-hidden");
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) { openCombo(combo, ""); return; }
      const options = [...listEl.querySelectorAll(".combo-option")];
      if (!options.length) return;
      let index = options.findIndex((o) => o.classList.contains("active"));
      options[index]?.classList.remove("active");
      index = (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
      options[index].classList.add("active");
      options[index].scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      const active = listEl.querySelector(".combo-option.active");
      if (active) pickCombo(combo, active.dataset.id);
    }
  });
  window.addEventListener("scroll", (event) => {
    if (event.target instanceof Element && event.target.closest(".combo-list")) return;
    closeCombos();
  }, true);
  window.addEventListener("resize", closeCombos);
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast${type === "error" ? " error" : ""}`;
  toast.textContent = message;
  toastRoot.append(toast);
  window.setTimeout(() => toast.remove(), 3500);
}

function explainError(error, stage = "") {
  const code = error?.code || "";
  if (code.includes("auth/invalid-email")) return "اكتب بريدًا إلكترونيًا صحيحًا.";
  if (code.includes("auth/invalid-credential") || code.includes("auth/wrong-password") || code.includes("auth/user-not-found")) {
    return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
  }
  if (code.includes("auth/operation-not-allowed")) return "تسجيل الدخول بالبريد غير مفعّل في Firebase Authentication. فعّل Email/Password من لوحة Firebase.";
  if (code.includes("auth/invalid-api-key")) return "مفتاح Firebase غير صحيح. راجع firebase-config.js.";
  if (code.includes("auth/network-request-failed")) return "تعذر الاتصال بخدمة تسجيل الدخول. تحقق من الإنترنت أو إعدادات الشبكة وحاول مجددًا.";
  if (code.includes("permission-denied")) return "ليس لديك صلاحية الوصول. تأكد من إضافة UID المستخدم إلى authorizedUsers في Firebase.";
  if (code.includes("unavailable")) {
    if (stage === "authorization") return "تم تسجيل الدخول، لكن قاعدة Firestore غير متاحة. تحقق من تفعيل Cloud Firestore ونشر قواعد firestore.rules في المشروع نفسه.";
    if (stage === "auth") return "تعذر الاتصال بخدمة تسجيل الدخول في Firebase. تحقق من الإنترنت ومن تفعيل Email/Password في Authentication.";
    return "تعذر الاتصال بقاعدة بيانات Firestore. تحقق من الإنترنت ومن إنشاء قاعدة البيانات في مشروع Firebase.";
  }
  if (code.includes("auth/too-many-requests")) return "محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.";
  return error?.message || "حدث خطأ غير متوقع.";
}

function setLoading(button, busy, label = "جارٍ الحفظ...") {
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = label;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || button.textContent;
  }
}

function showModal(title, body, options = {}) {
  modalRoot.innerHTML = `
    <div class="modal-backdrop" data-close-modal>
      <section class="modal ${options.small ? "modal-small" : ""}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header class="modal-header"><h2 id="modal-title">${escapeHTML(title)}</h2><button class="icon-button" type="button" data-close-modal aria-label="إغلاق">×</button></header>
        <div class="modal-body">${body}</div>
        ${options.footer ? `<footer class="modal-footer">${options.footer}</footer>` : ""}
      </section>
    </div>`;
  modalRoot.querySelector(".modal").addEventListener("click", (event) => event.stopPropagation());
  modalRoot.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", (event) => {
      if (event.target === button || button.closest(".modal-header")) modalRoot.innerHTML = "";
    });
  });
  modalRoot.querySelector(".modal-body input:not([type=hidden]), .modal-body select")?.focus();
}

function closeModal() {
  modalRoot.innerHTML = "";
}

function setPage(page) {
  if (!titles[page]) return;
  state.page = page;
  state.filter = "";
  document.querySelectorAll(".nav-link").forEach((button) => button.classList.toggle("active", button.dataset.page === page));
  document.querySelector("#page-title").textContent = titles[page];
  document.querySelector(".sidebar").classList.remove("mobile-open");
  document.body.classList.remove("menu-open");
  renderPage();
}

function renderPage() {
  if (!state.user) return;
  syncThemeBar();
  const renderers = {
    dashboard: renderDashboard,
    sales: () => renderInvoices("sales"),
    purchases: () => renderInvoices("purchases"),
    items: () => renderEntity("items"),
    customers: () => renderEntity("customers"),
    suppliers: () => renderEntity("suppliers"),
    payments: renderPayments,
    expenses: renderExpenses,
    inventory: renderInventory,
    reports: renderReports,
    returns: renderReturns,
    statements: renderStatements,
    analytics: renderAnalytics,
    employees: () => renderEntity("employees"),
    payroll: renderPayroll,
    settings: renderSettings,
  };
  (renderers[state.page] || renderDashboard)();
}

function pageHeading(title, description, action = "") {
  return `<div class="page-heading"><div><h2>${title}</h2><p>${description}</p></div><div class="heading-actions">${action}</div></div>`;
}

function statCard(label, value, icon, foot = "") {
  return `<article class="card stat-card"><div class="stat-label"><span>${label}</span><span class="stat-icon">${icon}</span></div><strong class="stat-value">${value}</strong><div class="stat-foot">${foot}</div></article>`;
}

function renderDashboard() {
  const retSum = (test) => list("returns").filter((row) => row.kind === "sales" && test(String(row.date || ""))).reduce((sum, row) => sum + Number(row.total || 0), 0);
  const todaySales = -retSum((d) => d === isoToday()) + list("sales").filter((row) => row.date === isoToday()).reduce((sum, row) => sum + Number(row.total || 0), 0);
  const monthPrefix = isoToday().slice(0, 7);
  const monthSales = -retSum((d) => d.startsWith(monthPrefix)) + list("sales").filter((row) => String(row.date || "").startsWith(monthPrefix)).reduce((sum, row) => sum + Number(row.total || 0), 0);
  const customerBalances = list("customers").reduce((sum, row) => sum + Number(row.balance ?? row.openingBalance ?? 0), 0);
  const cashBalance = list("cashboxes").reduce((sum, row) => sum + Number(row.balance ?? row.openingBalance ?? 0), 0);
  const lowItems = list("items").filter((row) => Number(row.lowStock || 0) > 0 && Number(row.quantity || 0) <= Number(row.lowStock || 0));
  const recent = [...list("sales")].sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).slice(0, 5);
  pageContent.innerHTML = `
    ${pageHeading(`أهلًا بك في ${escapeHTML(state.company.name || "منشأتك")}`, "ملخص سريع لحركة منشأتك وأهم الأرقام.", `<button class="button button-primary" data-action="new-sale">＋ فاتورة مبيعات</button>`)}
    <div class="stats-grid">
      ${statCard("مبيعات اليوم", money(todaySales), "↗", "صافي الفواتير بعد المرتجعات")}
      ${statCard("مبيعات الشهر", money(monthSales), "▥", "صافي بعد المرتجعات من بداية الشهر")}
      ${statCard("مستحقات العملاء", money(customerBalances), "♙", "الأرصدة المدينة المسجلة")}
      ${statCard("أرصدة الخزن والبنوك", money(cashBalance), "▣", "الرصيد المتاح")}
    </div>
    <div class="quick-actions">
      <button class="quick-action" data-action="new-sale"><span>↗</span><span><strong>فاتورة مبيعات</strong><small>تسجيل بيع جديد</small></span></button>
      <button class="quick-action" data-action="new-purchase"><span>↙</span><span><strong>فاتورة مشتريات</strong><small>إضافة مخزون جديد</small></span></button>
      <button class="quick-action" data-action="new-expense"><span>−</span><span><strong>تسجيل مصروف</strong><small>متابعة المصروفات</small></span></button>
    </div>
    <div class="dashboard-grid">
      <section class="card card-pad"><div class="card-title"><h3>أحدث فواتير المبيعات</h3><button class="text-link" data-page="sales">عرض الكل</button></div>${invoiceTable(recent, "sales", true)}</section>
      <section class="card card-pad"><div class="card-title"><h3>أصناف تحتاج متابعة</h3><button class="text-link" data-page="items">إدارة الأصناف</button></div>${lowItems.length ? `<div class="table-wrap"><table><thead><tr><th>الصنف</th><th>الرصيد</th><th>حد التنبيه</th></tr></thead><tbody>${lowItems.slice(0, 6).map((item) => `<tr><td class="table-primary">${escapeHTML(item.name)}</td><td>${number(item.quantity)}</td><td>${number(item.lowStock)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state"><strong>لا توجد تنبيهات مخزون</strong>ستظهر الأصناف قليلة الرصيد هنا.</div>`}</section>
    </div>
    <section class="card card-pad dash-chart"><div class="card-title"><h3>المبيعات والمشتريات والمصروفات — آخر 6 أشهر</h3><button class="text-link" data-page="analytics">التحليلات الكاملة</button></div>${monthlyChart(6)}</section>`;
}

function renderEntity(entity) {
  const config = entityConfig[entity];
  const rows = list(config.collection).filter((row) => matchesFilter(Object.values(row).filter((value) => typeof value !== "object")));
  pageContent.innerHTML = `
    ${pageHeading(config.title, `إدارة بيانات ${config.title.toLowerCase()} وتحديثها.`, `<button class="button button-primary" data-action="add-entity" data-entity="${entity}">＋ ${config.add}</button>`)}
    <section class="card card-pad">
      <div class="toolbar"><input class="toolbar-search" data-filter placeholder="${escapeHTML(config.search || "ابحث...")}" value="${escapeHTML(state.filter)}" /><span class="muted">${number(rows.length)} سجل</span></div>
      ${entityTable(entity, rows)}
    </section>`;
}

function renderCell(row, key, type) {
  if (key === "lastSalePrice") {
    const last = lastSaleAnyMap().get(row.id);
    return last ? `${money(last.price)}<span class="table-sub">${escapeHTML(last.partnerName)} · ${escapeHTML(last.date)}</span>` : "—";
  }
  if (key === "netSalary") return money(Number(row.basicSalary || 0) + Number(row.allowances || 0) - Number(row.deductions || 0));
  return type === "money" ? money(row[key]) : escapeHTML(row[key] ?? "—");
}

function entityTable(entity, rows) {
  const config = entityConfig[entity];
  if (!rows.length) return `<div class="empty-state"><strong>لا توجد بيانات بعد</strong>أضف أول سجل للبدء باستخدام هذا القسم.</div>`;
  const head = config.columns.map(([, label]) => `<th>${label}</th>`).join("");
  const body = rows.map((row) => `<tr>${config.columns.map(([key, , type]) => `<td>${renderCell(row, key, type)}</td>`).join("")}<td><div class="row-actions">${entity === "customers" || entity === "suppliers" ? `<button class="small-button" data-action="open-statement" data-entity="${entity}" data-id="${escapeHTML(row.id)}">كشف حساب</button>` : ""}${entity === "items" ? `<button class="small-button" data-action="item-prices" data-id="${escapeHTML(row.id)}">الأسعار</button>` : ""}<button class="small-button" data-action="edit-entity" data-entity="${entity}" data-id="${escapeHTML(row.id)}">تعديل</button><button class="small-button" data-action="delete-entity" data-entity="${entity}" data-id="${escapeHTML(row.id)}">حذف</button></div></td></tr>`).join("");
  return `<div class="table-wrap"><table><thead><tr>${head}<th>الإجراءات</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

function renderInvoices(type) {
  const title = type === "sales" ? "فواتير المبيعات" : "فواتير المشتريات";
  const rows = list(type).filter((row) => matchesFilter([row.number, row.partnerName, row.date, row.note, row.total])).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  pageContent.innerHTML = `
    ${pageHeading(title, "عرض ومتابعة الفواتير المسجلة.", `<button class="button button-primary" data-action="new-${type === "sales" ? "sale" : "purchase"}">＋ فاتورة جديدة</button>`)}
    <section class="card card-pad"><div class="toolbar"><input class="toolbar-search" data-filter placeholder="ابحث برقم الفاتورة أو اسم الجهة" value="${escapeHTML(state.filter)}" /><span class="muted">${number(rows.length)} فاتورة</span></div>${invoiceTable(rows, type)}</section>`;
}

function invoiceTable(rows, type, compact = false) {
  if (!rows.length) return `<div class="empty-state"><strong>لا توجد فواتير مسجلة</strong>ابدأ بإضافة أول فاتورة.</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>رقم الفاتورة</th><th>التاريخ</th><th>${type === "sales" ? "العميل" : "المورد"}</th><th>الإجمالي</th>${compact ? "" : "<th>المدفوع</th><th>المتبقي</th>"}<th>الحالة</th>${compact ? "" : "<th>تفاصيل</th>"}</tr></thead><tbody>${rows.map((row) => `<tr><td class="table-primary">${escapeHTML(row.number || "—")}</td><td>${escapeHTML(row.date || "—")}</td><td>${escapeHTML(row.partnerName || "نقدي")}</td><td>${money(row.total)}</td>${compact ? "" : `<td>${money(row.paid)}</td><td>${money(row.due)}</td>`}<td><span class="badge${Number(row.due) > 0 ? " warning" : ""}">${Number(row.due) > 0 ? "آجل" : "مكتملة"}</span></td>${compact ? "" : `<td><div class="row-actions"><button class="small-button" data-action="view-invoice" data-type="${type}" data-id="${escapeHTML(row.id)}">عرض</button><button class="small-button" data-action="print-invoice" data-mode="a4" data-type="${type}" data-id="${escapeHTML(row.id)}">طباعة</button><button class="small-button" data-action="print-invoice" data-mode="receipt" data-type="${type}" data-id="${escapeHTML(row.id)}">إيصال</button></div></td>`}</tr>`).join("")}</tbody></table></div>`;
}

function renderPayments() {
  const rows = [...list("payments")].filter((row) => matchesFilter([row.number, row.type, row.date, row.partyName, row.cashboxName, row.note, row.amount])).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  pageContent.innerHTML = `
    ${pageHeading("سندات القبض والصرف", "سجّل المقبوضات والمدفوعات وتابع حركة الخزينة.", `<button class="button button-primary" data-action="new-payment">＋ سند جديد</button>`)}
    <section class="card card-pad">${searchBar("ابحث برقم السند أو الجهة أو البيان", rows.length, "سند")}<div class="table-wrap">${rows.length ? `<table><thead><tr><th>رقم السند</th><th>النوع</th><th>التاريخ</th><th>الجهة</th><th>الخزينة</th><th>المبلغ</th><th>البيان</th></tr></thead><tbody>${rows.map((row) => `<tr><td class="table-primary">${escapeHTML(row.number)}</td><td><span class="badge${row.type === "صرف" ? " warning" : ""}">${escapeHTML(row.type)}</span></td><td>${escapeHTML(row.date)}</td><td>${escapeHTML(row.partyName || "—")}</td><td>${escapeHTML(row.cashboxName || "—")}</td><td>${money(row.amount)}</td><td>${escapeHTML(row.note || "—")}</td></tr>`).join("")}</tbody></table>` : `<div class="empty-state"><strong>لا توجد سندات</strong>أضف سند قبض أو صرف لتسجيل الحركة.</div>`}</div></section>`;
}

function renderExpenses() {
  const rows = [...list("expenses")].filter((row) => matchesFilter([row.number, row.date, row.typeName, row.description, row.cashboxName, row.total])).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const total = rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
  pageContent.innerHTML = `
    ${pageHeading("المصروفات", "سجّل مصروفات المنشأة وراجع تفاصيلها.", `<button class="button button-primary" data-action="new-expense">＋ تسجيل مصروف</button>`)}
    <div class="stock-summary"><div class="summary-chip"><span>إجمالي المصروفات المسجلة</span><strong>${money(total)}</strong></div><div class="summary-chip"><span>عدد المصروفات</span><strong>${number(rows.length)}</strong></div></div>
    <section class="card card-pad">${searchBar("ابحث بنوع المصروف أو التفاصيل", rows.length, "مصروف")}${rows.length ? `<div class="table-wrap"><table><thead><tr><th>رقم المصروف</th><th>التاريخ</th><th>النوع</th><th>التفاصيل</th><th>الإجمالي</th><th>الخزينة</th></tr></thead><tbody>${rows.map((row) => `<tr><td class="table-primary">${escapeHTML(row.number)}</td><td>${escapeHTML(row.date)}</td><td>${escapeHTML(row.typeName)}</td><td>${escapeHTML(row.description || "—")}</td><td>${money(row.total)}</td><td>${escapeHTML(row.cashboxName || "—")}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state"><strong>لا توجد مصروفات</strong>سجّل المصروفات لمتابعة تكاليف التشغيل.</div>`}</section>`;
}

function renderInventory() {
  const items = list("items");
  const stockValue = items.reduce((sum, row) => sum + Number(row.quantity || 0) * Number(row.costPrice || 0), 0);
  const moves = [...list("stockMoves")].filter((row) => matchesFilter([row.number, row.date, row.itemName, row.type, row.note])).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 50);
  pageContent.innerHTML = `
    ${pageHeading("حركة المخزون", "تابع أرصدة الأصناف وسجّل التسويات المخزنية.", `<button class="button button-primary" data-action="new-stock-move">＋ تسوية مخزون</button>`)}
    <div class="stock-summary"><div class="summary-chip"><span>عدد الأصناف</span><strong>${number(items.length)}</strong></div><div class="summary-chip"><span>قيمة المخزون بالتكلفة</span><strong>${money(stockValue)}</strong></div><div class="summary-chip"><span>حركات مسجلة</span><strong>${number(list("stockMoves").length)}</strong></div></div>
    <section class="card card-pad"><div class="card-title"><h3>آخر الحركات</h3></div>${searchBar("ابحث باسم الصنف أو نوع الحركة", moves.length, "حركة")}${moves.length ? `<div class="table-wrap"><table><thead><tr><th>رقم الحركة</th><th>التاريخ</th><th>الصنف</th><th>نوع الحركة</th><th>الكمية</th><th>البيان</th></tr></thead><tbody>${moves.map((row) => `<tr><td>${escapeHTML(row.number)}</td><td>${escapeHTML(row.date)}</td><td>${escapeHTML(row.itemName)}</td><td>${escapeHTML(row.type)}</td><td>${number(row.quantity)}</td><td>${escapeHTML(row.note || "—")}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state"><strong>لا توجد حركات مخزنية</strong>ستظهر هنا التسويات التي تسجلها.</div>`}</section>`;
}

function renderReports() {
  const report = state.report ? { ...state.report, rows: list(state.report.type).filter((row) => row.date >= state.report.from && row.date <= state.report.to).sort((a, b) => String(b.date).localeCompare(String(a.date))) } : null;
  pageContent.innerHTML = `
    ${pageHeading("مركز التقارير", "استعرض حركة المبيعات والمشتريات خلال فترة محددة.")}
    <section class="card card-pad">
      <form id="report-form" class="report-controls">
        <label>نوع التقرير<select name="type"><option value="sales"${selected("sales", report?.type || "sales")}>المبيعات</option><option value="purchases"${selected("purchases", report?.type)}>المشتريات</option><option value="expenses"${selected("expenses", report?.type)}>المصروفات</option><option value="returns"${selected("returns", report?.type)}>المرتجعات</option><option value="profit"${selected("profit", report?.type)}>الأرباح والخسائر</option><option value="itemsSales"${selected("itemsSales", report?.type)}>المبيعات حسب الصنف</option><option value="customersSales"${selected("customersSales", report?.type)}>المبيعات حسب العميل</option><option value="stock"${selected("stock", report?.type)}>تقرير المخزون</option><option value="payroll"${selected("payroll", report?.type)}>الرواتب</option><option value="vat"${selected("vat", report?.type)}>ضريبة القيمة المضافة</option><option value="cashbook"${selected("cashbook", report?.type)}>حركة الخزينة</option><option value="balances"${selected("balances", report?.type)}>أرصدة العملاء والموردين</option></select></label>
        <label>من تاريخ<input type="date" name="from" value="${report?.from || localDateValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}" required /></label>
        <label>إلى تاريخ<input type="date" name="to" value="${report?.to || isoToday()}" required /></label>
        <button class="button button-primary">عرض التقرير</button>
        ${report ? `<button type="button" class="button button-outline" data-action="print-report">طباعة</button>` : ""}
      </form>
      ${report ? reportMarkup(report) : `<div class="empty-state"><strong>اختر فترة التقرير</strong>حدد نوع التقرير والتواريخ ثم اضغط عرض التقرير.</div>`}
    </section>`;
}

function reportMarkup(report) {
  if (reportBuilders[report.type]) return reportBuilders[report.type](report);
  const rows = report.rows;
  const total = rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const tax = rows.reduce((sum, row) => sum + Number(row.vatAmount || 0), 0);
  const count = rows.length;
  const periodReturns = (report.type === "sales" || report.type === "purchases") ? list("returns").filter((row) => row.kind === report.type && row.date >= report.from && row.date <= report.to) : [];
  const returnsTotal = periodReturns.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const returnsProfit = report.type === "sales" ? periodReturns.reduce((sum, row) => sum + (row.lines || []).reduce((s, line) => s + Number(line.net || 0) - Number(line.costPrice || 0) * Number(line.quantity || 0), 0), 0) : 0;
  const returnChips = periodReturns.length || report.type === "sales" || report.type === "purchases" ? `<div class="summary-chip"><span>المرتجعات (${number(periodReturns.length)})</span><strong>${money(returnsTotal)}</strong></div><div class="summary-chip"><span>الصافي بعد المرتجعات</span><strong>${money(total - returnsTotal)}</strong></div>` : "";
  const profit = report.type === "sales" ? rows.reduce((sum, row) => sum + (row.lines || []).reduce((s, line) => s + Number(line.net || 0) - Number(line.costPrice || 0) * Number(line.quantity || 0), 0), 0) : null;
  const table = report.type === "expenses"
    ? `<div class="table-wrap"><table><thead><tr><th>رقم المصروف</th><th>التاريخ</th><th>النوع</th><th>التفاصيل</th><th>الضريبة</th><th>الإجمالي</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHTML(row.number)}</td><td>${escapeHTML(row.date)}</td><td>${escapeHTML(row.typeName)}</td><td>${escapeHTML(row.description || "—")}</td><td>${money(row.vatAmount)}</td><td>${money(row.total)}</td></tr>`).join("")}</tbody></table></div>`
    : report.type === "returns" ? returnsTable(rows) : invoiceTable(rows, report.type);
  return `<div id="report-output"><div class="stock-summary"><div class="summary-chip"><span>عدد المستندات</span><strong>${number(count)}</strong></div><div class="summary-chip"><span>الإجمالي</span><strong>${money(total)}</strong></div><div class="summary-chip"><span>ضريبة القيمة المضافة</span><strong>${money(tax)}</strong></div>${profit !== null ? `<div class="summary-chip"><span>الربح التقديري (قبل المصروفات)</span><strong>${money(profit - returnsProfit)}</strong></div>` : ""}${returnChips}</div>${rows.length ? trendChart(report) : ""}${rows.length ? table : `<div class="empty-state">لا توجد نتائج في الفترة المختارة.</div>`}</div>`;
}

// ================= المظهر والتنسيق =================
const CHART_COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#f43f5e", "#0ea5e9", "#8b5cf6", "#14b8a6", "#64748b"];
const THEME_KEY = "daftar.theme";
const THEME_DEFAULT = { primary: "#4f46e5", sidebar: "#1e1b4b", bg: "#f5f6fd", card: "#ffffff", ink: "#1f2340", fontScale: 1, font: "Cairo", radius: "medium", density: "normal" };
const THEME_PRESETS = [
  { id: "indigo", name: "نيلي (الافتراضي)", primary: "#4f46e5", sidebar: "#1e1b4b", bg: "#f5f6fd", card: "#ffffff", ink: "#1f2340" },
  { id: "emerald", name: "أخضر", primary: "#059669", sidebar: "#064e3b", bg: "#f3faf7", card: "#ffffff", ink: "#12332b" },
  { id: "ocean", name: "أزرق", primary: "#0369a1", sidebar: "#0c2d48", bg: "#f2f7fb", card: "#ffffff", ink: "#10283b" },
  { id: "amber", name: "برتقالي", primary: "#d9480f", sidebar: "#3b1f0e", bg: "#fbf7f2", card: "#ffffff", ink: "#33200f" },
  { id: "rose", name: "وردي", primary: "#be185d", sidebar: "#4a0d2b", bg: "#fcf4f8", card: "#ffffff", ink: "#3a1226" },
  { id: "slate", name: "رمادي هادئ", primary: "#334155", sidebar: "#0f172a", bg: "#f1f5f9", card: "#ffffff", ink: "#0f172a" },
  { id: "light-side", name: "قائمة فاتحة", primary: "#2563eb", sidebar: "#ffffff", bg: "#f4f6fb", card: "#ffffff", ink: "#1e293b" },
  { id: "dark", name: "داكن", primary: "#818cf8", sidebar: "#0b0c18", bg: "#11121f", card: "#1a1c2e", ink: "#e7e9f6" },
];
const THEME_FONTS = [
  { id: "Cairo", name: "Cairo (الافتراضي)", google: "Cairo:wght@400;500;600;700;800" },
  { id: "Tajawal", name: "Tajawal", google: "Tajawal:wght@400;500;700;800" },
  { id: "Almarai", name: "Almarai", google: "Almarai:wght@400;700;800" },
  { id: "IBM Plex Sans Arabic", name: "IBM Plex Sans Arabic", google: "IBM+Plex+Sans+Arabic:wght@400;500;600;700" },
  { id: "Noto Naskh Arabic", name: "Noto Naskh Arabic (نسخ)", google: "Noto+Naskh+Arabic:wght@400;500;600;700" },
  { id: "system", name: "خط النظام (Tahoma)", google: "" },
];
const THEME_RADIUS = { sharp: 0.3, medium: 1, round: 1.6 };
const THEME_DENSITY = { compact: [7, 10], normal: [11, 13], comfy: [15, 16] };
const THEME_COLOR_FIELDS = [["primary", "اللون الأساسي (الأزرار والتمييز)"], ["sidebar", "لون القائمة الجانبية"], ["bg", "لون خلفية الصفحة"], ["card", "لون البطاقات والجداول"], ["ink", "لون النص"]];

const isHexColor = (value) => /^#[0-9a-f]{6}$/i.test(String(value || ""));
const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrastRatio = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const darkenHex = (hex, amount) => `#${hexToRgb(hex).map((v) => Math.round(v * (1 - amount)).toString(16).padStart(2, "0")).join("")}`;

function sanitizeTheme(raw) {
  const t = { ...THEME_DEFAULT };
  if (raw && typeof raw === "object") {
    for (const [key] of THEME_COLOR_FIELDS) if (isHexColor(raw[key])) t[key] = String(raw[key]).toLowerCase();
    const scale = Number(raw.fontScale);
    if (Number.isFinite(scale)) t.fontScale = Math.min(1.4, Math.max(0.8, Math.round(scale * 100) / 100));
    if (THEME_FONTS.some((f) => f.id === raw.font)) t.font = raw.font;
    if (raw.radius in THEME_RADIUS) t.radius = raw.radius;
    if (raw.density in THEME_DENSITY) t.density = raw.density;
  }
  return t;
}
const readLocalTheme = () => {
  try { const parsed = JSON.parse(localStorage.getItem(THEME_KEY) || "null"); return parsed && typeof parsed === "object" ? parsed : null; } catch { return null; }
};
const writeLocalTheme = (value) => {
  try { if (value) localStorage.setItem(THEME_KEY, JSON.stringify(value)); else localStorage.removeItem(THEME_KEY); } catch { /* ignore */ }
};
const effectiveTheme = () => {
  const local = readLocalTheme();
  if (local?.scope === "device") return sanitizeTheme(local.theme);
  return sanitizeTheme(state.company.theme || local?.theme);
};
const themePrimary = () => state.themeApplied?.primary || THEME_DEFAULT.primary;
const printAccent = () => (luminance(themePrimary()) > 0.4 ? darkenHex(themePrimary(), 0.45) : themePrimary());

function ensureThemeFont(fontId) {
  const font = THEME_FONTS.find((f) => f.id === fontId);
  if (!font?.google || document.getElementById(`font-${font.google.split(":")[0]}`)) return;
  const link = document.createElement("link");
  link.id = `font-${font.google.split(":")[0]}`;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`;
  document.head.append(link);
}

function applyTheme(raw) {
  const t = sanitizeTheme(raw);
  const style = document.documentElement.style;
  style.setProperty("--primary", t.primary);
  style.setProperty("--sidebar", t.sidebar);
  style.setProperty("--bg", t.bg);
  style.setProperty("--card", t.card);
  style.setProperty("--ink", t.ink);
  style.setProperty("--on-primary", contrastRatio("#ffffff", t.primary) >= contrastRatio("#111827", t.primary) ? "#ffffff" : "#111827");
  style.setProperty("--sidebar-ink", luminance(t.sidebar) > 0.45 ? "#1e293b" : "#ffffff");
  style.setProperty("--fs", String(t.fontScale));
  style.setProperty("--r", String(THEME_RADIUS[t.radius]));
  style.setProperty("--cell-y", `${THEME_DENSITY[t.density][0]}px`);
  style.setProperty("--cell-x", `${THEME_DENSITY[t.density][1]}px`);
  ensureThemeFont(t.font);
  style.setProperty("--font", t.font === "system" ? `Tahoma, "Segoe UI", sans-serif` : t.font === "Cairo" ? `"Cairo", Tahoma, sans-serif` : `"${t.font}", "Cairo", Tahoma, sans-serif`);
  style.colorScheme = luminance(t.bg) < 0.25 ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t.primary);
  CHART_COLORS[0] = t.primary;
  state.themeApplied = t;
}

function readThemeForm(form) {
  const data = Object.fromEntries(new FormData(form));
  return sanitizeTheme({ ...data, fontScale: Number(data.fontScale) / 100 });
}

function themeHints(t) {
  const hints = [];
  if (contrastRatio(t.ink, t.card) < 4.5) hints.push("لون النص قريب من لون البطاقات، وقد يصعب قراءته.");
  if (contrastRatio(t.ink, t.bg) < 4.5) hints.push("لون النص قريب من لون الخلفية، وقد يصعب قراءته.");
  if (contrastRatio(t.primary, t.card) < 3) hints.push("اللون الأساسي قريب من لون البطاقات، وقد لا تظهر العناصر الملونة بوضوح.");
  return hints;
}

function renderThemeSection() {
  const t = state.themeDraft || effectiveTheme();
  const local = readLocalTheme();
  const scope = local?.scope === "device" ? "device" : "shared";
  const swatch = (p) => `<button type="button" class="theme-preset${p.primary === t.primary && p.sidebar === t.sidebar && p.bg === t.bg && p.card === t.card ? " active" : ""}" data-theme-preset="${p.id}" title="${escapeHTML(p.name)}"><span class="theme-swatch" style="background:${p.bg}"><i style="background:${p.sidebar}"></i><i style="background:${p.primary}"></i><i style="background:${p.card};box-shadow:inset 0 0 0 1px ${p.ink}33"></i></span><small>${escapeHTML(p.name)}</small></button>`;
  return `
    <section class="card card-pad settings-section" id="theme-section">
      <h3>المظهر والتنسيق</h3>
      <p class="muted theme-intro">اختر مظهرًا جاهزًا أو عدّل الألوان والخطوط بنفسك. التغيير يظهر فورًا على الشاشة، ولا يُحفظ إلا بعد الضغط على «حفظ المظهر».</p>
      <div class="theme-presets">${THEME_PRESETS.map(swatch).join("")}</div>
      <form id="theme-form">
        <div class="form-grid cols-3 theme-colors">${THEME_COLOR_FIELDS.map(([key, label]) => `<label class="color-field">${label}<span class="color-row"><input type="color" name="${key}" value="${t[key]}" /><output data-color-out="${key}">${t[key]}</output></span></label>`).join("")}</div>
        <div class="form-grid cols-3 theme-options">
          <label>حجم الخط <span class="range-row"><input type="range" name="fontScale" min="80" max="140" step="5" value="${Math.round(t.fontScale * 100)}" /><output data-scale-out>${Math.round(t.fontScale * 100)}%</output></span></label>
          <label>نوع الخط<select name="font">${THEME_FONTS.map((f) => `<option value="${escapeHTML(f.id)}"${selected(f.id, t.font)}>${escapeHTML(f.name)}</option>`).join("")}</select></label>
          <label>استدارة الزوايا<select name="radius"><option value="sharp"${selected("sharp", t.radius)}>حادة</option><option value="medium"${selected("medium", t.radius)}>متوسطة</option><option value="round"${selected("round", t.radius)}>دائرية</option></select></label>
          <label>كثافة الجداول<select name="density"><option value="compact"${selected("compact", t.density)}>مضغوطة (بيانات أكثر)</option><option value="normal"${selected("normal", t.density)}>عادية</option><option value="comfy"${selected("comfy", t.density)}>مريحة (مساحات أكبر)</option></select></label>
          <label class="span-2">يُطبَّق المظهر على<select name="scope"><option value="shared"${selected("shared", scope)}>جميع مستخدمي المنشأة</option><option value="device"${selected("device", scope)}>هذا الجهاز فقط (مثلًا خط أكبر للجوال)</option></select></label>
        </div>
        <div class="theme-preview" aria-hidden="true"><strong>معاينة</strong><button type="button" class="button button-primary" tabindex="-1">زر أساسي</button><button type="button" class="button button-outline" tabindex="-1">زر ثانوي</button><span class="badge">مكتملة</span><span class="badge warning">آجل</span><span class="badge danger">متأخر</span><input value="حقل إدخال" tabindex="-1" readonly /></div>
        <p class="modal-error" data-theme-hints>${themeHints(t).map(escapeHTML).join("<br>")}</p>
        <div class="heading-actions theme-actions"><button class="button button-primary">حفظ المظهر</button><button class="button button-outline" type="button" data-action="reset-theme">استعادة المظهر الافتراضي</button></div>
      </form>
    </section>`;
}

async function saveTheme(theme, scope) {
  if (scope === "shared") {
    await setDoc(doc(db, "settings", "company"), { theme }, { merge: true });
    state.company = { ...state.company, theme };
    writeLocalTheme({ scope: "shared", theme });
  } else {
    writeLocalTheme({ scope: "device", theme });
  }
  state.themeDirty = false;
  state.themeDraft = null;
  applyTheme(theme);
  syncThemeBar();
  showToast(scope === "shared" ? "تم حفظ المظهر لجميع المستخدمين." : "تم حفظ المظهر لهذا الجهاز فقط.");
}

const currentThemeScope = () => state.themeScope || (readLocalTheme()?.scope === "device" ? "device" : "shared");
function syncThemeBar() {
  const bar = document.querySelector("#theme-bar");
  if (bar) bar.classList.toggle("is-hidden", !(state.themeDirty && state.user));
}
async function discardThemeDraft() {
  state.themeDraft = null;
  state.themeDirty = false;
  applyTheme(effectiveTheme());
  syncThemeBar();
  renderPage();
}

function bindThemeEvents() {
  const liveUpdate = (event) => {
    const form = event.target.closest?.("#theme-form");
    if (!form) return;
    const theme = readThemeForm(form);
    state.themeDraft = theme;
    state.themeDirty = true;
    state.themeScope = form.elements.scope.value;
    applyTheme(theme);
    syncThemeBar();
    form.querySelectorAll("[data-color-out]").forEach((out) => { out.textContent = theme[out.dataset.colorOut]; });
    const scaleOut = form.querySelector("[data-scale-out]");
    if (scaleOut) scaleOut.textContent = `${Math.round(theme.fontScale * 100)}%`;
    form.querySelector("[data-theme-hints]").innerHTML = themeHints(theme).map(escapeHTML).join("<br>");
  };
  pageContent.addEventListener("input", liveUpdate);
  pageContent.addEventListener("change", liveUpdate);
  pageContent.addEventListener("click", (event) => {
    const preset = event.target.closest("[data-theme-preset]");
    if (preset) {
      const chosen = THEME_PRESETS.find((p) => p.id === preset.dataset.themePreset);
      const base = state.themeDraft || effectiveTheme();
      state.themeDraft = sanitizeTheme({ ...base, primary: chosen.primary, sidebar: chosen.sidebar, bg: chosen.bg, card: chosen.card, ink: chosen.ink });
      state.themeDirty = true;
      applyTheme(state.themeDraft);
      syncThemeBar();
      renderPage();
      return;
    }
    if (event.target.closest('[data-action="reset-theme"]')) {
      state.themeDraft = { ...THEME_DEFAULT };
      state.themeDirty = true;
      applyTheme(state.themeDraft);
      syncThemeBar();
      renderPage();
      showToast("تم تطبيق المظهر الافتراضي. اضغط «حفظ المظهر» لتثبيته.");
    }
  });
  document.querySelector("#theme-bar-save").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    setLoading(button, true);
    try {
      await saveTheme(state.themeDraft || effectiveTheme(), currentThemeScope());
      renderPage();
    } catch (error) {
      showToast(explainError(error), "error");
    }
    setLoading(button, false);
  });
  document.querySelector("#theme-bar-discard").addEventListener("click", discardThemeDraft);
  pageContent.addEventListener("submit", async (event) => {
    if (event.target.id !== "theme-form") return;
    event.preventDefault();
    const button = event.target.querySelector("button:not([type])");
    setLoading(button, true);
    try {
      await saveTheme(readThemeForm(event.target), event.target.elements.scope.value);
      renderPage();
    } catch (error) {
      showToast(explainError(error), "error");
      setLoading(button, false);
    }
  });
}

function renderSettings() {
  const company = state.company;
  pageContent.innerHTML = `
    ${pageHeading("الإعدادات", "بيانات المنشأة والضريبة والخزن والمخازن.")}
    <section class="card card-pad settings-section">
      <h3>بيانات المنشأة</h3>
      <form id="settings-form" class="form-grid cols-3">
        <label>اسم المنشأة<input name="name" value="${escapeHTML(company.name || "")}" required /></label>
        <label>الرقم الضريبي<input name="taxNumber" value="${escapeHTML(company.taxNumber || "")}" /></label>
        <label>العملة<input name="currency" value="${escapeHTML(company.currency || "ر.س")}" required /></label>
        <label>نسبة الضريبة %<input type="number" name="vatRate" min="0" max="100" step="0.01" value="${Number(company.vatRate ?? 15)}" required /></label>
        <label>رقم الجوال<input name="phone" type="tel" value="${escapeHTML(company.phone || "")}" /></label>
        <label>العنوان<input name="address" value="${escapeHTML(company.address || "")}" /></label>
        <label>عرض ورق الكاشير<select name="receiptWidth"><option value="80mm"${selected("80mm", company.receiptWidth || "80mm")}>80 مم</option><option value="58mm"${selected("58mm", company.receiptWidth)}>58 مم</option></select></label>
        <label class="span-2">نص أسفل الفاتورة المطبوعة<input name="printFooter" value="${escapeHTML(company.printFooter || "")}" placeholder="مثال: البضاعة المباعة لا ترد ولا تستبدل بعد 7 أيام" /></label>
        <div class="span-3"><button class="button button-primary">حفظ الإعدادات</button></div>
      </form>
    </section>
    ${renderThemeSection()}
    <section class="card card-pad settings-section"><h3>البيانات الأساسية</h3><div class="quick-actions">
      ${["cashboxes","warehouses","expenseTypes"].map((key) => `<button class="quick-action" data-action="manage-entity" data-entity="${key}"><span>＋</span><span><strong>${entityConfig[key].title}</strong><small>${number(list(key).length)} سجل</small></span></button>`).join("")}
    </div></section>
    <section class="card card-pad settings-section"><h3>النسخ الاحتياطي</h3><p class="muted">نزّل نسخة JSON من بياناتك الحالية أو استعد نسخة سابقة. احتفظ بنسخة آمنة خارج الجهاز.</p><div class="heading-actions"><button class="button button-outline" data-action="export-data">تنزيل نسخة احتياطية</button><label class="button button-outline file-button">استعادة نسخة<input type="file" accept="application/json,.json" data-action="import-data" hidden /></label></div></section>`;
}

function openEntityForm(entity, existing = null) {
  const config = entityConfig[entity];
  const fields = config.fields.map((field) => {
    if (entity === "items" && existing && field.key === "quantity") return "";
    const value = existing?.[field.key] ?? field.default ?? "";
    if (field.type === "checkbox") return `<label class="check-field"><input name="${field.key}" type="checkbox" ${value ? "checked" : ""} />${field.label}</label>`;
    if (field.type === "select") return `<label>${field.label}<select name="${field.key}">${(field.options || []).map((option) => `<option${selected(option, value)}>${escapeHTML(option)}</option>`).join("")}</select></label>`;
    const type = field.type || "text";
    return `<label>${field.label}<input name="${field.key}" type="${type}" value="${escapeHTML(value)}" ${field.required ? "required" : ""} ${field.min !== undefined ? `min="${field.min}"` : ""} ${field.max !== undefined ? `max="${field.max}"` : ""} ${type === "number" ? 'step="any"' : ""} /></label>`;
  }).join("");
  showModal(existing ? `تعديل ${config.title}` : config.add, `<form id="entity-form" class="form-grid">${fields}<p class="modal-error span-2" data-error></p><div class="span-2"><button class="button button-primary" type="submit">حفظ البيانات</button></div></form>`, { small: true });
  modalRoot.querySelector("#entity-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    setLoading(button, true);
    try {
      const data = Object.fromEntries(new FormData(form));
      for (const field of config.fields) if (field.type === "number" && data[field.key] !== undefined) data[field.key] = Number(data[field.key] || 0);
      for (const field of config.fields) if (field.type === "checkbox") data[field.key] = form.elements[field.key].checked;
      if (entity === "items") {
        data.vatRate = Number(data.vatRate ?? state.company.vatRate ?? 15);
        data.active = true;
      } else if (entity === "customers" || entity === "suppliers") {
        data.balance = Number(existing?.balance ?? data.openingBalance ?? 0);
        data.active = true;
      } else if (entity === "cashboxes") {
        data.balance = Number(existing?.balance ?? data.openingBalance ?? 0);
        data.active = true;
      } else if (entity === "employees") {
        data.active = data.status !== "موقوف";
      }
      const collectionRef = collection(db, config.collection);
      if (!existing) {
        const duplicate = list(config.collection).some((row) => String(row.code || "").toLowerCase() === String(data.code || "").toLowerCase() && data.code);
        if (duplicate) throw new Error("هذا الكود مستخدم بالفعل.");
        await setDoc(doc(collectionRef), data);
      } else {
        const duplicate = list(config.collection).some((row) => row.id !== existing.id && String(row.code || "").toLowerCase() === String(data.code || "").toLowerCase() && data.code);
        if (duplicate) throw new Error("هذا الكود مستخدم بالفعل.");
        await setDoc(doc(db, config.collection, existing.id), data, { merge: true });
      }
      closeModal();
      showToast("تم حفظ البيانات بنجاح.");
    } catch (error) {
      form.querySelector("[data-error]").textContent = explainError(error);
      setLoading(button, false);
    }
  });
}

function optionsFor(collectionName, selectedId, emptyLabel = "— اختر —") {
  const rows = list(collectionName);
  return `<option value="">${emptyLabel}</option>${rows.map((row) => `<option value="${escapeHTML(row.id)}"${selected(row.id, selectedId)}>${escapeHTML(row.name || row.code || row.id)}</option>`).join("")}`;
}

function openInvoice(type) {
  const isSale = type === "sales";
  const partnerCollection = isSale ? "customers" : "suppliers";
  const partnerLabel = isSale ? "العميل" : "المورد";
  if (!list("items").length) {
    showToast("أضف صنفًا واحدًا على الأقل قبل إنشاء الفاتورة.", "error");
    setPage("items");
    return;
  }
  const cashOptions = optionsFor("cashboxes", "", "بدون سداد الآن");
  const body = `
    <form id="invoice-form">
      <div class="form-grid cols-3">
        <label>التاريخ<input name="date" type="date" value="${isoToday()}" required /></label>
        <label>${partnerLabel}${comboHTML({ name: "partnerId", source: partnerCollection, placeholder: isSale ? "عميل نقدي — اكتب للبحث" : "اكتب للبحث عن المورد" })}</label>
        <label>المخزن<select name="warehouseId">${optionsFor("warehouses", "")}</select></label>
        <label>الخزينة / البنك<select name="cashboxId">${cashOptions}</select></label>
        <label>المدفوع الآن<input name="paid" type="number" min="0" step="0.01" value="0" /></label>
        <label class="span-2">ملاحظات<input name="note" /></label>
        <label>الطباعة بعد الحفظ<select name="printMode">${printOptions(getPrintPref())}</select></label>
      </div>
      <div class="invoice-lines"><div class="card-title"><h3>بنود الفاتورة</h3><button class="button button-outline" type="button" data-add-line>＋ إضافة صنف</button></div>
        <div class="table-wrap"><table><thead><tr><th>الصنف</th><th>الكمية</th><th>السعر قبل الضريبة</th><th>خصم %</th><th>الإجمالي شامل الضريبة</th><th></th></tr></thead><tbody data-lines></tbody></table></div>
      </div>
      <div class="totals-box"><div class="total-row"><span>قبل الضريبة</span><strong data-subtotal>0.00</strong></div><div class="total-row"><span>الضريبة</span><strong data-tax>0.00</strong></div><div class="total-row grand"><span>الإجمالي</span><strong data-total>0.00</strong></div><div class="total-row"><span>المتبقي</span><strong data-due>0.00</strong></div></div>
      <p class="modal-error" data-error></p>
    </form>`;
  showModal(isSale ? "فاتورة مبيعات جديدة" : "فاتورة مشتريات جديدة", body, { footer: `<button class="button button-primary" form="invoice-form" type="submit">حفظ الفاتورة</button><button class="button button-outline" type="button" data-close-modal>إلغاء</button>` });
  const form = modalRoot.querySelector("#invoice-form");
  const lines = form.querySelector("[data-lines]");

  const lineItem = (row) => list("items").find((entry) => entry.id === row.querySelector(".line-item").value);
  function addLine(focus = false) {
    const row = document.createElement("tr");
    row.innerHTML = `<td data-label="الصنف">${comboHTML({ source: "items", className: "line-item", placeholder: "ابحث بالاسم أو الكود أو الباركود" })}<div class="price-hint"></div></td><td data-label="الكمية"><input class="line-qty" type="number" min="0.001" step="any" value="1" required inputmode="decimal" /></td><td data-label="السعر"><input class="line-price" type="number" min="0" step="0.01" value="0" required inputmode="decimal" /></td><td data-label="خصم %"><input class="line-discount" type="number" min="0" max="100" step="0.01" value="0" inputmode="decimal" /></td><td class="line-total" data-label="الإجمالي">0.00</td><td class="line-actions"><button class="small-button" type="button" data-remove-line>حذف</button></td>`;
    lines.append(row);
    updateLine(row);
    if (focus) row.querySelector(".combo-input").focus();
  }
  function updateLine(row, itemChanged = false) {
    const item = lineItem(row);
    if (itemChanged && item) {
      const partnerId = form.elements.partnerId.value;
      const mine = isSale && partnerId ? saleHistory(item.id).find((entry) => entry.partnerId === partnerId) : null;
      row.querySelector(".line-price").value = mine ? mine.price : (Number(isSale ? item.salePrice : item.costPrice) || 0);
      if (isSale) row.querySelector(".price-hint").innerHTML = priceHintHTML(item.id, partnerId);
    }
    const qty = Number(row.querySelector(".line-qty").value || 0);
    const price = Number(row.querySelector(".line-price").value || 0);
    const discount = Math.min(100, Math.max(0, Number(row.querySelector(".line-discount").value || 0)));
    const rate = Number(item?.vatRate ?? state.company.vatRate ?? 15) / 100;
    const net = roundMoney(qty * price * (1 - discount / 100));
    row.querySelector(".line-total").textContent = (net + roundMoney(net * rate)).toFixed(2);
    updateTotals();
  }
  function updateTotals() {
    let subtotal = 0;
    let tax = 0;
    [...lines.querySelectorAll("tr")].forEach((row) => {
      const item = lineItem(row);
      const net = roundMoney(Number(row.querySelector(".line-qty").value || 0) * Number(row.querySelector(".line-price").value || 0) * (1 - Number(row.querySelector(".line-discount").value || 0) / 100));
      subtotal += net;
      tax += roundMoney(net * Number(item?.vatRate ?? state.company.vatRate ?? 15) / 100);
    });
    const total = subtotal + tax;
    const paid = Number(form.elements.paid.value || 0);
    form.querySelector("[data-subtotal]").textContent = subtotal.toFixed(2);
    form.querySelector("[data-tax]").textContent = tax.toFixed(2);
    form.querySelector("[data-total]").textContent = total.toFixed(2);
    form.querySelector("[data-due]").textContent = Math.max(0, total - paid).toFixed(2);
  }
  form.querySelector("[data-add-line]").addEventListener("click", () => addLine(true));
  form.addEventListener("keydown", (event) => { if (event.key === "Enter" && event.target.matches("input")) event.preventDefault(); });
  lines.addEventListener("change", (event) => {
    const row = event.target.closest("tr");
    if (!row) return;
    const isItem = event.target.matches(".line-item");
    updateLine(row, isItem);
    if (isItem && event.target.value) row.querySelector(".line-qty").select();
  });
  lines.addEventListener("input", (event) => {
    const row = event.target.closest("tr");
    if (row) updateLine(row);
  });
  lines.addEventListener("click", (event) => {
    if (event.target.matches("[data-remove-line]")) {
      event.target.closest("tr").remove();
      updateTotals();
    }
  });
  form.elements.paid.addEventListener("input", updateTotals);
  if (isSale) {
    form.addEventListener("change", (event) => {
      if (event.target.name !== "partnerId") return;
      lines.querySelectorAll("tr").forEach((row) => {
        const item = list("items").find((entry) => entry.id === row.querySelector(".line-item").value);
        row.querySelector(".price-hint").innerHTML = item ? priceHintHTML(item.id, event.target.value) : "";
      });
    });
  }
  addLine();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = modalRoot.querySelector('[form="invoice-form"]');
    setLoading(button, true);
    try {
      const partnerId = form.elements.partnerId.value;
      const partner = list(partnerCollection).find((row) => row.id === partnerId);
      const cashboxId = form.elements.cashboxId.value;
      const cashbox = list("cashboxes").find((row) => row.id === cashboxId);
      const itemLines = [...lines.querySelectorAll("tr")].map((row) => {
        const item = list("items").find((entry) => entry.id === row.querySelector(".line-item").value);
        if (!item) throw new Error("اختر صنفًا صحيحًا لكل بند.");
        const qty = Number(row.querySelector(".line-qty").value);
        const price = Number(row.querySelector(".line-price").value);
        const discountRate = Number(row.querySelector(".line-discount").value || 0);
        if (!(qty > 0) || price < 0 || discountRate < 0 || discountRate > 100) throw new Error("تحقق من الكمية والسعر ونسبة الخصم.");
        const net = roundMoney(qty * price * (1 - discountRate / 100));
        const vatRate = Number(item.vatRate ?? state.company.vatRate ?? 15);
        const vatLine = roundMoney(net * vatRate / 100);
        return { itemId: item.id, itemName: item.name, code: item.code || "", quantity: qty, price, discountRate, net, vatRate, vatAmount: vatLine, total: roundMoney(net + vatLine), costPrice: Number(item.costPrice || 0) };
      });
      if (!itemLines.length) throw new Error("أضف بندًا واحدًا على الأقل.");
      const subtotal = roundMoney(itemLines.reduce((sum, line) => sum + line.net, 0));
      const vatAmount = roundMoney(itemLines.reduce((sum, line) => sum + line.vatAmount, 0));
      const total = roundMoney(subtotal + vatAmount);
      const paid = Number(form.elements.paid.value || 0);
      if (paid < 0 || paid > total + 0.01) throw new Error("المبلغ المدفوع يجب أن يكون بين صفر وإجمالي الفاتورة.");
      if (paid > 0 && !cashboxId) throw new Error("اختر الخزينة التي استلمت أو دفعت المبلغ.");
      if (total - paid > 0.01 && !partner) throw new Error(`اختر ${partnerLabel} عند وجود مبلغ آجل.`);
      const saved = await saveInvoice(type, {
        date: form.elements.date.value,
        partnerId: partner?.id || "",
        partnerName: partner?.name || "نقدي",
        cashboxId,
        cashboxName: cashbox?.name || "",
        warehouseId: form.elements.warehouseId.value,
        lines: itemLines,
        subtotal,
        vatAmount,
        total,
        paid,
        due: Math.max(0, total - paid),
        note: form.elements.note.value.trim(),
      });
      const printMode = form.elements.printMode.value;
      setPrintPref(printMode);
      closeModal();
      showToast("تم حفظ الفاتورة وتحديث الأرصدة والمخزون.");
      if (printMode) printDocument(saved, type, printMode);
    } catch (error) {
      form.querySelector("[data-error]").textContent = explainError(error);
      setLoading(button, false);
    }
  });
}

async function saveInvoice(type, data) {
  const collectionName = type;
  const counterName = type === "sales" ? "sales" : "purchases";
  const prefix = type === "sales" ? "INV" : "PUR";
  const isSale = type === "sales";
  const partnerCollection = isSale ? "customers" : "suppliers";
  const partnerDelta = data.due;
  const counterRef = doc(db, "counters", counterName);
  const partnerRef = data.partnerId ? doc(db, partnerCollection, data.partnerId) : null;
  const cashboxRef = data.cashboxId ? doc(db, "cashboxes", data.cashboxId) : null;
  const itemRefs = [...new Set(data.lines.map((line) => line.itemId))].map((id) => doc(db, "items", id));
  const invoiceRef = doc(collection(db, collectionName));
  let savedInvoice = null;
  await runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    const partnerSnap = partnerRef ? await transaction.get(partnerRef) : null;
    const cashboxSnap = cashboxRef ? await transaction.get(cashboxRef) : null;
    const itemSnaps = [];
    for (const itemRef of itemRefs) itemSnaps.push(await transaction.get(itemRef));
    if (partnerRef && !partnerSnap.exists()) throw new Error(`${isSale ? "العميل" : "المورد"} غير موجود.`);
    if (cashboxRef && !cashboxSnap.exists()) throw new Error("الخزينة المحددة غير موجودة.");
    for (const snap of itemSnaps) if (!snap.exists()) throw new Error("أحد الأصناف في الفاتورة لم يعد موجودًا.");
    const itemRecords = new Map(itemSnaps.map((snap) => [snap.id, snap.data()]));
    const quantities = new Map();
    data.lines.forEach((line) => quantities.set(line.itemId, (quantities.get(line.itemId) || 0) + line.quantity));
    if (isSale) {
      for (const [itemId, quantity] of quantities) {
        const item = itemRecords.get(itemId);
        if (item.trackInventory !== false && Number(item.quantity || 0) < quantity) throw new Error(`الرصيد غير كافٍ للصنف: ${item.name}`);
      }
    }
    const nextNumber = Number(counterSnap.data()?.value || 0) + 1;
    const numberText = `${prefix}-${String(nextNumber).padStart(5, "0")}`;
    const invoice = { ...data, number: numberText, createdAt: new Date().toISOString(), createdBy: state.user.email };
    transaction.set(invoiceRef, invoice);
    savedInvoice = { ...invoice, id: invoiceRef.id };
    transaction.set(counterRef, { value: nextNumber }, { merge: true });
    for (const [itemId, quantity] of quantities) {
      const item = itemRecords.get(itemId);
      if (item.trackInventory === false) continue;
      transaction.set(doc(collection(db, "stockMoves")), {
        number: numberText, date: data.date, itemId, itemName: item.name,
        type: isSale ? "بيع" : "شراء", quantity, costPrice: Number(item.costPrice || 0),
        note: `فاتورة ${isSale ? "مبيعات" : "مشتريات"} ${numberText}`,
        createdAt: invoice.createdAt, createdBy: state.user.email,
      });
      if (isSale) {
        transaction.update(doc(db, "items", itemId), { quantity: Number(item.quantity || 0) - quantity });
      } else {
        const previousQty = Number(item.quantity || 0);
        const newQty = previousQty + quantity;
        const weightedCost = (previousQty * Number(item.costPrice || 0) + quantity * data.lines.filter((line) => line.itemId === itemId).reduce((sum, line) => sum + line.net, 0)) / (newQty || 1);
        transaction.update(doc(db, "items", itemId), { quantity: newQty, costPrice: weightedCost });
      }
    }
    if (partnerRef && partnerDelta > 0) transaction.update(partnerRef, { balance: Number(partnerSnap.data().balance ?? partnerSnap.data().openingBalance ?? 0) + partnerDelta });
    if (cashboxRef && data.paid > 0) {
      const sign = isSale ? 1 : -1;
      transaction.update(cashboxRef, { balance: Number(cashboxSnap.data().balance ?? cashboxSnap.data().openingBalance ?? 0) + sign * data.paid });
    }
  });
  return savedInvoice;
}

function openPaymentForm() {
  const footer = `<button class="button button-primary" form="payment-form" type="submit">حفظ السند</button><button class="button button-outline" type="button" data-close-modal>إلغاء</button>`;
  const body = `<form id="payment-form" class="form-grid">
    <label>نوع السند<select name="type"><option>قبض</option><option>صرف</option></select></label>
    <label>التاريخ<input name="date" type="date" value="${isoToday()}" required /></label>
    <label>الخزينة / البنك<select name="cashboxId" required>${optionsFor("cashboxes", "", "اختر الخزينة")}</select></label>
    <label>الجهة<select name="partyType"><option value="">جهة أخرى</option><option value="customers">عميل</option><option value="suppliers">مورد</option></select></label>
    <label>اسم الجهة${comboHTML({ name: "partyId", source: "none", placeholder: "اختر نوع الجهة أولًا" })}</label>
    <label>المبلغ<input name="amount" type="number" min="0.01" step="0.01" required /></label>
    <label class="span-2">البيان<input name="note" /></label>
    <p class="modal-error span-2" data-error></p>
  </form>`;
  showModal("سند قبض أو صرف", body, { small: true, footer });
  const form = modalRoot.querySelector("#payment-form");
  const partyCombo = form.querySelector("[data-combo]");
  const syncPartyCombo = () => {
    const source = form.elements.partyType.value || "none";
    const input = partyCombo.querySelector(".combo-input");
    partyCombo.dataset.source = source;
    input.value = "";
    partyCombo.querySelector(".combo-value").value = "";
    input.disabled = source === "none";
    input.placeholder = source === "none" ? "اختر نوع الجهة أولًا" : "اكتب للبحث (اختياري)";
  };
  form.elements.partyType.addEventListener("change", syncPartyCombo);
  syncPartyCombo();
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = modalRoot.querySelector('[form="payment-form"]');
    setLoading(button, true);
    try {
      const cashboxId = form.elements.cashboxId.value;
      const amount = Number(form.elements.amount.value);
      if (!(amount > 0)) throw new Error("أدخل مبلغًا أكبر من صفر.");
      const type = form.elements.type.value;
      const cashbox = list("cashboxes").find((row) => row.id === cashboxId);
      const partyType = form.elements.partyType.value;
      const party = partyType ? list(partyType).find((row) => row.id === form.elements.partyId.value) : null;
      const counterRef = doc(db, "counters", "payments");
      const paymentRef = doc(collection(db, "payments"));
      const cashboxRef = doc(db, "cashboxes", cashboxId);
      const partyRef = party ? doc(db, partyType, party.id) : null;
      await runTransaction(db, async (transaction) => {
        const counterSnap = await transaction.get(counterRef);
        const cashSnap = await transaction.get(cashboxRef);
        const partySnap = partyRef ? await transaction.get(partyRef) : null;
        if (!cashSnap.exists()) throw new Error("الخزينة المحددة غير موجودة.");
        if (partyRef && !partySnap.exists()) throw new Error("الجهة المحددة غير موجودة.");
        const next = Number(counterSnap.data()?.value || 0) + 1;
        transaction.set(counterRef, { value: next }, { merge: true });
        transaction.set(paymentRef, {
          number: `VCH-${String(next).padStart(5, "0")}`,
          type, date: form.elements.date.value, amount, cashboxId,
          cashboxName: cashbox?.name || "",
          partyId: party?.id || "", partyName: party?.name || "",
          partyType, note: form.elements.note.value.trim(),
          createdAt: new Date().toISOString(), createdBy: state.user.email,
        });
        const sign = type === "قبض" ? 1 : -1;
        transaction.update(cashboxRef, { balance: Number(cashSnap.data().balance ?? cashSnap.data().openingBalance ?? 0) + sign * amount });
        if (partyRef && partySnap.exists()) {
          const balanceSign = partyType === "customers" ? (type === "قبض" ? -1 : 1) : (type === "صرف" ? -1 : 1);
          transaction.update(partyRef, { balance: Number(partySnap.data().balance ?? partySnap.data().openingBalance ?? 0) + balanceSign * amount });
        }
      });
      closeModal();
      showToast("تم حفظ السند وتحديث رصيد الخزينة.");
    } catch (error) {
      form.querySelector("[data-error]").textContent = explainError(error);
      setLoading(button, false);
    }
  });
}

function openExpenseForm() {
  const body = `<form id="expense-form" class="form-grid">
    <label>التاريخ<input name="date" type="date" value="${isoToday()}" required /></label>
    <label>نوع المصروف<select name="typeId"><option value="">مصروف عام</option>${list("expenseTypes").map((row) => `<option value="${escapeHTML(row.id)}">${escapeHTML(row.name)}</option>`).join("")}</select></label>
    <label class="span-2">التفاصيل<input name="description" required /></label>
    <label>المبلغ قبل الضريبة<input name="amount" type="number" min="0.01" step="0.01" required /></label>
    <label>نسبة الضريبة %<input name="vatRate" type="number" min="0" max="100" step="0.01" value="${Number(state.company.vatRate || 15)}" /></label>
    <label>الخزينة / البنك<select name="cashboxId" required>${optionsFor("cashboxes", "", "اختر الخزينة")}</select></label>
    <label>رقم فاتورة المورد<input name="supplierInvoice" /></label>
    <p class="modal-error span-2" data-error></p>
  </form>`;
  showModal("تسجيل مصروف", body, { small: true, footer: `<button class="button button-primary" form="expense-form" type="submit">حفظ المصروف</button><button class="button button-outline" type="button" data-close-modal>إلغاء</button>` });
  const form = modalRoot.querySelector("#expense-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = modalRoot.querySelector('[form="expense-form"]');
    setLoading(button, true);
    try {
      const amount = Number(form.elements.amount.value);
      const rate = Number(form.elements.vatRate.value || 0);
      const cashbox = list("cashboxes").find((row) => row.id === form.elements.cashboxId.value);
      if (!(amount > 0) || rate < 0 || rate > 100) throw new Error("تحقق من المبلغ ونسبة الضريبة.");
      if (!cashbox) throw new Error("اختر الخزينة التي صُرف منها المبلغ.");
      const type = list("expenseTypes").find((row) => row.id === form.elements.typeId.value);
      const vatAmount = roundMoney(amount * rate / 100);
      const total = roundMoney(amount + vatAmount);
      const counterRef = doc(db, "counters", "expenses");
      const expenseRef = doc(collection(db, "expenses"));
      const cashRef = doc(db, "cashboxes", cashbox.id);
      await runTransaction(db, async (transaction) => {
        const [counterSnap, cashSnap] = await Promise.all([transaction.get(counterRef), transaction.get(cashRef)]);
        if (!cashSnap.exists()) throw new Error("الخزينة المحددة غير موجودة.");
        const next = Number(counterSnap.data()?.value || 0) + 1;
        transaction.set(counterRef, { value: next }, { merge: true });
        transaction.set(expenseRef, {
          number: `EXP-${String(next).padStart(5, "0")}`, date: form.elements.date.value,
          typeName: type?.name || "مصروف عام", description: form.elements.description.value.trim(),
          amount, vatAmount, total, cashboxId: cashbox.id, cashboxName: cashbox.name,
          supplierInvoice: form.elements.supplierInvoice.value.trim(),
          createdAt: new Date().toISOString(), createdBy: state.user.email,
        });
        transaction.update(cashRef, { balance: Number(cashSnap.data().balance ?? cashSnap.data().openingBalance ?? 0) - total });
      });
      closeModal();
      showToast("تم تسجيل المصروف وخصمه من الخزينة.");
    } catch (error) {
      form.querySelector("[data-error]").textContent = explainError(error);
      setLoading(button, false);
    }
  });
}

function openStockMoveForm() {
  if (!list("items").length) {
    showToast("أضف صنفًا قبل تسجيل حركة مخزنية.", "error");
    setPage("items");
    return;
  }
  const body = `<form id="stock-form" class="form-grid">
    <label>التاريخ<input name="date" type="date" value="${isoToday()}" required /></label>
    <label>نوع الحركة<select name="type"><option value="زيادة">زيادة مخزون</option><option value="تسوية نقص">تسوية نقص</option></select></label>
    <label class="span-2">الصنف${comboHTML({ name: "itemId", source: "items", placeholder: "ابحث بالاسم أو الكود أو الباركود" })}</label>
    <label>الكمية<input name="quantity" type="number" min="0.001" step="any" required /></label>
    <label>التكلفة للوحدة<input name="costPrice" type="number" min="0" step="0.01" /></label>
    <label class="span-2">البيان<input name="note" /></label>
    <p class="modal-error span-2" data-error></p>
  </form>`;
  showModal("تسوية مخزون", body, { small: true, footer: `<button class="button button-primary" form="stock-form" type="submit">حفظ الحركة</button><button class="button button-outline" type="button" data-close-modal>إلغاء</button>` });
  const form = modalRoot.querySelector("#stock-form");
  form.elements.itemId.addEventListener("change", () => {
    const item = list("items").find((row) => row.id === form.elements.itemId.value);
    form.elements.costPrice.value = item?.costPrice || 0;
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = modalRoot.querySelector('[form="stock-form"]');
    setLoading(button, true);
    try {
      const item = list("items").find((row) => row.id === form.elements.itemId.value);
      const quantity = Number(form.elements.quantity.value);
      const type = form.elements.type.value;
      const costPrice = Number(form.elements.costPrice.value || 0);
      if (!item || !(quantity > 0)) throw new Error("اختر صنفًا وأدخل كمية صحيحة.");
      const moveRef = doc(collection(db, "stockMoves"));
      const itemRef = doc(db, "items", item.id);
      await runTransaction(db, async (transaction) => {
        const itemSnap = await transaction.get(itemRef);
        if (!itemSnap.exists()) throw new Error("الصنف المحدد غير موجود.");
        const currentQty = Number(itemSnap.data().quantity || 0);
        if (type === "تسوية نقص" && quantity > currentQty) throw new Error("لا يمكن صرف كمية أكبر من الرصيد الحالي.");
        const nextQty = currentQty + (type === "زيادة" ? quantity : -quantity);
        const oldCost = Number(itemSnap.data().costPrice || 0);
        const avgCost = type === "زيادة" && costPrice > 0 ? roundMoney((currentQty * oldCost + quantity * costPrice) / (nextQty || 1)) : oldCost;
        transaction.update(itemRef, { quantity: nextQty, costPrice: avgCost });
        transaction.set(moveRef, {
          number: makeCode("STK"), date: form.elements.date.value, itemId: item.id,
          itemName: item.name, type, quantity, costPrice, note: form.elements.note.value.trim(),
          createdAt: new Date().toISOString(), createdBy: state.user.email,
        });
      });
      closeModal();
      showToast("تم تسجيل الحركة وتحديث رصيد الصنف.");
    } catch (error) {
      form.querySelector("[data-error]").textContent = explainError(error);
      setLoading(button, false);
    }
  });
}

function viewInvoice(type, id) {
  const invoice = list(type).find((row) => row.id === id);
  if (!invoice) return;
  const rows = invoice.lines || [];
  showModal(`تفاصيل الفاتورة ${invoice.number}`, `
    <div class="stock-summary"><div class="summary-chip"><span>التاريخ</span><strong>${escapeHTML(invoice.date)}</strong></div><div class="summary-chip"><span>${type === "sales" ? "العميل" : "المورد"}</span><strong>${escapeHTML(invoice.partnerName)}</strong></div><div class="summary-chip"><span>الحالة</span><strong>${Number(invoice.due) > 0 ? "آجل" : "مكتملة"}</strong></div></div>
    <div class="table-wrap"><table><thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الضريبة</th><th>الإجمالي</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHTML(row.itemName)}</td><td>${number(row.quantity)}</td><td>${money(row.price)}</td><td>${money(row.vatAmount)}</td><td>${money(row.total)}</td></tr>`).join("")}</tbody></table></div>
    <div class="totals-box"><div class="total-row"><span>قبل الضريبة</span><strong>${money(invoice.subtotal)}</strong></div><div class="total-row"><span>الضريبة</span><strong>${money(invoice.vatAmount)}</strong></div><div class="total-row grand"><span>الإجمالي</span><strong>${money(invoice.total)}</strong></div><div class="total-row"><span>المدفوع</span><strong>${money(invoice.paid)}</strong></div><div class="total-row"><span>المتبقي</span><strong>${money(invoice.due)}</strong></div></div>
    ${invoice.note ? `<p class="muted">${escapeHTML(invoice.note)}</p>` : ""}`, { small: true, footer: printButtons() });
  bindPrintButtons((mode) => printDocument(invoice, type, mode));
}

async function deleteEntity(entity, id) {
  const config = entityConfig[entity];
  const row = list(config.collection).find((item) => item.id === id);
  if (!row || !window.confirm(`هل تريد حذف "${row.name || row.code}"؟`)) return;
  try {
    const linked = entity === "items"
    ? [...list("sales"), ...list("purchases"), ...list("returns")].some((invoice) => (invoice.lines || []).some((line) => line.itemId === id)) || list("stockMoves").some((move) => move.itemId === id)
    : entity === "customers"
      ? [...list("sales"), ...list("payments"), ...list("returns")].some((record) => record.partnerId === id || record.partyId === id)
      : entity === "suppliers"
        ? [...list("purchases"), ...list("payments"), ...list("returns")].some((record) => record.partnerId === id || record.partyId === id)
        : entity === "cashboxes"
          ? [...list("sales"), ...list("purchases"), ...list("expenses"), ...list("payments"), ...list("returns")].some((record) => record.cashboxId === id)
          : entity === "warehouses"
            ? [...list("sales"), ...list("purchases")].some((invoice) => invoice.warehouseId === id)
            : entity === "employees"
              ? list("payroll").some((row) => row.employeeId === id)
              : false;
    if (linked) {
    throw new Error("لا يمكن حذف سجل مرتبط بفواتير سابقة.");
    }
    const snapshot = await getDoc(doc(db, config.collection, id));
    if (entity === "items" && Number(snapshot.data()?.quantity || 0) !== 0) throw new Error("لا يمكن حذف صنف له رصيد مخزني؛ استخدم تسوية المخزون أولًا.");
    await deleteDoc(doc(db, config.collection, id));
    showToast("تم حذف السجل.");
  } catch (error) {
    showToast(explainError(error), "error");
  }
}

function bindPageEvents() {
  pageContent.addEventListener("click", (event) => {
    const pageButton = event.target.closest("[data-page]");
    if (pageButton && titles[pageButton.dataset.page]) {
      setPage(pageButton.dataset.page);
      return;
    }
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "new-sale") openInvoice("sales");
    if (action === "new-purchase") openInvoice("purchases");
    if (action === "add-entity") openEntityForm(button.dataset.entity);
    if (action === "edit-entity") {
      const row = list(entityConfig[button.dataset.entity].collection).find((entry) => entry.id === button.dataset.id);
      if (row) openEntityForm(button.dataset.entity, row);
    }
    if (action === "delete-entity") deleteEntity(button.dataset.entity, button.dataset.id);
    if (action === "view-invoice") viewInvoice(button.dataset.type, button.dataset.id);
    if (action === "new-payment") openPaymentForm();
    if (action === "new-expense") openExpenseForm();
    if (action === "new-stock-move") openStockMoveForm();
    if (action === "manage-entity") openEntityManager(button.dataset.entity);
    if (action === "export-data") exportData();
    if (action === "new-sale-return") openReturnForm("sales");
    if (action === "new-purchase-return") openReturnForm("purchases");
    if (action === "view-return") viewReturn(button.dataset.id);
    if (action === "print-invoice") {
      const invoice = list(button.dataset.type).find((entry) => entry.id === button.dataset.id);
      if (invoice) printDocument(invoice, button.dataset.type, button.dataset.mode);
    }
    if (action === "print-return") {
      const ret = list("returns").find((entry) => entry.id === button.dataset.id);
      if (ret) printDocument(ret, ret.kind === "sales" ? "salesReturn" : "purchaseReturn", button.dataset.mode);
    }
    if (action === "item-prices") viewItemPrices(button.dataset.id);
    if (action === "new-payroll") openPayrollForm();
    if (action === "print-payslip") {
      const slip = list("payroll").find((entry) => entry.id === button.dataset.id);
      if (slip) printPayslip(slip);
    }
    if (action === "cancel-payroll") cancelPayroll(button.dataset.id);
    if (action === "open-statement") {
      state.statement = { type: button.dataset.entity, partyId: button.dataset.id, from: `${new Date().getFullYear()}-01-01`, to: isoToday() };
      setPage("statements");
    }
    if (action === "print-report") window.print();
  });
  pageContent.addEventListener("input", (event) => {
    if (event.target.matches("[data-filter]")) {
      const cursor = event.target.selectionStart;
      state.filter = event.target.value;
      renderPage();
      const input = pageContent.querySelector("[data-filter]");
      input?.focus();
      input?.setSelectionRange(cursor, cursor);
    }
  });
  pageContent.addEventListener("submit", async (event) => {
    if (event.target.id === "settings-form") {
      event.preventDefault();
      const form = event.target;
      const button = form.querySelector("button");
      setLoading(button, true);
      try {
        const data = Object.fromEntries(new FormData(form));
        data.vatRate = Number(data.vatRate);
        await setDoc(doc(db, "settings", "company"), data, { merge: true });
        state.company = { ...state.company, ...data };
        renderPage();
        showToast("تم حفظ إعدادات المنشأة.");
      } catch (error) {
        showToast(explainError(error), "error");
        setLoading(button, false);
      }
    }
    if (event.target.id === "report-form") {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.target));
      if (data.from > data.to) {
        showToast("تاريخ البداية يجب أن يسبق تاريخ النهاية.", "error");
        return;
      }
      const rows = list(data.type).filter((row) => row.date >= data.from && row.date <= data.to);
      state.report = { type: data.type, from: data.from, to: data.to, rows };
      renderPage();
    }
  });
  pageContent.addEventListener("change", (event) => {
    if (event.target.matches('[data-action="import-data"]')) { const input = event.target; importData(input.files?.[0]).finally(() => { input.value = ""; }); }
  });
}

function returnsTable(rows) {
  if (!rows.length) return `<div class="empty-state"><strong>لا توجد مرتجعات</strong>سجّل مرتجع مبيعات أو مشتريات عند الحاجة.</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>رقم المرتجع</th><th>النوع</th><th>التاريخ</th><th>الجهة</th><th>الفاتورة الأصلية</th><th>الإجمالي</th><th>المردود نقدًا</th><th>الأثر على الرصيد</th><th>تفاصيل</th></tr></thead><tbody>${rows.map((row) => `<tr><td class="table-primary">${escapeHTML(row.number)}</td><td><span class="badge${row.kind === "sales" ? " warning" : ""}">${row.kind === "sales" ? "مرتجع مبيعات" : "مرتجع مشتريات"}</span></td><td>${escapeHTML(row.date)}</td><td>${escapeHTML(row.partnerName || "نقدي")}</td><td>${escapeHTML(row.originalNumber || "—")}</td><td>${money(row.total)}</td><td>${money(row.refunded)}</td><td>${money(row.balanceEffect)}</td><td><div class="row-actions"><button class="small-button" data-action="view-return" data-id="${escapeHTML(row.id)}">عرض</button><button class="small-button" data-action="print-return" data-mode="a4" data-id="${escapeHTML(row.id)}">طباعة</button><button class="small-button" data-action="print-return" data-mode="receipt" data-id="${escapeHTML(row.id)}">إيصال</button></div></td></tr>`).join("")}</tbody></table></div>`;
}

function renderReturns() {
  const all = list("returns");
  const rows = all.filter((row) => matchesFilter([row.number, row.partnerName, row.originalNumber, row.date, row.note, row.kind === "sales" ? "مرتجع مبيعات" : "مرتجع مشتريات"])).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const sum = (kind) => all.filter((row) => row.kind === kind).reduce((total, row) => total + Number(row.total || 0), 0);
  pageContent.innerHTML = `
    ${pageHeading("المرتجعات", "مرتجعات المبيعات والمشتريات مع تحديث المخزون وأرصدة العملاء والموردين والخزائن.", `<button class="button button-outline" data-action="new-purchase-return">＋ مرتجع مشتريات</button><button class="button button-primary" data-action="new-sale-return">＋ مرتجع مبيعات</button>`)}
    <div class="stock-summary"><div class="summary-chip"><span>إجمالي مرتجعات المبيعات</span><strong>${money(sum("sales"))}</strong></div><div class="summary-chip"><span>إجمالي مرتجعات المشتريات</span><strong>${money(sum("purchases"))}</strong></div><div class="summary-chip"><span>عدد المرتجعات</span><strong>${number(all.length)}</strong></div></div>
    <section class="card card-pad">${searchBar("ابحث برقم المرتجع أو الجهة أو الفاتورة الأصلية", rows.length, "مرتجع")}${returnsTable(rows)}</section>`;
}

function openReturnForm(kind) {
  const isSale = kind === "sales";
  const partnerCollection = isSale ? "customers" : "suppliers";
  const partnerLabel = isSale ? "العميل" : "المورد";
  if (!list("items").length) {
    showToast("أضف صنفًا واحدًا على الأقل قبل تسجيل مرتجع.", "error");
    setPage("items");
    return;
  }
  const body = `
    <form id="return-form">
      <div class="form-grid cols-3">
        <label>التاريخ<input name="date" type="date" value="${isoToday()}" required /></label>
        <label>${partnerLabel}${comboHTML({ name: "partnerId", source: partnerCollection, placeholder: isSale ? "عميل نقدي — اكتب للبحث" : "اكتب للبحث عن المورد" })}</label>
        <label>الفاتورة الأصلية (اختياري)<select name="originalId"></select></label>
        <label>${isSale ? "الخزينة (للمبلغ المردود)" : "الخزينة (للمبلغ المستلم)"}<select name="cashboxId">${optionsFor("cashboxes", "", "بدون حركة نقدية")}</select></label>
        <label>${isSale ? "المبلغ المردود نقدًا" : "المبلغ المستلم نقدًا"}<input name="refunded" type="number" min="0" step="0.01" value="0" /></label>
        <label>سبب الإرجاع / ملاحظات<input name="note" /></label>
      </div>
      <div class="invoice-lines"><div class="card-title"><h3>الأصناف المرتجعة</h3><button class="button button-outline" type="button" data-add-line>＋ إضافة صنف</button></div>
        <div class="table-wrap"><table><thead><tr><th>الصنف</th><th>الكمية</th><th>السعر قبل الضريبة</th><th>خصم %</th><th>الإجمالي شامل الضريبة</th><th></th></tr></thead><tbody data-lines></tbody></table></div>
      </div>
      <div class="totals-box"><div class="total-row"><span>قبل الضريبة</span><strong data-subtotal>0.00</strong></div><div class="total-row"><span>الضريبة</span><strong data-tax>0.00</strong></div><div class="total-row grand"><span>إجمالي المرتجع</span><strong data-total>0.00</strong></div><div class="total-row"><span>${isSale ? "يُخصم من رصيد العميل" : "يُخصم من رصيد المورد"}</span><strong data-credit>0.00</strong></div></div>
      <p class="modal-error" data-error></p>
    </form>`;
  showModal(isSale ? "مرتجع مبيعات" : "مرتجع مشتريات", body, { footer: `<button class="button button-primary" form="return-form" type="submit">حفظ المرتجع</button><button class="button button-outline" type="button" data-close-modal>إلغاء</button>` });
  const form = modalRoot.querySelector("#return-form");
  const lines = form.querySelector("[data-lines]");
  const originalSelect = form.elements.originalId;
  const currentOriginal = () => list(kind).find((inv) => inv.id === originalSelect.value);

  function fillOriginals() {
    const partnerId = form.elements.partnerId.value;
    const rows = list(kind).filter((inv) => !partnerId || inv.partnerId === partnerId).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 200);
    const previous = originalSelect.value;
    originalSelect.innerHTML = `<option value="">بدون ربط بفاتورة</option>${rows.map((inv) => `<option value="${escapeHTML(inv.id)}">${escapeHTML(inv.number)} — ${escapeHTML(inv.date)} — ${escapeHTML(inv.partnerName || "نقدي")}</option>`).join("")}`;
    originalSelect.value = rows.some((inv) => inv.id === previous) ? previous : "";
  }
  const lineItem = (row) => list("items").find((entry) => entry.id === row.querySelector(".line-item").value);
  const originLine = (item) => currentOriginal()?.lines?.find((line) => line.itemId === item?.id);
  const lineVat = (row) => { const item = lineItem(row); return Number(originLine(item)?.vatRate ?? item?.vatRate ?? state.company.vatRate ?? 15); };

  function addLine(focus = false) {
    const row = document.createElement("tr");
    row.innerHTML = `<td data-label="الصنف">${comboHTML({ source: "items", className: "line-item", placeholder: "ابحث بالاسم أو الكود أو الباركود" })}</td><td data-label="الكمية"><input class="line-qty" type="number" min="0.001" step="any" value="1" required inputmode="decimal" /></td><td data-label="السعر"><input class="line-price" type="number" min="0" step="0.01" value="0" required inputmode="decimal" /></td><td data-label="خصم %"><input class="line-discount" type="number" min="0" max="100" step="0.01" value="0" inputmode="decimal" /></td><td class="line-total" data-label="الإجمالي">0.00</td><td class="line-actions"><button class="small-button" type="button" data-remove-line>حذف</button></td>`;
    lines.append(row);
    updateLine(row);
    if (focus) row.querySelector(".combo-input").focus();
  }
  function updateLine(row, itemChanged = false) {
    const item = lineItem(row);
    if (itemChanged && item) {
      const origin = originLine(item);
      row.querySelector(".line-price").value = origin ? origin.price : (Number(isSale ? item.salePrice : item.costPrice) || 0);
      row.querySelector(".line-discount").value = origin ? origin.discountRate || 0 : 0;
    }
    const qty = Number(row.querySelector(".line-qty").value || 0);
    const price = Number(row.querySelector(".line-price").value || 0);
    const discount = Math.min(100, Math.max(0, Number(row.querySelector(".line-discount").value || 0)));
    const net = roundMoney(qty * price * (1 - discount / 100));
    row.querySelector(".line-total").textContent = (net + roundMoney(net * lineVat(row) / 100)).toFixed(2);
    updateTotals();
  }
  function updateTotals() {
    let subtotal = 0;
    let tax = 0;
    [...lines.querySelectorAll("tr")].forEach((row) => {
      const net = roundMoney(Number(row.querySelector(".line-qty").value || 0) * Number(row.querySelector(".line-price").value || 0) * (1 - Number(row.querySelector(".line-discount").value || 0) / 100));
      subtotal += net;
      tax += roundMoney(net * lineVat(row) / 100);
    });
    const total = subtotal + tax;
    form.querySelector("[data-subtotal]").textContent = subtotal.toFixed(2);
    form.querySelector("[data-tax]").textContent = tax.toFixed(2);
    form.querySelector("[data-total]").textContent = total.toFixed(2);
    form.querySelector("[data-credit]").textContent = Math.max(0, total - Number(form.elements.refunded.value || 0)).toFixed(2);
  }
  form.querySelector("[data-add-line]").addEventListener("click", () => addLine(true));
  form.addEventListener("keydown", (event) => { if (event.key === "Enter" && event.target.matches("input")) event.preventDefault(); });
  form.addEventListener("change", (event) => {
    if (event.target.name === "partnerId") fillOriginals();
  });
  lines.addEventListener("change", (event) => {
    const row = event.target.closest("tr");
    if (!row) return;
    const isItem = event.target.matches(".line-item");
    updateLine(row, isItem);
    if (isItem && event.target.value) row.querySelector(".line-qty").select();
  });
  lines.addEventListener("input", (event) => { const row = event.target.closest("tr"); if (row) updateLine(row); });
  lines.addEventListener("click", (event) => {
    if (event.target.matches("[data-remove-line]")) { event.target.closest("tr").remove(); updateTotals(); }
  });
  originalSelect.addEventListener("change", () => {
    const original = currentOriginal();
    if (original?.partnerId && !form.elements.partnerId.value) {
      form.elements.partnerId.value = original.partnerId;
      form.querySelector(".combo-input").value = original.partnerName || "";
    }
    [...lines.querySelectorAll("tr")].forEach((row) => updateLine(row, !!lineItem(row)));
  });
  form.elements.refunded.addEventListener("input", updateTotals);
  fillOriginals();
  addLine();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = modalRoot.querySelector('[form="return-form"]');
    setLoading(button, true);
    try {
      const original = currentOriginal();
      const partnerId = form.elements.partnerId.value || original?.partnerId || "";
      if (original && form.elements.partnerId.value && original.partnerId && original.partnerId !== form.elements.partnerId.value) throw new Error("الفاتورة الأصلية تخص جهة مختلفة عن المحددة.");
      const partner = list(partnerCollection).find((row) => row.id === partnerId);
      const cashboxId = form.elements.cashboxId.value;
      const cashbox = list("cashboxes").find((row) => row.id === cashboxId);
      const itemLines = [...lines.querySelectorAll("tr")].map((row) => {
        const item = lineItem(row);
        if (!item) throw new Error("اختر صنفًا صحيحًا لكل بند.");
        const qty = Number(row.querySelector(".line-qty").value);
        const price = Number(row.querySelector(".line-price").value);
        const discountRate = Number(row.querySelector(".line-discount").value || 0);
        if (!(qty > 0) || price < 0 || discountRate < 0 || discountRate > 100) throw new Error("تحقق من الكمية والسعر ونسبة الخصم.");
        const net = roundMoney(qty * price * (1 - discountRate / 100));
        const vatRate = lineVat(row);
        const vatLine = roundMoney(net * vatRate / 100);
        return { itemId: item.id, itemName: item.name, code: item.code || "", quantity: qty, price, discountRate, net, vatRate, vatAmount: vatLine, total: roundMoney(net + vatLine), costPrice: Number(item.costPrice || 0) };
      });
      if (!itemLines.length) throw new Error("أضف بندًا واحدًا على الأقل.");
      if (original) {
        const sold = new Map();
        const back = new Map();
        const now = new Map();
        (original.lines || []).forEach((line) => sold.set(line.itemId, (sold.get(line.itemId) || 0) + Number(line.quantity)));
        list("returns").filter((row) => row.originalId === original.id).forEach((row) => (row.lines || []).forEach((line) => back.set(line.itemId, (back.get(line.itemId) || 0) + Number(line.quantity))));
        itemLines.forEach((line) => now.set(line.itemId, (now.get(line.itemId) || 0) + line.quantity));
        for (const [itemId, qty] of now) {
          const remaining = (sold.get(itemId) || 0) - (back.get(itemId) || 0);
          const name = itemLines.find((line) => line.itemId === itemId).itemName;
          if (qty > remaining + 0.0001) throw new Error(`الكمية المرتجعة للصنف "${name}" أكبر من المتاح إرجاعه من هذه الفاتورة (${number(Math.max(0, remaining))}).`);
        }
      }
      const subtotal = roundMoney(itemLines.reduce((sum, line) => sum + line.net, 0));
      const vatAmount = roundMoney(itemLines.reduce((sum, line) => sum + line.vatAmount, 0));
      const total = roundMoney(subtotal + vatAmount);
      const refunded = Number(form.elements.refunded.value || 0);
      if (refunded < 0 || refunded > total + 0.01) throw new Error("المبلغ النقدي يجب أن يكون بين صفر وإجمالي المرتجع.");
      if (refunded > 0 && !cashbox) throw new Error("اختر الخزينة المرتبطة بالمبلغ النقدي.");
      if (total - refunded > 0.01 && !partner) throw new Error(`اختر ${partnerLabel} عند وجود مبلغ غير نقدي، أو سدّد المبلغ كاملًا نقدًا.`);
      await saveReturn(kind, {
        kind, date: form.elements.date.value,
        partnerId: partner?.id || "", partnerName: partner?.name || "نقدي",
        originalId: original?.id || "", originalNumber: original?.number || "",
        cashboxId, cashboxName: cashbox?.name || "",
        lines: itemLines, subtotal, vatAmount, total, refunded,
        balanceEffect: Math.max(0, roundMoney(total - refunded)),
        note: form.elements.note.value.trim(),
      });
      closeModal();
      showToast("تم حفظ المرتجع وتحديث المخزون والأرصدة.");
    } catch (error) {
      form.querySelector("[data-error]").textContent = explainError(error);
      setLoading(button, false);
    }
  });
}

async function saveReturn(kind, data) {
  const isSale = kind === "sales";
  const partnerCollection = isSale ? "customers" : "suppliers";
  const counterRef = doc(db, "counters", isSale ? "salesReturns" : "purchaseReturns");
  const partnerRef = data.partnerId ? doc(db, partnerCollection, data.partnerId) : null;
  const cashboxRef = data.cashboxId ? doc(db, "cashboxes", data.cashboxId) : null;
  const itemRefs = [...new Set(data.lines.map((line) => line.itemId))].map((id) => doc(db, "items", id));
  const returnRef = doc(collection(db, "returns"));
  await runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    const partnerSnap = partnerRef ? await transaction.get(partnerRef) : null;
    const cashboxSnap = cashboxRef ? await transaction.get(cashboxRef) : null;
    const itemSnaps = [];
    for (const itemRef of itemRefs) itemSnaps.push(await transaction.get(itemRef));
    if (partnerRef && !partnerSnap.exists()) throw new Error(`${isSale ? "العميل" : "المورد"} غير موجود.`);
    if (cashboxRef && !cashboxSnap.exists()) throw new Error("الخزينة المحددة غير موجودة.");
    for (const snap of itemSnaps) if (!snap.exists()) throw new Error("أحد الأصناف في المرتجع لم يعد موجودًا.");
    const itemRecords = new Map(itemSnaps.map((snap) => [snap.id, snap.data()]));
    const quantities = new Map();
    data.lines.forEach((line) => quantities.set(line.itemId, (quantities.get(line.itemId) || 0) + line.quantity));
    if (!isSale) {
      for (const [itemId, quantity] of quantities) {
        const item = itemRecords.get(itemId);
        if (item.trackInventory !== false && Number(item.quantity || 0) < quantity) throw new Error(`الرصيد غير كافٍ لإرجاع الصنف إلى المورد: ${item.name}`);
      }
    }
    const nextNumber = Number(counterSnap.data()?.value || 0) + 1;
    const numberText = `${isSale ? "SRT" : "PRT"}-${String(nextNumber).padStart(5, "0")}`;
    const createdAt = new Date().toISOString();
    transaction.set(returnRef, { ...data, number: numberText, createdAt, createdBy: state.user.email });
    transaction.set(counterRef, { value: nextNumber }, { merge: true });
    for (const [itemId, quantity] of quantities) {
      const item = itemRecords.get(itemId);
      if (item.trackInventory === false) continue;
      transaction.update(doc(db, "items", itemId), { quantity: Number(item.quantity || 0) + (isSale ? quantity : -quantity) });
      transaction.set(doc(collection(db, "stockMoves")), {
        number: numberText, date: data.date, itemId, itemName: item.name,
        type: isSale ? "مرتجع بيع" : "مرتجع شراء", quantity, costPrice: Number(item.costPrice || 0),
        note: `${isSale ? "مرتجع مبيعات" : "مرتجع مشتريات"} ${numberText}`,
        createdAt, createdBy: state.user.email,
      });
    }
    if (partnerRef && data.balanceEffect > 0) transaction.update(partnerRef, { balance: Number(partnerSnap.data().balance ?? partnerSnap.data().openingBalance ?? 0) - data.balanceEffect });
    if (cashboxRef && data.refunded > 0) transaction.update(cashboxRef, { balance: Number(cashboxSnap.data().balance ?? cashboxSnap.data().openingBalance ?? 0) + (isSale ? -data.refunded : data.refunded) });
  });
}

function viewReturn(id) {
  const row = list("returns").find((entry) => entry.id === id);
  if (!row) return;
  const isSale = row.kind === "sales";
  showModal(`تفاصيل المرتجع ${row.number}`, `
    <div class="stock-summary"><div class="summary-chip"><span>التاريخ</span><strong>${escapeHTML(row.date)}</strong></div><div class="summary-chip"><span>${isSale ? "العميل" : "المورد"}</span><strong>${escapeHTML(row.partnerName)}</strong></div><div class="summary-chip"><span>الفاتورة الأصلية</span><strong>${escapeHTML(row.originalNumber || "—")}</strong></div></div>
    <div class="table-wrap"><table><thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الضريبة</th><th>الإجمالي</th></tr></thead><tbody>${(row.lines || []).map((line) => `<tr><td>${escapeHTML(line.itemName)}</td><td>${number(line.quantity)}</td><td>${money(line.price)}</td><td>${money(line.vatAmount)}</td><td>${money(line.total)}</td></tr>`).join("")}</tbody></table></div>
    <div class="totals-box"><div class="total-row"><span>قبل الضريبة</span><strong>${money(row.subtotal)}</strong></div><div class="total-row"><span>الضريبة</span><strong>${money(row.vatAmount)}</strong></div><div class="total-row grand"><span>إجمالي المرتجع</span><strong>${money(row.total)}</strong></div><div class="total-row"><span>${isSale ? "المردود نقدًا" : "المستلم نقدًا"}${row.cashboxName ? ` (${escapeHTML(row.cashboxName)})` : ""}</span><strong>${money(row.refunded)}</strong></div><div class="total-row"><span>الأثر على الرصيد</span><strong>${money(row.balanceEffect)}</strong></div></div>
    ${row.note ? `<p class="muted">${escapeHTML(row.note)}</p>` : ""}`, { small: true, footer: printButtons() });
  bindPrintButtons((mode) => printDocument(row, isSale ? "salesReturn" : "purchaseReturn", mode));
}

// ---- كشف الحساب ----
function buildStatement({ type, partyId, from, to }) {
  const isCustomer = type === "customers";
  const party = list(type).find((row) => row.id === partyId);
  if (!party) return null;
  const entries = [];
  const add = (date, docNumber, desc, debit, credit, at) => {
    debit = roundMoney(debit || 0);
    credit = roundMoney(credit || 0);
    if (debit || credit) entries.push({ date: String(date || ""), docNumber, desc, debit, credit, at: String(at || "") });
  };
  list(isCustomer ? "sales" : "purchases").filter((row) => row.partnerId === partyId).forEach((inv) => {
    if (isCustomer) {
      add(inv.date, inv.number, "فاتورة مبيعات", inv.total, 0, inv.createdAt);
      add(inv.date, inv.number, "مدفوع عند الفاتورة", 0, inv.paid, inv.createdAt);
    } else {
      add(inv.date, inv.number, "فاتورة مشتريات", 0, inv.total, inv.createdAt);
      add(inv.date, inv.number, "مدفوع عند الفاتورة", inv.paid, 0, inv.createdAt);
    }
  });
  list("payments").filter((row) => row.partyId === partyId && row.partyType === type).forEach((pay) => {
    const receipt = pay.type === "قبض";
    add(pay.date, pay.number, `${receipt ? "سند قبض" : "سند صرف"}${pay.note ? ` — ${pay.note}` : ""}`, receipt ? 0 : pay.amount, receipt ? pay.amount : 0, pay.createdAt);
  });
  list("returns").filter((row) => row.partnerId === partyId && row.kind === (isCustomer ? "sales" : "purchases")).forEach((ret) => {
    if (isCustomer) {
      add(ret.date, ret.number, "مرتجع مبيعات", 0, ret.total, ret.createdAt);
      add(ret.date, ret.number, "مبلغ مردود نقدًا", ret.refunded, 0, ret.createdAt);
    } else {
      add(ret.date, ret.number, "مرتجع مشتريات", ret.total, 0, ret.createdAt);
      add(ret.date, ret.number, "مبلغ مستلم نقدًا", 0, ret.refunded, ret.createdAt);
    }
  });
  entries.sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at));
  const delta = (entry) => isCustomer ? entry.debit - entry.credit : entry.credit - entry.debit;
  const openingBase = Number(party.openingBalance || 0);
  let opening = openingBase;
  entries.filter((entry) => entry.date < from).forEach((entry) => { opening = roundMoney(opening + delta(entry)); });
  let running = opening;
  let debit = 0;
  let credit = 0;
  const rows = entries.filter((entry) => entry.date >= from && entry.date <= to).map((entry) => {
    running = roundMoney(running + delta(entry));
    debit += entry.debit;
    credit += entry.credit;
    return { ...entry, balance: running };
  });
  const allTime = roundMoney(openingBase + entries.reduce((sum, entry) => sum + delta(entry), 0));
  const stored = Number(party.balance ?? party.openingBalance ?? 0);
  return { party, opening, rows, debit: roundMoney(debit), credit: roundMoney(credit), closing: running, allTime, stored, mismatch: Math.abs(allTime - stored) > 0.01 };
}

function statementMarkup(data, st) {
  const isCustomer = st.type === "customers";
  const cell = (value) => value ? money(value) : "—";
  const balanceText = (value) => {
    if (Math.abs(value) < 0.005) return `${money(0)} (مسدد)`;
    const positiveLabel = isCustomer ? "مدين" : "دائن";
    const negativeLabel = isCustomer ? "دائن" : "مدين";
    return `${money(Math.abs(value))} ${value > 0 ? positiveLabel : negativeLabel}`;
  };
  const p = data.party;
  return `
    <div class="print-only"><h2>كشف حساب ${isCustomer ? "عميل" : "مورد"}: ${escapeHTML(p.name)}</h2><p>${escapeHTML(state.company.name || "")} — من ${escapeHTML(st.from)} إلى ${escapeHTML(st.to)}</p></div>
    <div class="stock-summary">
      <div class="summary-chip"><span>${isCustomer ? "العميل" : "المورد"}</span><strong>${escapeHTML(p.name)}</strong></div>
      <div class="summary-chip"><span>الرصيد السابق</span><strong>${balanceText(data.opening)}</strong></div>
      <div class="summary-chip"><span>الرصيد الختامي</span><strong>${balanceText(data.closing)}</strong></div>
    </div>
    ${data.mismatch ? `<p class="stmt-note">تنبيه: الرصيد الظاهر في بطاقة ${isCustomer ? "العميل" : "المورد"} (${balanceText(data.stored)}) يختلف عن مجموع الحركات (${balanceText(data.allTime)}). غالبًا بسبب تعديل الرصيد الافتتاحي بعد وجود حركات.</p>` : ""}
    <div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>المستند</th><th>البيان</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead><tbody>
      <tr class="stmt-balance-row"><td>${escapeHTML(st.from)}</td><td>—</td><td>رصيد سابق</td><td>—</td><td>—</td><td>${balanceText(data.opening)}</td></tr>
      ${data.rows.map((row) => `<tr><td>${escapeHTML(row.date)}</td><td class="table-primary">${escapeHTML(row.docNumber || "—")}</td><td>${escapeHTML(row.desc)}</td><td>${cell(row.debit)}</td><td>${cell(row.credit)}</td><td>${balanceText(row.balance)}</td></tr>`).join("")}
      <tr class="stmt-balance-row"><td>${escapeHTML(st.to)}</td><td>—</td><td>الإجمالي والرصيد الختامي</td><td>${money(data.debit)}</td><td>${money(data.credit)}</td><td>${balanceText(data.closing)}</td></tr>
    </tbody></table></div>
    ${data.rows.length ? "" : `<div class="empty-state">لا توجد حركات في الفترة المحددة.</div>`}`;
}

function renderStatements() {
  const st = state.statement || { type: "customers", partyId: "", from: `${new Date().getFullYear()}-01-01`, to: isoToday() };
  const data = st.partyId ? buildStatement(st) : null;
  pageContent.innerHTML = `
    ${pageHeading("كشف حساب عميل / مورد", "حركة الحساب بالتفصيل: الفواتير والسندات والمرتجعات مع الرصيد المتحرك.", data ? `<button class="button button-outline" data-action="print-report">طباعة</button>` : "")}
    <section class="card card-pad">
      <form id="statement-form" class="report-controls">
        <label>نوع الحساب<select name="type"><option value="customers"${selected("customers", st.type)}>عميل</option><option value="suppliers"${selected("suppliers", st.type)}>مورد</option></select></label>
        <label class="statement-party">الحساب${comboHTML({ name: "partyId", source: st.type, value: st.partyId, placeholder: "ابحث بالاسم أو الكود أو الجوال" })}</label>
        <label>من تاريخ<input type="date" name="from" value="${escapeHTML(st.from)}" required /></label>
        <label>إلى تاريخ<input type="date" name="to" value="${escapeHTML(st.to)}" required /></label>
        <button class="button button-primary">عرض الكشف</button>
      </form>
      ${data ? statementMarkup(data, st) : `<div class="empty-state"><strong>اختر العميل أو المورد</strong>حدد الحساب والفترة ثم اضغط عرض الكشف.</div>`}
    </section>`;
}

function bindStatementEvents() {
  pageContent.addEventListener("change", (event) => {
    if (!event.target.matches('#statement-form [name="type"]')) return;
    const combo = event.target.form.querySelector("[data-combo]");
    combo.dataset.source = event.target.value;
    combo.querySelector(".combo-input").value = "";
    combo.querySelector(".combo-value").value = "";
  });
  pageContent.addEventListener("submit", (event) => {
    if (event.target.id !== "statement-form") return;
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    if (!data.partyId) { showToast("اختر العميل أو المورد أولًا.", "error"); return; }
    if (data.from > data.to) { showToast("تاريخ البداية يجب أن يسبق تاريخ النهاية.", "error"); return; }
    state.statement = { type: data.type, partyId: data.partyId, from: data.from, to: data.to };
    renderPage();
  });
}

// ===== BLOCK3 START =====
// ================= الطباعة =================
const DOC_TITLES = { sales: "فاتورة مبيعات", purchases: "فاتورة مشتريات", salesReturn: "مرتجع مبيعات", purchaseReturn: "مرتجع مشتريات" };
const getPrintPref = () => { try { return localStorage.getItem("daftar.printAfter") || ""; } catch { return ""; } };
const setPrintPref = (value) => { try { localStorage.setItem("daftar.printAfter", value || ""); } catch { /* ignore */ } };
const printOptions = (current) => `<option value="">بدون طباعة</option><option value="a4"${selected("a4", current)}>فاتورة A4</option><option value="receipt"${selected("receipt", current)}>إيصال كاشير</option>`;
const printButtons = () => `<button class="button button-primary" type="button" data-print="a4">طباعة فاتورة A4</button><button class="button button-outline" type="button" data-print="receipt">طباعة إيصال كاشير</button><button class="button button-outline" type="button" data-close-modal>إغلاق</button>`;
function bindPrintButtons(handler) {
  modalRoot.querySelectorAll("[data-print]").forEach((button) => button.addEventListener("click", () => handler(button.dataset.print)));
}

function printHTML(html) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none";
  document.body.append(frame);
  const win = frame.contentWindow;
  win.document.open();
  win.document.write(html);
  win.document.close();
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    win.focus();
    win.print();
    window.setTimeout(() => frame.remove(), 60000);
  };
  Promise.race([win.document.fonts?.ready || Promise.resolve(), new Promise((resolve) => window.setTimeout(resolve, 1500))]).then(() => window.setTimeout(go, 150));
}

const printFmt = (value) => new Intl.NumberFormat("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
const printHead = (title) => `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8" /><title>${escapeHTML(title)}</title><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet" />`;

function printDocument(docData, docType, mode = "a4") {
  const isSalesSide = docType === "sales" || docType === "salesReturn";
  const isReturn = docType.endsWith("Return");
  const partyLabel = isSalesSide ? "العميل" : "المورد";
  const title = DOC_TITLES[docType] || "مستند";
  const company = state.company;
  const currency = escapeHTML(company.currency || "ر.س");
  const settle = isReturn
    ? [[isSalesSide ? "المردود نقدًا" : "المستلم نقدًا", docData.refunded], ["الأثر على الرصيد", docData.balanceEffect]]
    : [["المدفوع", docData.paid], ["المتبقي", docData.due]];
  const lines = docData.lines || [];
  const footerText = company.printFooter ? escapeHTML(company.printFooter) : "";
  const companyBlock = `<strong>${escapeHTML(company.name || "")}</strong>${company.taxNumber ? `<br>الرقم الضريبي: ${escapeHTML(company.taxNumber)}` : ""}${company.phone ? `<br>جوال: ${escapeHTML(company.phone)}` : ""}${company.address ? `<br>${escapeHTML(company.address)}` : ""}`;
  let html;
  if (mode === "receipt") {
    const narrow = company.receiptWidth === "58mm";
    html = `${printHead(`${title} ${docData.number}`)}<style>
      @page { size: ${narrow ? "58mm" : "80mm"} auto; margin: 3mm; }
      * { box-sizing: border-box; }
      body { width: ${narrow ? "50mm" : "72mm"}; margin: 0 auto; color: #000; font-family: Cairo, Tahoma, sans-serif; font-size: 11px; line-height: 1.5; }
      .c { text-align: center; } .sep { border-top: 1px dashed #000; margin: 5px 0; }
      h1 { margin: 0; font-size: 14px; } .meta div, .tot div, .ln .r { display: flex; justify-content: space-between; gap: 6px; }
      .ln { padding: 3px 0; border-bottom: 1px dotted #999; } .ln .nm { font-weight: 700; } .tot .g { font-size: 13px; font-weight: 800; border-top: 1px solid #000; padding-top: 3px; margin-top: 2px; }
    </style></head><body>
      <div class="c"><h1>${escapeHTML(company.name || "")}</h1>${company.taxNumber ? `<div>الرقم الضريبي: ${escapeHTML(company.taxNumber)}</div>` : ""}${company.phone ? `<div>${escapeHTML(company.phone)}</div>` : ""}${company.address ? `<div>${escapeHTML(company.address)}</div>` : ""}</div>
      <div class="sep"></div>
      <div class="c"><strong>${title}</strong></div>
      <div class="meta"><div><span>الرقم</span><span>${escapeHTML(docData.number)}</span></div><div><span>التاريخ</span><span>${escapeHTML(docData.date)}</span></div><div><span>${partyLabel}</span><span>${escapeHTML(docData.partnerName || "نقدي")}</span></div></div>
      <div class="sep"></div>
      ${lines.map((line) => `<div class="ln"><div class="nm">${escapeHTML(line.itemName)}</div><div class="r"><span>${number(line.quantity)} × ${printFmt(line.price)}${Number(line.discountRate) ? ` (-${number(line.discountRate)}%)` : ""}</span><span>${printFmt(line.total)}</span></div></div>`).join("")}
      <div class="sep"></div>
      <div class="tot"><div><span>قبل الضريبة</span><span>${printFmt(docData.subtotal)}</span></div><div><span>الضريبة</span><span>${printFmt(docData.vatAmount)}</span></div><div class="g"><span>الإجمالي</span><span>${printFmt(docData.total)} ${currency}</span></div>${settle.map(([label, value]) => `<div><span>${label}</span><span>${printFmt(value)}</span></div>`).join("")}</div>
      ${docData.note ? `<div class="sep"></div><div>${escapeHTML(docData.note)}</div>` : ""}
      <div class="sep"></div>
      <div class="c">${footerText || "شكرًا لتعاملكم معنا"}</div>
    </body></html>`;
  } else {
    html = `${printHead(`${title} ${docData.number}`)}<style>
      @page { size: A4; margin: 14mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #1f2340; font-family: Cairo, Tahoma, sans-serif; font-size: 12px; line-height: 1.7; }
      .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; padding-bottom: 12px; border-bottom: 3px solid ${printAccent()}; margin-bottom: 14px; }
      .head h1 { margin: 0 0 4px; font-size: 22px; color: ${printAccent()}; } .co { font-size: 11px; color: #444; }
      .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
      .meta div { padding: 8px 10px; border: 1px solid #dfe1f3; border-radius: 8px; background: #f7f8ff; } .meta span { display: block; color: #7b7fa0; font-size: 10px; }
      table { width: 100%; border-collapse: collapse; } th { background: ${printAccent()}; color: #fff; padding: 7px 8px; font-size: 11px; text-align: right; } td { padding: 7px 8px; border-bottom: 1px solid #e6e8f5; font-size: 11px; }
      tr:nth-child(even) td { background: #fafaff; }
      .tot { width: 280px; margin: 14px 0 0 auto; } .tot div { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #eee; } .tot .g { font-size: 15px; font-weight: 800; color: ${printAccent()}; border-bottom: 2px solid ${printAccent()}; }
      .note { margin-top: 14px; padding: 8px 10px; background: #f7f8ff; border-radius: 8px; } .sign { display: flex; justify-content: space-between; margin-top: 50px; color: #555; } .sign span { width: 30%; padding-top: 6px; border-top: 1px solid #999; text-align: center; }
      .foot { margin-top: 24px; text-align: center; color: #7b7fa0; font-size: 10px; }
    </style></head><body>
      <div class="head"><div><h1>${title}</h1><div class="co">رقم: ${escapeHTML(docData.number)}</div></div><div class="co" style="text-align:left">${companyBlock}</div></div>
      <div class="meta"><div><span>التاريخ</span>${escapeHTML(docData.date)}</div><div><span>${partyLabel}</span>${escapeHTML(docData.partnerName || "نقدي")}</div><div><span>${isReturn && docData.originalNumber ? "الفاتورة الأصلية" : "المخزن / الخزينة"}</span>${escapeHTML(isReturn ? (docData.originalNumber || "—") : (docData.cashboxName || "—"))}</div></div>
      <table><thead><tr><th>#</th><th>الصنف</th><th>الكمية</th><th>السعر</th><th>خصم %</th><th>الضريبة</th><th>الإجمالي</th></tr></thead><tbody>
      ${lines.map((line, index) => `<tr><td>${number(index + 1)}</td><td>${escapeHTML(line.itemName)}${line.code ? ` <small>(${escapeHTML(line.code)})</small>` : ""}</td><td>${number(line.quantity)}</td><td>${printFmt(line.price)}</td><td>${number(line.discountRate || 0)}</td><td>${printFmt(line.vatAmount)}</td><td>${printFmt(line.total)}</td></tr>`).join("")}
      </tbody></table>
      <div class="tot"><div><span>الإجمالي قبل الضريبة</span><span>${printFmt(docData.subtotal)}</span></div><div><span>ضريبة القيمة المضافة</span><span>${printFmt(docData.vatAmount)}</span></div><div class="g"><span>الإجمالي</span><span>${printFmt(docData.total)} ${currency}</span></div>${settle.map(([label, value]) => `<div><span>${label}</span><span>${printFmt(value)}</span></div>`).join("")}</div>
      ${docData.note ? `<div class="note">ملاحظات: ${escapeHTML(docData.note)}</div>` : ""}
      <div class="sign"><span>توقيع ${partyLabel}</span><span>توقيع المستلم / المحاسب</span></div>
      <div class="foot">${footerText}</div>
    </body></html>`;
  }
  printHTML(html);
}

function printPayslip(row) {
  const company = state.company;
  printHTML(`${printHead(`قسيمة راتب ${row.number}`)}<style>
    @page { size: A5 landscape; margin: 10mm; } * { box-sizing: border-box; }
    body { margin: 0; color: #1f2340; font-family: Cairo, Tahoma, sans-serif; font-size: 12px; line-height: 1.7; }
    .head { display: flex; justify-content: space-between; border-bottom: 3px solid ${printAccent()}; padding-bottom: 8px; margin-bottom: 10px; } h1 { margin: 0; font-size: 18px; color: ${printAccent()}; }
    .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 10px; } .meta div { padding: 6px 8px; border: 1px solid #dfe1f3; border-radius: 8px; background: #f7f8ff; } .meta span { display: block; color: #7b7fa0; font-size: 10px; }
    table { width: 100%; border-collapse: collapse; } td { padding: 6px 8px; border-bottom: 1px solid #e6e8f5; } .g td { font-size: 14px; font-weight: 800; color: ${printAccent()}; border-bottom: 2px solid ${printAccent()}; }
    .sign { display: flex; justify-content: space-between; margin-top: 28px; color: #555; } .sign span { width: 30%; padding-top: 5px; border-top: 1px solid #999; text-align: center; }
  </style></head><body>
    <div class="head"><div><h1>قسيمة راتب</h1><div>رقم: ${escapeHTML(row.number)}</div></div><div style="text-align:left"><strong>${escapeHTML(company.name || "")}</strong>${company.taxNumber ? `<br>الرقم الضريبي: ${escapeHTML(company.taxNumber)}` : ""}</div></div>
    <div class="meta"><div><span>الموظف</span>${escapeHTML(row.employeeName)}</div><div><span>الوظيفة</span>${escapeHTML(row.jobTitle || "—")}</div><div><span>شهر الراتب</span>${escapeHTML(row.month)}</div></div>
    <table><tbody><tr><td>الراتب الأساسي</td><td>${printFmt(row.basic)}</td></tr><tr><td>البدلات</td><td>${printFmt(row.allowances)}</td></tr><tr><td>مكافآت / إضافي</td><td>${printFmt(row.bonus)}</td></tr><tr><td>خصومات / سلف</td><td>${printFmt(row.deductions)}</td></tr><tr class="g"><td>صافي الراتب</td><td>${printFmt(row.net)} ${escapeHTML(company.currency || "ر.س")}</td></tr></tbody></table>
    <p>تاريخ الصرف: ${escapeHTML(row.date)}${row.cashboxName ? ` — من: ${escapeHTML(row.cashboxName)}` : ""}</p>
    <div class="sign"><span>توقيع الموظف</span><span>توقيع المحاسب</span></div>
  </body></html>`);
}

// ================= آخر سعر بيع =================
let lastSaleCache = { ref: null, map: null };
function lastSaleAnyMap() {
  const sales = list("sales");
  if (lastSaleCache.ref === sales && lastSaleCache.map) return lastSaleCache.map;
  const map = new Map();
  [...sales].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")) || String(a.createdAt || "").localeCompare(String(b.createdAt || ""))).forEach((invoice) => {
    (invoice.lines || []).forEach((line) => map.set(line.itemId, { price: Number(line.price || 0), discountRate: Number(line.discountRate || 0), partnerId: invoice.partnerId || "", partnerName: invoice.partnerName || "نقدي", date: invoice.date || "", number: invoice.number }));
  });
  lastSaleCache = { ref: sales, map };
  return map;
}
function saleHistory(itemId) {
  const out = [];
  list("sales").forEach((invoice) => (invoice.lines || []).forEach((line) => {
    if (line.itemId === itemId) out.push({ date: String(invoice.date || ""), at: String(invoice.createdAt || ""), partnerId: invoice.partnerId || "", partnerName: invoice.partnerName || "نقدي", number: invoice.number, price: Number(line.price || 0), discountRate: Number(line.discountRate || 0), quantity: Number(line.quantity || 0) });
  }));
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at));
}
function priceHintHTML(itemId, partnerId) {
  if (!itemId) return "";
  const any = lastSaleAnyMap().get(itemId);
  const parts = [];
  if (partnerId) {
    const mine = saleHistory(itemId).find((entry) => entry.partnerId === partnerId);
    parts.push(mine ? `آخر سعر لهذا العميل: <b>${money(mine.price)}</b>${mine.discountRate ? ` (خصم ${number(mine.discountRate)}%)` : ""} — ${escapeHTML(mine.date)}` : "لم يُبع هذا الصنف لهذا العميل من قبل");
  }
  parts.push(any ? `آخر بيع لأي عميل: <b>${money(any.price)}</b> — ${escapeHTML(any.partnerName)} (${escapeHTML(any.date)})` : "لا توجد مبيعات سابقة للصنف");
  return parts.join("<br>");
}
function viewItemPrices(itemId) {
  const item = list("items").find((row) => row.id === itemId);
  if (!item) return;
  const history = saleHistory(itemId);
  const byCustomer = new Map();
  history.forEach((entry) => {
    const key = entry.partnerId || "";
    if (!byCustomer.has(key)) byCustomer.set(key, { ...entry, times: 0, qty: 0 });
    const group = byCustomer.get(key);
    group.times += 1;
    group.qty += entry.quantity;
  });
  const last = history[0];
  showModal(`أسعار الصنف: ${item.name}`, `
    <div class="stock-summary"><div class="summary-chip"><span>سعر البيع الحالي</span><strong>${money(item.salePrice)}</strong></div><div class="summary-chip"><span>آخر سعر بيع (أي عميل)</span><strong>${last ? money(last.price) : "—"}</strong></div><div class="summary-chip"><span>التكلفة</span><strong>${money(item.costPrice)}</strong></div></div>
    <h3 class="modal-sub">آخر سعر لكل عميل</h3>
    ${byCustomer.size ? `<div class="table-wrap"><table><thead><tr><th>العميل</th><th>آخر سعر</th><th>الخصم</th><th>آخر كمية</th><th>التاريخ</th><th>الفاتورة</th><th>مرات البيع</th></tr></thead><tbody>${[...byCustomer.values()].map((row) => `<tr><td class="table-primary">${escapeHTML(row.partnerName)}</td><td>${money(row.price)}</td><td>${row.discountRate ? `${number(row.discountRate)}%` : "—"}</td><td>${number(row.quantity)}</td><td>${escapeHTML(row.date)}</td><td>${escapeHTML(row.number)}</td><td>${number(row.times)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state">لا توجد مبيعات سابقة لهذا الصنف.</div>`}`);
}

// ================= أدوات التحليل والرسوم =================
const compactNumber = (value) => new Intl.NumberFormat("ar-SA", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value) || 0);
const sumOf = (rows, fn) => rows.reduce((total, row) => total + (Number(fn(row)) || 0), 0);
const inRange = (date, from, to) => String(date || "") >= from && String(date || "") <= to;
const lineCost = (line) => Number(line.costPrice || 0) * Number(line.quantity || 0);
const monthOf = (date) => String(date || "").slice(0, 7);
const emptyChart = `<div class="empty-state">لا توجد بيانات كافية للرسم.</div>`;
const niceMax = (value) => {
  if (!(value > 0)) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const n = value / power;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * power;
};
function monthKeys(count) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
}
function monthKeysBetween(from, to) {
  const keys = [];
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));
  const endKey = to.slice(0, 7);
  while (keys.length < 240) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (key > endKey) break;
    keys.push(key);
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return keys.slice(-24);
}
const monthLabel = (key) => `${key.slice(5)}/${key.slice(2, 4)}`;

function legendHTML(series) {
  return `<div class="chart-legend">${series.map((s, i) => `<span><i style="background:${s.color || CHART_COLORS[i % CHART_COLORS.length]}"></i>${escapeHTML(s.name)}</span>`).join("")}</div>`;
}
function barChart({ labels, series }) {
  if (!labels.length || !series.some((s) => s.values.some((v) => v))) return emptyChart;
  const narrow = window.innerWidth < 700;
  const W = narrow ? 420 : 720, H = narrow ? 250 : 260, padL = narrow ? 46 : 54, padR = 10, padT = 14, padB = 34;
  const all = series.flatMap((s) => s.values);
  const maxV = niceMax(Math.max(0, ...all));
  const lowest = Math.min(0, ...all);
  const minV = lowest < 0 ? -niceMax(Math.abs(lowest)) : 0;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const y = (v) => padT + ((maxV - v) / (maxV - minV)) * plotH;
  const group = plotW / labels.length;
  const barW = Math.min(30, (group * 0.72) / series.length);
  const step = Math.ceil(labels.length / (narrow ? 6 : 12));
  let svg = "";
  for (let i = 0; i <= 4; i += 1) {
    const v = minV + ((maxV - minV) * i) / 4;
    svg += `<line x1="${padL}" x2="${W - padR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="ch-grid"/><text x="${padL - 6}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end" class="ch-text">${escapeHTML(compactNumber(v))}</text>`;
  }
  svg += `<line x1="${padL}" x2="${W - padR}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" class="ch-axis"/>`;
  labels.forEach((label, i) => {
    const gx = padL + group * i + group / 2;
    series.forEach((s, j) => {
      const v = Number(s.values[i]) || 0;
      const top = Math.min(y(0), y(v));
      const height = Math.max(v ? 1 : 0, Math.abs(y(0) - y(v)));
      const x = gx - (series.length * barW) / 2 + j * barW;
      svg += `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${(barW - 1).toFixed(1)}" height="${height.toFixed(1)}" rx="3" fill="${s.color || CHART_COLORS[j % CHART_COLORS.length]}"><title>${escapeHTML(`${label} — ${s.name}: ${number(v)}`)}</title></rect>`;
    });
    if (i % step === 0) svg += `<text x="${gx.toFixed(1)}" y="${H - 12}" text-anchor="middle" class="ch-text">${escapeHTML(label)}</text>`;
  });
  return `<div class="chart-box" dir="ltr"><svg viewBox="0 0 ${W} ${H}" class="chart-svg" role="img">${svg}</svg></div>${legendHTML(series)}`;
}
function donutChart(rows, fmt = money) {
  let data = rows.filter((row) => row.value > 0).sort((a, b) => b.value - a.value);
  if (!data.length) return emptyChart;
  if (data.length > 7) data = [...data.slice(0, 6), { label: "أخرى", value: sumOf(data.slice(6), (r) => r.value) }];
  const total = sumOf(data, (r) => r.value);
  const R = 62;
  const C = 2 * Math.PI * R;
  let acc = 0;
  const arcs = data.map((row, i) => {
    const len = (row.value / total) * C;
    const el = `<circle cx="90" cy="90" r="${R}" fill="none" stroke="${CHART_COLORS[i % CHART_COLORS.length]}" stroke-width="26" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}" transform="rotate(-90 90 90)"><title>${escapeHTML(`${row.label}: ${number(row.value)}`)}</title></circle>`;
    acc += len;
    return el;
  }).join("");
  return `<div class="donut-wrap"><svg viewBox="0 0 180 180" class="donut-svg" role="img">${arcs}<text x="90" y="86" text-anchor="middle" class="ch-text">الإجمالي</text><text x="90" y="104" text-anchor="middle" class="ch-total">${escapeHTML(compactNumber(total))}</text></svg><ul class="donut-legend">${data.map((row, i) => `<li><i style="background:${CHART_COLORS[i % CHART_COLORS.length]}"></i><span>${escapeHTML(row.label)}</span><strong>${fmt(row.value)}</strong><small>${number(Math.round((row.value / total) * 1000) / 10)}%</small></li>`).join("")}</ul></div>`;
}
function hBars(rows, color = CHART_COLORS[0], fmt = money) {
  if (!rows.length) return emptyChart;
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  return `<div class="hbars">${rows.map((row) => `<div class="hbar-row"><span class="hbar-label" title="${escapeHTML(row.label)}">${escapeHTML(row.label)}</span><span class="hbar-track"><span class="hbar-fill" style="width:${Math.max(2, (Math.abs(row.value) / max) * 100).toFixed(1)}%;background:${row.value < 0 ? "#f43f5e" : color}"></span></span><span class="hbar-value">${fmt(row.value)}</span></div>`).join("")}</div>`;
}
const chartCard = (title, inner) => `<section class="chart-card"><h4>${title}</h4>${inner}</section>`;
const chipsHTML = (chips) => `<div class="stock-summary">${chips.map(([label, value]) => `<div class="summary-chip"><span>${label}</span><strong>${value}</strong></div>`).join("")}</div>`;
const reportTable = (headers, rows, footer = "") => rows.length
  ? `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((cells) => `<tr>${cells.map((cell, i) => `<td${i === 0 ? ' class="table-primary"' : ""}>${cell}</td>`).join("")}</tr>`).join("")}${footer}</tbody></table></div>`
  : `<div class="empty-state">لا توجد بيانات في الفترة المختارة.</div>`;

function periodData(from, to) {
  const within = (name, kind) => list(name).filter((row) => (!kind || row.kind === kind) && inRange(row.date, from, to));
  const sales = within("sales");
  const purchases = within("purchases");
  const expenses = within("expenses");
  const payroll = within("payroll");
  const salesReturns = within("returns", "sales");
  const purchaseReturns = within("returns", "purchases");
  const linesCost = (rows) => sumOf(rows, (row) => sumOf(row.lines || [], lineCost));
  const salesNet = sumOf(sales, (r) => r.subtotal) - sumOf(salesReturns, (r) => r.subtotal);
  const cogs = linesCost(sales) - linesCost(salesReturns);
  const grossProfit = salesNet - cogs;
  const expensesNet = sumOf(expenses, (r) => r.amount);
  const payrollNet = sumOf(payroll, (r) => r.net);
  const vatOut = sumOf(sales, (r) => r.vatAmount) - sumOf(salesReturns, (r) => r.vatAmount);
  const vatIn = sumOf(purchases, (r) => r.vatAmount) - sumOf(purchaseReturns, (r) => r.vatAmount) + sumOf(expenses, (r) => r.vatAmount);
  return {
    sales, purchases, expenses, payroll, salesReturns, purchaseReturns,
    salesNet, cogs, grossProfit, expensesNet, payrollNet,
    purchasesNet: sumOf(purchases, (r) => r.subtotal) - sumOf(purchaseReturns, (r) => r.subtotal),
    vatOut, vatIn, vatDue: vatOut - vatIn,
    netProfit: grossProfit - expensesNet - payrollNet,
    margin: salesNet ? (grossProfit / salesNet) * 100 : 0,
  };
}
function monthlySeries(keys, from = "0000-00-00", to = "9999-99-99") {
  const pick = (name, kind) => list(name).filter((row) => (!kind || row.kind === kind) && inRange(row.date, from, to));
  const sales = pick("sales");
  const purchases = pick("purchases");
  const expenses = pick("expenses");
  const payroll = pick("payroll");
  const salesReturns = pick("returns", "sales");
  const purchaseReturns = pick("returns", "purchases");
  const by = (rows, fn) => keys.map((key) => sumOf(rows.filter((row) => monthOf(row.date) === key), fn));
  const lineCosts = (row) => sumOf(row.lines || [], lineCost);
  const salesNet = by(sales, (r) => r.subtotal).map((v, i) => v - by(salesReturns, (r) => r.subtotal)[i]);
  const cogs = by(sales, lineCosts).map((v, i) => v - by(salesReturns, lineCosts)[i]);
  const purchasesNet = by(purchases, (r) => r.subtotal).map((v, i) => v - by(purchaseReturns, (r) => r.subtotal)[i]);
  const expensesNet = by(expenses, (r) => r.amount);
  const payrollNet = by(payroll, (r) => r.net);
  return { labels: keys.map(monthLabel), sales: salesNet, purchases: purchasesNet, expenses: expensesNet, payroll: payrollNet, profit: salesNet.map((v, i) => v - cogs[i] - expensesNet[i] - payrollNet[i]) };
}
function monthlyChart(count) {
  const s = monthlySeries(monthKeys(count));
  return barChart({ labels: s.labels, series: [{ name: "المبيعات (صافي)", values: s.sales, color: CHART_COLORS[0] }, { name: "المشتريات (صافي)", values: s.purchases, color: "#f59e0b" }, { name: "المصروفات", values: s.expenses, color: "#f43f5e" }, { name: "الرواتب", values: s.payroll, color: "#8b5cf6" }] });
}
function trendChart(report) {
  const days = (new Date(report.to) - new Date(report.from)) / 86400000;
  const byDay = days <= 45;
  const map = new Map();
  report.rows.forEach((row) => {
    const key = byDay ? String(row.date) : monthOf(row.date);
    map.set(key, (map.get(key) || 0) + Number(row.total || 0));
  });
  const keys = [...map.keys()].sort();
  const names = { sales: "المبيعات", purchases: "المشتريات", expenses: "المصروفات", returns: "المرتجعات" };
  const colors = { sales: CHART_COLORS[0], purchases: "#f59e0b", expenses: "#f43f5e", returns: "#0ea5e9" };
  return chartCard(`اتجاه ${names[report.type] || ""} ${byDay ? "يوميًا" : "شهريًا"}`, barChart({ labels: keys.map((k) => (byDay ? k.slice(5) : k.slice(2))), series: [{ name: names[report.type] || "", values: keys.map((k) => map.get(k)), color: colors[report.type] }] }));
}

function aggregateItems(from, to) {
  const map = new Map();
  const touch = (line) => {
    if (!map.has(line.itemId)) map.set(line.itemId, { itemId: line.itemId, name: line.itemName, code: line.code || "", qty: 0, revenue: 0, cost: 0 });
    return map.get(line.itemId);
  };
  list("sales").filter((r) => inRange(r.date, from, to)).forEach((inv) => (inv.lines || []).forEach((line) => { const e = touch(line); e.qty += Number(line.quantity || 0); e.revenue += Number(line.net || 0); e.cost += lineCost(line); }));
  list("returns").filter((r) => r.kind === "sales" && inRange(r.date, from, to)).forEach((ret) => (ret.lines || []).forEach((line) => { const e = touch(line); e.qty -= Number(line.quantity || 0); e.revenue -= Number(line.net || 0); e.cost -= lineCost(line); }));
  return [...map.values()].map((e) => ({ ...e, profit: e.revenue - e.cost })).sort((a, b) => b.revenue - a.revenue);
}
function aggregateCustomers(from, to) {
  const map = new Map();
  const touch = (id, name) => {
    if (!map.has(id)) map.set(id, { id, name: name || "نقدي", count: 0, total: 0, paid: 0, due: 0, returns: 0 });
    return map.get(id);
  };
  list("sales").filter((r) => inRange(r.date, from, to)).forEach((inv) => { const e = touch(inv.partnerId || "", inv.partnerName); e.count += 1; e.total += Number(inv.total || 0); e.paid += Number(inv.paid || 0); e.due += Number(inv.due || 0); });
  list("returns").filter((r) => r.kind === "sales" && inRange(r.date, from, to)).forEach((ret) => { touch(ret.partnerId || "", ret.partnerName).returns += Number(ret.total || 0); });
  return [...map.values()].map((e) => ({ ...e, net: e.total - e.returns, balance: e.id ? Number(list("customers").find((c) => c.id === e.id)?.balance ?? 0) : 0 })).sort((a, b) => b.net - a.net);
}

// ================= التقارير التفصيلية =================
const reportBuilders = {
  profit(report) {
    const d = periodData(report.from, report.to);
    const s = monthlySeries(monthKeysBetween(report.from, report.to), report.from, report.to);
    return `<div id="report-output">${chipsHTML([["صافي المبيعات (قبل الضريبة)", money(d.salesNet)], ["مجمل الربح", money(d.grossProfit)], ["هامش الربح", `${number(Math.round(d.margin * 10) / 10)}%`], ["صافي الربح التقديري", money(d.netProfit)]])}
      ${chartCard("الأداء الشهري", barChart({ labels: s.labels, series: [{ name: "المبيعات", values: s.sales, color: CHART_COLORS[0] }, { name: "المصروفات", values: s.expenses, color: "#f43f5e" }, { name: "الرواتب", values: s.payroll, color: "#8b5cf6" }, { name: "صافي الربح", values: s.profit, color: "#10b981" }] }))}
      ${reportTable(["البند", "المبلغ"], [["صافي المبيعات بعد المرتجعات (قبل الضريبة)", money(d.salesNet)], ["تكلفة البضاعة المباعة", money(d.cogs)], ["مجمل الربح", money(d.grossProfit)], ["المصروفات (قبل الضريبة)", money(d.expensesNet)], ["الرواتب المصروفة", money(d.payrollNet)], ["صافي الربح التقديري", money(d.netProfit)]])}
      <p class="muted">التقدير يعتمد على تكلفة الصنف وقت البيع، ولا يشمل الإهلاك أو أي التزامات لم تُسجّل في البرنامج.</p></div>`;
  },
  itemsSales(report) {
    const rows = aggregateItems(report.from, report.to);
    return `<div id="report-output">${chipsHTML([["عدد الأصناف المباعة", number(rows.length)], ["إجمالي الكميات", number(sumOf(rows, (r) => r.qty))], ["صافي المبيعات", money(sumOf(rows, (r) => r.revenue))], ["الربح التقديري", money(sumOf(rows, (r) => r.profit))]])}
      <div class="chart-grid">${chartCard("أعلى 10 أصناف مبيعًا", hBars(rows.slice(0, 10).map((r) => ({ label: r.name, value: r.revenue }))))}${chartCard("أعلى 10 أصناف ربحًا", hBars([...rows].sort((a, b) => b.profit - a.profit).slice(0, 10).map((r) => ({ label: r.name, value: r.profit })), "#10b981"))}</div>
      ${reportTable(["الصنف", "الكود", "الكمية", "صافي المبيعات", "التكلفة", "الربح", "الهامش", "متوسط السعر"], rows.map((r) => [escapeHTML(r.name), escapeHTML(r.code || "—"), number(r.qty), money(r.revenue), money(r.cost), money(r.profit), `${number(r.revenue ? Math.round((r.profit / r.revenue) * 1000) / 10 : 0)}%`, money(r.qty ? r.revenue / r.qty : 0)]))}</div>`;
  },
  customersSales(report) {
    const rows = aggregateCustomers(report.from, report.to);
    return `<div id="report-output">${chipsHTML([["عدد العملاء", number(rows.length)], ["إجمالي المبيعات", money(sumOf(rows, (r) => r.total))], ["المرتجعات", money(sumOf(rows, (r) => r.returns))], ["الآجل خلال الفترة", money(sumOf(rows, (r) => r.due))]])}
      <div class="chart-grid">${chartCard("أعلى 10 عملاء (صافي المبيعات)", hBars(rows.slice(0, 10).map((r) => ({ label: r.name, value: r.net }))))}${chartCard("توزيع المبيعات", donutChart(rows.map((r) => ({ label: r.name, value: r.net }))))}</div>
      ${reportTable(["العميل", "الفواتير", "الإجمالي", "المدفوع", "الآجل", "المرتجعات", "الصافي", "الرصيد الحالي"], rows.map((r) => [escapeHTML(r.name), number(r.count), money(r.total), money(r.paid), money(r.due), money(r.returns), money(r.net), r.id ? money(r.balance) : "—"]))}</div>`;
  },
  stock() {
    const rows = list("items").map((item) => {
      const qty = Number(item.quantity || 0);
      const low = Number(item.lowStock || 0) > 0 && qty <= Number(item.lowStock);
      const status = item.trackInventory === false ? ["غير مخزني", ""] : qty <= 0 ? ["نفد", " danger"] : low ? ["منخفض", " warning"] : ["متوفر", ""];
      return { item, qty, value: qty * Number(item.costPrice || 0), saleValue: qty * Number(item.salePrice || 0), status };
    }).sort((a, b) => b.value - a.value);
    const byCategory = new Map();
    rows.forEach((r) => byCategory.set(r.item.category || "بدون مجموعة", (byCategory.get(r.item.category || "بدون مجموعة") || 0) + r.value));
    return `<div id="report-output">${chipsHTML([["عدد الأصناف", number(rows.length)], ["قيمة المخزون بالتكلفة", money(sumOf(rows, (r) => r.value))], ["قيمة المخزون بسعر البيع", money(sumOf(rows, (r) => r.saleValue))], ["نفد / منخفض", `${number(rows.filter((r) => r.status[0] === "نفد").length)} / ${number(rows.filter((r) => r.status[0] === "منخفض").length)}`]])}
      <div class="chart-grid">${chartCard("قيمة المخزون حسب المجموعة", donutChart([...byCategory].map(([label, value]) => ({ label, value }))))}${chartCard("أعلى 10 أصناف قيمة", hBars(rows.slice(0, 10).map((r) => ({ label: r.item.name, value: r.value })), "#f59e0b"))}</div>
      <p class="muted">تقرير المخزون يعرض الوضع الحالي ولا يتأثر بتاريخ الفترة.</p>
      ${reportTable(["الصنف", "الكود", "المجموعة", "الرصيد", "التكلفة", "قيمة المخزون", "سعر البيع", "آخر سعر بيع", "الحالة"], rows.map((r) => { const last = lastSaleAnyMap().get(r.item.id); return [escapeHTML(r.item.name), escapeHTML(r.item.code || "—"), escapeHTML(r.item.category || "—"), number(r.qty), money(r.item.costPrice), money(r.value), money(r.item.salePrice), last ? money(last.price) : "—", `<span class="badge${r.status[1]}">${r.status[0]}</span>`]; }))}</div>`;
  },
  payroll(report) {
    const rows = list("payroll").filter((r) => inRange(r.date, report.from, report.to)).sort((a, b) => String(b.month).localeCompare(String(a.month)));
    const s = monthlySeries(monthKeysBetween(report.from, report.to), report.from, report.to);
    const byEmployee = new Map();
    rows.forEach((r) => byEmployee.set(r.employeeName, (byEmployee.get(r.employeeName) || 0) + Number(r.net || 0)));
    return `<div id="report-output">${chipsHTML([["إجمالي الصافي المصروف", money(sumOf(rows, (r) => r.net))], ["عدد القسائم", number(rows.length)], ["إجمالي البدلات والمكافآت", money(sumOf(rows, (r) => Number(r.allowances || 0) + Number(r.bonus || 0)))], ["إجمالي الخصومات", money(sumOf(rows, (r) => r.deductions))]])}
      <div class="chart-grid">${chartCard("الرواتب شهريًا", barChart({ labels: s.labels, series: [{ name: "الرواتب", values: s.payroll, color: "#8b5cf6" }] }))}${chartCard("الصافي لكل موظف", hBars([...byEmployee].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 10), "#8b5cf6"))}</div>
      ${reportTable(["القسيمة", "الشهر", "الموظف", "الأساسي", "البدلات", "مكافأة", "خصومات", "الصافي"], rows.map((r) => [escapeHTML(r.number), escapeHTML(r.month), escapeHTML(r.employeeName), money(r.basic), money(r.allowances), money(r.bonus), money(r.deductions), money(r.net)]))}</div>`;
  },
  vat(report) {
    const d = periodData(report.from, report.to);
    const keys = monthKeysBetween(report.from, report.to);
    const pick = (name, kind) => list(name).filter((r) => (!kind || r.kind === kind) && inRange(r.date, report.from, report.to));
    const parts = { sales: pick("sales"), sret: pick("returns", "sales"), purchases: pick("purchases"), pret: pick("returns", "purchases"), expenses: pick("expenses") };
    const month = (rows, key, fn) => sumOf(rows.filter((r) => monthOf(r.date) === key), fn);
    const table = keys.map((key) => {
      const out = month(parts.sales, key, (r) => r.vatAmount) - month(parts.sret, key, (r) => r.vatAmount);
      const inn = month(parts.purchases, key, (r) => r.vatAmount) - month(parts.pret, key, (r) => r.vatAmount) + month(parts.expenses, key, (r) => r.vatAmount);
      const base = month(parts.sales, key, (r) => r.subtotal) - month(parts.sret, key, (r) => r.subtotal);
      return { key, base, out, inn, due: out - inn };
    });
    return `<div id="report-output">${chipsHTML([["ضريبة المخرجات (المبيعات بعد المرتجعات)", money(d.vatOut)], ["ضريبة المدخلات (مشتريات ومصروفات)", money(d.vatIn)], ["صافي الضريبة المستحقة", money(d.vatDue)]])}
      ${chartCard("ضريبة المخرجات والمدخلات شهريًا", barChart({ labels: table.map((r) => monthLabel(r.key)), series: [{ name: "المخرجات", values: table.map((r) => r.out), color: CHART_COLORS[0] }, { name: "المدخلات", values: table.map((r) => r.inn), color: "#f59e0b" }] }))}
      ${reportTable(["الشهر", "المبيعات الخاضعة", "ضريبة المخرجات", "ضريبة المدخلات", "الصافي"], table.map((r) => [escapeHTML(r.key), money(r.base), money(r.out), money(r.inn), money(r.due)]))}
      <p class="muted">للمراجعة الداخلية فقط، وليس إقرارًا ضريبيًا رسميًا. راجع محاسبك قبل التقديم.</p></div>`;
  },
  cashbook(report) {
    const entries = [];
    const add = (date, docNumber, type, cashbox, desc, inAmount, outAmount, at) => { if (inAmount || outAmount) entries.push({ date: String(date || ""), docNumber, type, cashbox: cashbox || "—", desc, inAmount: inAmount || 0, outAmount: outAmount || 0, at: String(at || "") }); };
    list("sales").forEach((r) => r.cashboxId && add(r.date, r.number, "فاتورة مبيعات", r.cashboxName, r.partnerName, Number(r.paid || 0), 0, r.createdAt));
    list("purchases").forEach((r) => r.cashboxId && add(r.date, r.number, "فاتورة مشتريات", r.cashboxName, r.partnerName, 0, Number(r.paid || 0), r.createdAt));
    list("payments").forEach((r) => add(r.date, r.number, r.type === "قبض" ? "سند قبض" : "سند صرف", r.cashboxName, r.partyName || r.note || "", r.type === "قبض" ? Number(r.amount || 0) : 0, r.type === "صرف" ? Number(r.amount || 0) : 0, r.createdAt));
    list("expenses").forEach((r) => add(r.date, r.number, "مصروف", r.cashboxName, r.description, 0, Number(r.total || 0), r.createdAt));
    list("returns").forEach((r) => r.cashboxId && add(r.date, r.number, r.kind === "sales" ? "مرتجع مبيعات" : "مرتجع مشتريات", r.cashboxName, r.partnerName, r.kind === "sales" ? 0 : Number(r.refunded || 0), r.kind === "sales" ? Number(r.refunded || 0) : 0, r.createdAt));
    list("payroll").forEach((r) => add(r.date, r.number, "راتب", r.cashboxName, r.employeeName, 0, Number(r.net || 0), r.createdAt));
    const rows = entries.filter((e) => inRange(e.date, report.from, report.to)).sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at));
    const byBox = new Map();
    rows.forEach((e) => { const g = byBox.get(e.cashbox) || { inAmount: 0, outAmount: 0 }; g.inAmount += e.inAmount; g.outAmount += e.outAmount; byBox.set(e.cashbox, g); });
    const boxes = [...byBox.keys()];
    const totalIn = sumOf(rows, (e) => e.inAmount);
    const totalOut = sumOf(rows, (e) => e.outAmount);
    return `<div id="report-output">${chipsHTML([["إجمالي المقبوضات", money(totalIn)], ["إجمالي المدفوعات", money(totalOut)], ["صافي الحركة", money(totalIn - totalOut)]])}
      ${chartCard("الداخل والخارج لكل خزينة", barChart({ labels: boxes, series: [{ name: "داخل", values: boxes.map((b) => byBox.get(b).inAmount), color: "#10b981" }, { name: "خارج", values: boxes.map((b) => byBox.get(b).outAmount), color: "#f43f5e" }] }))}
      ${reportTable(["التاريخ", "المستند", "النوع", "الخزينة", "البيان", "داخل", "خارج"], rows.map((e) => [escapeHTML(e.date), escapeHTML(e.docNumber || "—"), escapeHTML(e.type), escapeHTML(e.cashbox), escapeHTML(e.desc || "—"), e.inAmount ? money(e.inAmount) : "—", e.outAmount ? money(e.outAmount) : "—"]))}
      <p class="muted">لا يشمل الأرصدة الافتتاحية، ويعرض الحركات النقدية المسجلة فقط.</p></div>`;
  },
  balances() {
    const customers = list("customers").map((r) => ({ ...r, bal: Number(r.balance ?? r.openingBalance ?? 0) })).filter((r) => Math.abs(r.bal) > 0.004).sort((a, b) => b.bal - a.bal);
    const suppliers = list("suppliers").map((r) => ({ ...r, bal: Number(r.balance ?? r.openingBalance ?? 0) })).filter((r) => Math.abs(r.bal) > 0.004).sort((a, b) => b.bal - a.bal);
    const receivable = sumOf(customers.filter((r) => r.bal > 0), (r) => r.bal);
    const payable = sumOf(suppliers.filter((r) => r.bal > 0), (r) => r.bal);
    return `<div id="report-output">${chipsHTML([["مستحق على العملاء", money(receivable)], ["مستحق للموردين", money(payable)], ["الصافي", money(receivable - payable)]])}
      <div class="chart-grid">${chartCard("أعلى العملاء مديونية", hBars(customers.filter((r) => r.bal > 0).slice(0, 10).map((r) => ({ label: r.name, value: r.bal })), "#f59e0b"))}${chartCard("أعلى الموردين استحقاقًا", hBars(suppliers.filter((r) => r.bal > 0).slice(0, 10).map((r) => ({ label: r.name, value: r.bal })), "#f43f5e"))}</div>
      ${reportTable(["النوع", "الاسم", "الجوال", "الرصيد", "الحالة"], [...customers.map((r) => ["عميل", escapeHTML(r.name), escapeHTML(r.phone || "—"), money(Math.abs(r.bal)), r.bal > 0 ? "مدين (علينا تحصيله)" : "دائن (رصيد للعميل)"]), ...suppliers.map((r) => ["مورد", escapeHTML(r.name), escapeHTML(r.phone || "—"), money(Math.abs(r.bal)), r.bal > 0 ? "دائن (علينا سداده)" : "مدين (دفعنا زيادة)"])])}
      <p class="muted">الأرصدة الحالية ولا تتأثر بتاريخ الفترة. استخدم «كشف حساب» لتفاصيل أي حساب.</p></div>`;
  },
};

// ================= صفحة التحليلات =================
function renderAnalytics() {
  const a = state.analytics || (state.analytics = { from: `${new Date().getFullYear()}-01-01`, to: isoToday() });
  const d = periodData(a.from, a.to);
  const s = monthlySeries(monthKeysBetween(a.from, a.to), a.from, a.to);
  const items = aggregateItems(a.from, a.to);
  const customers = aggregateCustomers(a.from, a.to);
  const expenseTypes = new Map();
  d.expenses.forEach((r) => expenseTypes.set(r.typeName || "مصروف عام", (expenseTypes.get(r.typeName || "مصروف عام") || 0) + Number(r.amount || 0)));
  if (d.payrollNet) expenseTypes.set("رواتب", d.payrollNet);
  const stockByCategory = new Map();
  list("items").forEach((r) => stockByCategory.set(r.category || "بدون مجموعة", (stockByCategory.get(r.category || "بدون مجموعة") || 0) + Number(r.quantity || 0) * Number(r.costPrice || 0)));
  const cash = list("cashboxes").map((r) => ({ label: r.name, value: Number(r.balance ?? r.openingBalance ?? 0) }));
  const receivables = list("customers").map((r) => ({ label: r.name, value: Number(r.balance ?? r.openingBalance ?? 0) })).filter((r) => r.value > 0).sort((x, y) => y.value - x.value).slice(0, 10);
  const payables = list("suppliers").map((r) => ({ label: r.name, value: Number(r.balance ?? r.openingBalance ?? 0) })).filter((r) => r.value > 0).sort((x, y) => y.value - x.value).slice(0, 10);
  pageContent.innerHTML = `
    ${pageHeading("التحليلات والرسوم البيانية", "نظرة مرئية على المبيعات والأرباح والمصروفات والمخزون والأرصدة.", `<button class="button button-outline" data-action="print-report">طباعة</button>`)}
    <section class="card card-pad">
      <form id="analytics-form" class="report-controls">
        <label>من تاريخ<input type="date" name="from" value="${escapeHTML(a.from)}" required /></label>
        <label>إلى تاريخ<input type="date" name="to" value="${escapeHTML(a.to)}" required /></label>
        <button class="button button-primary">تحديث التحليل</button>
      </form>
      ${chipsHTML([["صافي المبيعات (قبل الضريبة)", money(d.salesNet)], ["مجمل الربح", money(d.grossProfit)], ["المصروفات + الرواتب", money(d.expensesNet + d.payrollNet)], ["صافي الربح التقديري", money(d.netProfit)], ["صافي المشتريات", money(d.purchasesNet)], ["صافي الضريبة المستحقة", money(d.vatDue)]])}
    </section>
    <div class="chart-grid">
      ${chartCard("المبيعات والمشتريات والمصروفات شهريًا", barChart({ labels: s.labels, series: [{ name: "المبيعات", values: s.sales, color: CHART_COLORS[0] }, { name: "المشتريات", values: s.purchases, color: "#f59e0b" }, { name: "المصروفات", values: s.expenses, color: "#f43f5e" }, { name: "الرواتب", values: s.payroll, color: "#8b5cf6" }] }))}
      ${chartCard("صافي الربح الشهري", barChart({ labels: s.labels, series: [{ name: "صافي الربح", values: s.profit, color: "#10b981" }] }))}
      ${chartCard("أعلى 10 أصناف مبيعًا", hBars(items.slice(0, 10).map((r) => ({ label: r.name, value: r.revenue }))))}
      ${chartCard("أعلى 10 عملاء", hBars(customers.slice(0, 10).map((r) => ({ label: r.name, value: r.net })), "#0ea5e9"))}
      ${chartCard("توزيع المصروفات", donutChart([...expenseTypes].map(([label, value]) => ({ label, value }))))}
      ${chartCard("قيمة المخزون حسب المجموعة", donutChart([...stockByCategory].map(([label, value]) => ({ label, value }))))}
      ${chartCard("أرصدة الخزن والبنوك", hBars(cash, "#14b8a6"))}
      ${chartCard("مستحقات العملاء (أعلى 10)", hBars(receivables, "#f59e0b"))}
      ${chartCard("مستحقات الموردين (أعلى 10)", hBars(payables, "#f43f5e"))}
    </div>`;
}
function bindAnalyticsEvents() {
  pageContent.addEventListener("submit", (event) => {
    if (event.target.id !== "analytics-form") return;
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    if (data.from > data.to) { showToast("تاريخ البداية يجب أن يسبق تاريخ النهاية.", "error"); return; }
    state.analytics = { from: data.from, to: data.to };
    renderPage();
  });
}

// ================= الرواتب =================
function renderPayroll() {
  const all = list("payroll");
  const rows = all.filter((r) => matchesFilter([r.number, r.month, r.employeeName, r.jobTitle, r.cashboxName, r.date])).sort((a, b) => String(b.month).localeCompare(String(a.month)) || String(b.date).localeCompare(String(a.date)));
  const month = isoToday().slice(0, 7);
  pageContent.innerHTML = `
    ${pageHeading("الرواتب", "صرف رواتب الموظفين شهريًا مع الخصم من الخزينة وطباعة القسائم.", `<button class="button button-primary" data-action="new-payroll">＋ صرف رواتب شهر</button>`)}
    <div class="stock-summary"><div class="summary-chip"><span>رواتب هذا الشهر</span><strong>${money(sumOf(all.filter((r) => r.month === month), (r) => r.net))}</strong></div><div class="summary-chip"><span>رواتب هذه السنة</span><strong>${money(sumOf(all.filter((r) => String(r.month).startsWith(month.slice(0, 4))), (r) => r.net))}</strong></div><div class="summary-chip"><span>عدد القسائم</span><strong>${number(all.length)}</strong></div></div>
    <section class="card card-pad">${searchBar("ابحث باسم الموظف أو الشهر أو رقم القسيمة", rows.length, "قسيمة")}${rows.length ? `<div class="table-wrap"><table><thead><tr><th>القسيمة</th><th>الشهر</th><th>الموظف</th><th>الأساسي</th><th>البدلات</th><th>مكافأة</th><th>خصومات</th><th>الصافي</th><th>الخزينة</th><th>إجراءات</th></tr></thead><tbody>${rows.map((r) => `<tr><td class="table-primary">${escapeHTML(r.number)}</td><td>${escapeHTML(r.month)}</td><td>${escapeHTML(r.employeeName)}<span class="table-sub">${escapeHTML(r.jobTitle || "")}</span></td><td>${money(r.basic)}</td><td>${money(r.allowances)}</td><td>${money(r.bonus)}</td><td>${money(r.deductions)}</td><td>${money(r.net)}</td><td>${escapeHTML(r.cashboxName || "—")}</td><td><div class="row-actions"><button class="small-button" data-action="print-payslip" data-id="${escapeHTML(r.id)}">طباعة القسيمة</button><button class="small-button" data-action="cancel-payroll" data-id="${escapeHTML(r.id)}">إلغاء الصرف</button></div></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state"><strong>لا توجد رواتب مصروفة</strong>أضف الموظفين ثم اضغط «صرف رواتب شهر».</div>`}</section>`;
}

function openPayrollForm() {
  const employees = list("employees").filter((e) => e.active !== false && e.status !== "موقوف");
  if (!employees.length) { showToast("أضف موظفًا نشطًا أولًا.", "error"); setPage("employees"); return; }
  if (!list("cashboxes").length) { showToast("أضف خزينة أو بنكًا أولًا من الإعدادات.", "error"); setPage("settings"); return; }
  showModal("صرف رواتب شهر", `
    <form id="payroll-form">
      <div class="form-grid cols-3">
        <label>شهر الراتب<input type="month" name="month" value="${isoToday().slice(0, 7)}" required /></label>
        <label>تاريخ الصرف<input type="date" name="date" value="${isoToday()}" required /></label>
        <label>الخزينة / البنك<select name="cashboxId" required>${optionsFor("cashboxes", "", "اختر الخزينة")}</select></label>
      </div>
      <div class="invoice-lines stack-lines"><div class="table-wrap"><table><thead><tr><th></th><th>الموظف</th><th>الأساسي</th><th>البدلات</th><th>مكافأة / إضافي</th><th>خصومات / سلف</th><th>الصافي</th></tr></thead><tbody data-rows></tbody></table></div></div>
      <div class="totals-box"><div class="total-row grand"><span>إجمالي الصافي</span><strong data-sum>0.00</strong></div></div>
      <p class="modal-error" data-error></p>
    </form>`, { footer: `<button class="button button-primary" form="payroll-form" type="submit">صرف الرواتب</button><button class="button button-outline" type="button" data-close-modal>إلغاء</button>` });
  const form = modalRoot.querySelector("#payroll-form");
  const tbody = form.querySelector("[data-rows]");
  const recalc = () => {
    let sum = 0;
    tbody.querySelectorAll("tr").forEach((tr) => {
      const emp = employees.find((e) => e.id === tr.dataset.emp);
      const net = Number(emp.basicSalary || 0) + Number(emp.allowances || 0) + Number(tr.querySelector(".pr-bonus").value || 0) - Number(tr.querySelector(".pr-ded").value || 0);
      tr.querySelector(".pr-net").textContent = net.toFixed(2);
      if (tr.querySelector(".pr-check").checked && !tr.querySelector(".pr-check").disabled) sum += net;
    });
    form.querySelector("[data-sum]").textContent = sum.toFixed(2);
  };
  const renderRows = () => {
    const paid = new Set(list("payroll").filter((p) => p.month === form.elements.month.value).map((p) => p.employeeId));
    tbody.innerHTML = employees.map((emp) => {
      const done = paid.has(emp.id);
      return `<tr data-emp="${escapeHTML(emp.id)}"><td><input type="checkbox" class="pr-check" ${done ? "disabled" : "checked"} /></td><td class="table-primary" data-label="الموظف">${escapeHTML(emp.name)}<span class="table-sub">${escapeHTML(emp.jobTitle || "")}${done ? " — تم صرفه لهذا الشهر" : ""}</span></td><td data-label="الأساسي">${money(emp.basicSalary)}</td><td data-label="البدلات">${money(emp.allowances)}</td><td data-label="مكافأة / إضافي"><input class="pr-bonus" type="number" min="0" step="0.01" value="0" inputmode="decimal" ${done ? "disabled" : ""} /></td><td data-label="خصومات / سلف"><input class="pr-ded" type="number" min="0" step="0.01" value="${Number(emp.deductions || 0)}" inputmode="decimal" ${done ? "disabled" : ""} /></td><td class="pr-net" data-label="الصافي">0.00</td></tr>`;
    }).join("");
    recalc();
  };
  form.elements.month.addEventListener("change", renderRows);
  tbody.addEventListener("input", recalc);
  tbody.addEventListener("change", recalc);
  renderRows();
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = modalRoot.querySelector('[form="payroll-form"]');
    setLoading(button, true);
    try {
      const month = form.elements.month.value;
      const cashbox = list("cashboxes").find((r) => r.id === form.elements.cashboxId.value);
      if (!cashbox) throw new Error("اختر الخزينة التي ستُصرف منها الرواتب.");
      const lines = [...tbody.querySelectorAll("tr")].filter((tr) => tr.querySelector(".pr-check").checked && !tr.querySelector(".pr-check").disabled).map((tr) => {
        const emp = employees.find((e) => e.id === tr.dataset.emp);
        const bonus = Number(tr.querySelector(".pr-bonus").value || 0);
        const deductions = Number(tr.querySelector(".pr-ded").value || 0);
        const net = roundMoney(Number(emp.basicSalary || 0) + Number(emp.allowances || 0) + bonus - deductions);
        if (bonus < 0 || deductions < 0) throw new Error("لا تُدخل قيمًا سالبة.");
        if (net < 0) throw new Error(`صافي راتب ${emp.name} سالب. راجع الخصومات.`);
        return { employeeId: emp.id, employeeName: emp.name, jobTitle: emp.jobTitle || "", basic: Number(emp.basicSalary || 0), allowances: Number(emp.allowances || 0), bonus, deductions, net };
      });
      if (!lines.length) throw new Error("اختر موظفًا واحدًا على الأقل.");
      await savePayroll({ month, date: form.elements.date.value, cashboxId: cashbox.id, cashboxName: cashbox.name, lines });
      closeModal();
      showToast("تم صرف الرواتب وخصمها من الخزينة.");
    } catch (error) {
      form.querySelector("[data-error]").textContent = explainError(error);
      setLoading(button, false);
    }
  });
}

async function savePayroll({ month, date, cashboxId, cashboxName, lines }) {
  const counterRef = doc(db, "counters", "payroll");
  const cashRef = doc(db, "cashboxes", cashboxId);
  const refs = lines.map((line) => doc(db, "payroll", `${month}_${line.employeeId}`));
  await runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    const cashSnap = await transaction.get(cashRef);
    const snaps = [];
    for (const ref of refs) snaps.push(await transaction.get(ref));
    if (!cashSnap.exists()) throw new Error("الخزينة المحددة غير موجودة.");
    snaps.forEach((snap, i) => { if (snap.exists()) throw new Error(`تم صرف راتب ${lines[i].employeeName} لهذا الشهر مسبقًا.`); });
    let counter = Number(counterSnap.data()?.value || 0);
    const createdAt = new Date().toISOString();
    lines.forEach((line, i) => {
      counter += 1;
      transaction.set(refs[i], { ...line, number: `PAY-${String(counter).padStart(5, "0")}`, month, date, cashboxId, cashboxName, createdAt, createdBy: state.user.email });
    });
    transaction.set(counterRef, { value: counter }, { merge: true });
    transaction.update(cashRef, { balance: Number(cashSnap.data().balance ?? cashSnap.data().openingBalance ?? 0) - sumOf(lines, (l) => l.net) });
  });
}

async function cancelPayroll(id) {
  const row = list("payroll").find((r) => r.id === id);
  if (!row || !window.confirm(`إلغاء صرف راتب ${row.employeeName} لشهر ${row.month}؟ سيُعاد المبلغ إلى الخزينة.`)) return;
  try {
    const ref = doc(db, "payroll", id);
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists()) throw new Error("القسيمة غير موجودة.");
      const cashRef = snap.data().cashboxId ? doc(db, "cashboxes", snap.data().cashboxId) : null;
      const cashSnap = cashRef ? await transaction.get(cashRef) : null;
      transaction.delete(ref);
      if (cashRef && cashSnap.exists()) transaction.update(cashRef, { balance: Number(cashSnap.data().balance ?? cashSnap.data().openingBalance ?? 0) + Number(snap.data().net || 0) });
    });
    showToast("تم إلغاء الصرف وإعادة المبلغ للخزينة.");
  } catch (error) {
    showToast(explainError(error), "error");
  }
}
// ===== BLOCK3 END =====

function openEntityManager(entity) {
  const config = entityConfig[entity];
  const rows = list(config.collection);
  const body = `<div class="toolbar"><button class="button button-primary" type="button" data-modal-add>＋ ${escapeHTML(config.add)}</button><span class="muted">${number(rows.length)} سجل</span></div>${entityTable(entity, rows)}`;
  showModal(config.title, body);
  modalRoot.querySelector("[data-modal-add]").addEventListener("click", () => {
    closeModal();
    openEntityForm(entity);
  });
  modalRoot.querySelectorAll('[data-action="edit-entity"]').forEach((button) => button.addEventListener("click", () => {
    const row = list(config.collection).find((item) => item.id === button.dataset.id);
    closeModal();
    if (row) openEntityForm(entity, row);
  }));
  modalRoot.querySelectorAll('[data-action="delete-entity"]').forEach((button) => button.addEventListener("click", () => deleteEntity(entity, button.dataset.id)));
}

function startLiveSync() {
  state.unsubscribers.forEach((unsubscribe) => unsubscribe());
  state.unsubscribers = [];
  for (const collectionName of Object.keys(state.collections)) {
    const unsubscribe = onSnapshot(collection(db, collectionName), (snapshot) => {
      state.collections[collectionName] = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
      scheduleRender();
    }, (error) => {
      showToast(explainError(error), "error");
    });
    state.unsubscribers.push(unsubscribe);
  }
  const settingsUnsubscribe = onSnapshot(doc(db, "settings", "company"), (snapshot) => {
    if (snapshot.exists()) {
      state.company = { ...state.company, ...snapshot.data() };
      const local = readLocalTheme();
      if (state.company.theme && local?.scope !== "device") {
        writeLocalTheme({ scope: "shared", theme: sanitizeTheme(state.company.theme) });
        if (!state.themeDirty) applyTheme(state.company.theme);
      }
    }
    scheduleRender();
  }, (error) => showToast(explainError(error), "error"));
  state.unsubscribers.push(settingsUnsubscribe);
}

async function refreshData() {
  const button = document.querySelector("#refresh-button");
  setLoading(button, true, "جارٍ التحديث...");
  try {
    await Promise.all(Object.keys(state.collections).map(async (collectionName) => {
      const snapshot = await getDocs(collection(db, collectionName));
      state.collections[collectionName] = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
    }));
    renderPage();
    showToast("تم تحديث البيانات.");
  } catch (error) {
    showToast(explainError(error), "error");
  } finally {
    setLoading(button, false);
  }
}

async function exportData() {
  try {
    const countersSnap = await getDocs(collection(db, "counters"));
    const payload = {
      exportedAt: new Date().toISOString(),
      company: state.company,
      collections: state.collections,
      counters: Object.fromEntries(countersSnap.docs.map((entry) => [entry.id, entry.data()])),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `daftar-backup-${isoToday()}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast("تم تنزيل النسخة الاحتياطية.");
  } catch (error) {
    showToast(explainError(error), "error");
  }
}

async function importData(file) {
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    if (!payload.collections || !window.confirm("سيتم دمج بيانات النسخة داخل قاعدة Firestore الحالية. هل تريد المتابعة؟")) return;
    const entries = Object.entries(payload.collections).flatMap(([collectionName, rows]) => {
      if (!state.collections[collectionName] || !Array.isArray(rows)) return [];
      return rows.filter((row) => row.id).map((row) => ({ collectionName, row }));
    });
    if (!entries.length) throw new Error("النسخة لا تحتوي على بيانات قابلة للاستعادة.");
    for (let offset = 0; offset < entries.length; offset += 400) {
      const chunk = entries.slice(offset, offset + 400);
      await Promise.all(chunk.map(({ collectionName, row }) => {
        const { id, ...data } = row;
        return setDoc(doc(db, collectionName, id), data, { merge: true });
      }));
    }
    if (payload.counters && typeof payload.counters === "object") {
      const current = await getDocs(collection(db, "counters"));
      const currentValues = Object.fromEntries(current.docs.map((entry) => [entry.id, Number(entry.data().value || 0)]));
      await Promise.all(["sales", "purchases", "payments", "expenses", "salesReturns", "purchaseReturns", "payroll"].filter((id) => payload.counters[id]).map((id) => setDoc(doc(db, "counters", id), { value: Math.max(currentValues[id] || 0, Number(payload.counters[id].value || 0)) }, { merge: true })));
    }
    if (payload.company) await setDoc(doc(db, "settings", "company"), payload.company, { merge: true });
    showToast("تم استعادة بيانات النسخة.");
  } catch (error) {
    showToast(explainError(error), "error");
  }
}

async function checkAuthorization(user) {
  const membership = await getDoc(doc(db, "authorizedUsers", user.uid));
  if (!membership.exists()) {
    loginMessage.innerHTML = `<div class="access-denied"><strong>ليس لديك صلاحية الوصول.</strong><p>أضف مستندًا في مجموعة authorizedUsers من Firebase Console، واجعل معرّف المستند هو الـ UID التالي:</p><div class="uid-row"><input type="text" readonly value="${escapeHTML(user.uid)}" dir="ltr" /><button type="button" class="button button-outline" data-copy-uid>نسخ</button></div></div>`;
    loginMessage.querySelector("[data-copy-uid]").addEventListener("click", async () => {
      const field = loginMessage.querySelector(".uid-row input");
      try { await navigator.clipboard.writeText(user.uid); } catch { field.select(); document.execCommand("copy"); }
      showToast("تم نسخ الـ UID.");
    });
    await signOut(auth);
    return false;
  }
  return true;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!auth) return;
  const button = loginForm.querySelector("button");
  setLoading(button, true, "جارٍ تسجيل الدخول...");
  loginMessage.textContent = "";
  try {
    const data = new FormData(loginForm);
    await signInWithEmailAndPassword(auth, data.get("email"), data.get("password"));
  } catch (error) {
    loginMessage.textContent = explainError(error, "auth");
  } finally {
    setLoading(button, false);
  }
});

document.querySelector("#logout-button").addEventListener("click", () => signOut(auth));
document.querySelector("#refresh-button").addEventListener("click", refreshData);
document.querySelector("#main-nav").addEventListener("click", (event) => {
  const button = event.target.closest("[data-page]");
  if (button) setPage(button.dataset.page);
});
document.querySelector(".brand").addEventListener("click", (event) => {
  event.preventDefault();
  setPage("dashboard");
});
const toggleMenu = (force) => {
  const open = document.querySelector(".sidebar").classList.toggle("mobile-open", force);
  document.body.classList.toggle("menu-open", open);
};
document.querySelector("#mobile-menu").addEventListener("click", () => toggleMenu());
document.querySelector("#menu-backdrop").addEventListener("click", () => toggleMenu(false));
bindPageEvents();
bindComboEvents();
bindThemeEvents();
applyTheme(effectiveTheme());
{
  let wasNarrow = window.innerWidth < 700;
  window.addEventListener("resize", () => {
    const nowNarrow = window.innerWidth < 700;
    if (nowNarrow !== wasNarrow) { wasNarrow = nowNarrow; scheduleRender(); }
  });
}
bindStatementEvents();
bindAnalyticsEvents();

document.querySelector("#today-label").textContent = new Intl.DateTimeFormat("ar-SA", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

if (!isConfigured) {
  loginMessage.textContent = "أضف إعدادات Firebase إلى firebase-config.js أولًا، ثم أعد تحميل الصفحة.";
  loginForm.querySelectorAll("input, button").forEach((input) => input.disabled = true);
} else {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      state.user = null;
      state.themeDirty = false;
      state.themeDraft = null;
      applyTheme(effectiveTheme());
      syncThemeBar();
      Object.keys(state.collections).forEach((key) => { state.collections[key] = []; });
      state.report = null;
      modalRoot.innerHTML = "";
      state.unsubscribers.forEach((unsubscribe) => unsubscribe());
      state.unsubscribers = [];
      appShell.classList.add("is-hidden");
      loginScreen.classList.remove("is-hidden");
      return;
    }
    try {
      const allowed = await checkAuthorization(user);
      if (!allowed) return;
      state.user = user;
      document.querySelector("#user-email").textContent = user.email || "مستخدم";
      loginScreen.classList.add("is-hidden");
      appShell.classList.remove("is-hidden");
      startLiveSync();
      setPage(state.page);
    } catch (error) {
      loginMessage.textContent = explainError(error, "authorization");
      await signOut(auth);
    }
  });
}
