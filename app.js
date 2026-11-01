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
  },
  company: { name: "منشأتك", vatRate: 15, currency: "ر.س" },
  filter: "",
  report: null,
  statement: null,
  unsubscribers: [],
};

const titles = {
  dashboard: "الرئيسية وتحليل العمل والأرباح",
  sales: "فواتير المبيعات",
  purchases: "فواتير المشتريات",
  items: "الأصناف والمخزون",
  customers: "العملاء",
  suppliers: "الموردون",
  employees: "الموظفون والرواتب",
  payments: "سندات القبض والصرف",
  expenses: "المصروفات العامة",
  inventory: "حركة المخزون",
  reports: "التقارير والأرباح والخسائر",
  returns: "المرتجعات",
  statements: "كشف حساب عميل / مورد",
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
      { key: "salePrice", label: "سعر البيع الافتراضي قبل الضريبة", type: "number", required: true, min: 0 },
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
  employees: {
    title: "الموظفون والرواتب",
    collection: "employees",
    add: "موظف جديد",
    search: "ابحث باسم الموظف أو الوظيفة أو الجوال",
    fields: [
      { key: "code", label: "كود الموظف", required: true },
      { key: "name", label: "اسم الموظف", required: true },
      { key: "jobTitle", label: "المسمى الوظيفي" },
      { key: "phone", label: "رقم الجوال", type: "tel" },
      { key: "salary", label: "الراتب الأساسي الشهرى", type: "number", min: 0, required: true },
      { key: "startDate", label: "تاريخ التعاقد", type: "date" },
    ],
    columns: [
      ["code", "الكود"],
      ["name", "اسم الموظف"],
      ["jobTitle", "المسمى الوظيفي"],
      ["phone", "الجوال"],
      ["salary", "الراتب", "money"],
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

const comboSources = {
  items: () => list("items").map((r) => ({ id: r.id, label: r.name || r.code, sub: `${r.code || ""} · الرصيد ${number(r.quantity)}${r.barcode ? ` · ${r.barcode}` : ""}`, search: [r.name, r.code, r.barcode, r.category], low: r.trackInventory !== false && Number(r.quantity || 0) <= 0 })),
  customers: () => list("customers").map((r) => ({ id: r.id, label: r.name, sub: [r.code, r.phone].filter(Boolean).join(" · "), search: [r.name, r.code, r.phone, r.taxNumber] })),
  suppliers: () => list("suppliers").map((r) => ({ id: r.id, label: r.name, sub: [r.code, r.phone].filter(Boolean).join(" · "), search: [r.name, r.code, r.phone, r.taxNumber] })),
  employees: () => list("employees").map((r) => ({ id: r.id, label: r.name, sub: [r.code, r.jobTitle, r.phone].filter(Boolean).join(" · "), search: [r.name, r.code, r.jobTitle, r.phone] })),
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
  if (code.includes("auth/operation-not-allowed")) return "تسجيل الدخول بالبريد غير مفعّل في Firebase Authentication.";
  if (code.includes("permission-denied")) return "ليس لديك صلاحية الوصول. تأكد من إضافة UID المستخدم إلى authorizedUsers في Firebase.";
  if (code.includes("unavailable")) return "تعذر الاتصال بقاعدة بيانات Firestore.";
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
  renderPage();
}

function renderPage() {
  if (!state.user) return;
  const renderers = {
    dashboard: renderDashboard,
    sales: () => renderInvoices("sales"),
    purchases: () => renderInvoices("purchases"),
    items: () => renderEntity("items"),
    customers: () => renderEntity("customers"),
    suppliers: () => renderEntity("suppliers"),
    employees: () => renderEntity("employees"),
    payments: renderPayments,
    expenses: renderExpenses,
    inventory: renderInventory,
    reports: renderReports,
    returns: renderReturns,
    statements: renderStatements,
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

// دالة حساب آخر سعر بيع للصنف للعميل المحدد
function getLastSalePrice(partnerId, itemId) {
  if (!partnerId) return null;
  const sales = list("sales").filter((s) => s.partnerId === partnerId);
  for (const sale of sales) {
    const line = (sale.lines || []).find((l) => l.itemId === itemId);
    if (line) return Number(line.price);
  }
  return null;
}

function renderDashboard() {
  const retSum = (test) => list("returns").filter((row) => row.kind === "sales" && test(String(row.date || ""))).reduce((sum, row) => sum + Number(row.total || 0), 0);
  const todaySales = -retSum((d) => d === isoToday()) + list("sales").filter((row) => row.date === isoToday()).reduce((sum, row) => sum + Number(row.total || 0), 0);
  const monthPrefix = isoToday().slice(0, 7);
  const monthSales = -retSum((d) => d.startsWith(monthPrefix)) + list("sales").filter((row) => String(row.date || "").startsWith(monthPrefix)).reduce((sum, row) => sum + Number(row.total || 0), 0);
  
  // حساب الأرباح التقديرية للشهر
  const monthInvoices = list("sales").filter((row) => String(row.date || "").startsWith(monthPrefix));
  const monthCost = monthInvoices.reduce((sum, inv) => sum + (inv.lines || []).reduce((s, l) => s + Number(l.costPrice || 0) * Number(l.quantity || 0), 0), 0);
  const monthExpenses = list("expenses").filter((row) => String(row.date || "").startsWith(monthPrefix)).reduce((sum, r) => sum + Number(r.total || 0), 0);
  const monthProfit = (monthSales - monthCost) - monthExpenses;

  const customerBalances = list("customers").reduce((sum, row) => sum + Number(row.balance ?? row.openingBalance ?? 0), 0);
  const cashBalance = list("cashboxes").reduce((sum, row) => sum + Number(row.balance ?? row.openingBalance ?? 0), 0);
  const lowItems = list("items").filter((row) => Number(row.lowStock || 0) > 0 && Number(row.quantity || 0) <= Number(row.lowStock || 0));
  const recent = [...list("sales")].sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).slice(0, 5);

  pageContent.innerHTML = `
    ${pageHeading(`أهلًا بك في ${escapeHTML(state.company.name || "منشأتك")}`, "تحليل العمل اليومي وأهم المؤشرات المالية والتشغيلية.", `<button class="button button-primary" data-action="new-sale">＋ فاتورة مبيعات جديدة</button>`)}
    <div class="stats-grid">
      ${statCard("مبيعات اليوم", money(todaySales), "↗", "صافي الفواتير بعد المرتجعات")}
      ${statCard("مبيعات الشهر", money(monthSales), "▥", "إجمالي المبيعات الشهرية")}
      ${statCard("صافي ربح الشهر", money(monthProfit), "⚡", "بعد خصم التكلفة والمصروفات")}
      ${statCard("أرصدة الخزن والبنوك", money(cashBalance), "▣", "الرصيد النقدي المتاح")}
    </div>
    <div class="quick-actions">
      <button class="quick-action" data-action="new-sale"><span>↗</span><span><strong>فاتورة مبيعات</strong><small>كاشير وعادي مع طباعة</small></span></button>
      <button class="quick-action" data-action="new-purchase"><span>↙</span><span><strong>فاتورة مشتريات</strong><small>توريد مخزون جديد</small></span></button>
      <button class="quick-action" data-action="new-expense"><span>−</span><span><strong>تسجيل مصروف</strong><small>متابعة التكاليف اليومية</small></span></button>
      <button class="quick-action" data-action="new-payment"><span>⇄</span><span><strong>سند قبض / صرف</strong><small>حركة الخزينة والعملاء</small></span></button>
    </div>
    <div class="dashboard-grid">
      <section class="card card-pad"><div class="card-title"><h3>أحدث فواتير المبيعات</h3><button class="text-link" data-page="sales">عرض الكل</button></div>${invoiceTable(recent, "sales", true)}</section>
      <section class="card card-pad"><div class="card-title"><h3>أصناف وصلت لحد التنبيه</h3><button class="text-link" data-page="items">إدارة المخزون</button></div>${lowItems.length ? `<div class="table-wrap"><table><thead><tr><th>الصنف</th><th>الرصيد</th><th>حد التنبيه</th></tr></thead><tbody>${lowItems.slice(0, 6).map((item) => `<tr><td class="table-primary">${escapeHTML(item.name)}</td><td>${number(item.quantity)}</td><td>${number(item.lowStock)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state"><strong>لا توجد تنبيهات مخزون</strong>جميع الأصناف بوفرة آمنة.</div>`}</section>
    </div>`;
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

function entityTable(entity, rows) {
  const config = entityConfig[entity];
  if (!rows.length) return `<div class="empty-state"><strong>لا توجد بيانات بعد</strong>أضف أول سجل للبدء باستخدام هذا القسم.</div>`;
  const head = config.columns.map(([, label]) => `<th>${label}</th>`).join("");
  const body = rows.map((row) => `<tr>${config.columns.map(([key, , type]) => `<td>${type === "money" ? money(row[key]) : escapeHTML(row[key] ?? "—")}</td>`).join("")}<td><div class="row-actions">${entity === "customers" || entity === "suppliers" ? `<button class="small-button" data-action="open-statement" data-entity="${entity}" data-id="${escapeHTML(row.id)}">كشف حساب</button>` : ""}${entity === "employees" ? `<button class="small-button" data-action="pay-salary" data-id="${escapeHTML(row.id)}">صرف راتب</button>` : ""}<button class="small-button" data-action="edit-entity" data-entity="${entity}" data-id="${escapeHTML(row.id)}">تعديل</button><button class="small-button" data-action="delete-entity" data-entity="${entity}" data-id="${escapeHTML(row.id)}">حذف</button></div></td></tr>`).join("");
  return `<div class="table-wrap"><table><thead><tr>${head}<th>الإجراءات</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

function renderInvoices(type) {
  const title = type === "sales" ? "فواتير المبيعات" : "فواتير المشتريات";
  const rows = list(type).filter((row) => matchesFilter([row.number, row.partnerName, row.date, row.note, row.total])).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  pageContent.innerHTML = `
    ${pageHeading(title, "عرض ومتابعة الفواتير مع خيارات الطباعة الفورية.", `<button class="button button-primary" data-action="new-${type === "sales" ? "sale" : "purchase"}">＋ فاتورة جديدة</button>`)}
    <section class="card card-pad"><div class="toolbar"><input class="toolbar-search" data-filter placeholder="ابحث برقم الفاتورة أو اسم الجهة" value="${escapeHTML(state.filter)}" /><span class="muted">${number(rows.length)} فاتورة</span></div>${invoiceTable(rows, type)}</section>`;
}

function invoiceTable(rows, type, compact = false) {
  if (!rows.length) return `<div class="empty-state"><strong>لا توجد فواتير مسجلة</strong>ابدأ بإضافة أول فاتورة.</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>رقم الفاتورة</th><th>التاريخ</th><th>${type === "sales" ? "العميل" : "المورد"}</th><th>الإجمالي</th>${compact ? "" : "<th>المدفوع</th><th>المتبقي</th>"}<th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>${rows.map((row) => `<tr><td class="table-primary">${escapeHTML(row.number || "—")}</td><td>${escapeHTML(row.date || "—")}</td><td>${escapeHTML(row.partnerName || "نقدي")}</td><td>${money(row.total)}</td>${compact ? "" : `<td>${money(row.paid)}</td><td>${money(row.due)}</td>`}<td><span class="badge${Number(row.due) > 0 ? " warning" : ""}">${Number(row.due) > 0 ? "آجل" : "مكتملة"}</span></td><td><div class="row-actions"><button class="small-button" data-action="view-invoice" data-type="${type}" data-id="${escapeHTML(row.id)}">عرض وطباعة</button></div></td></tr>`).join("")}</tbody></table></div>`;
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
    ${pageHeading("المصروفات العامة", "سجّل المصروفات ورواتب الموظفين وتابع إجمالي المنصرفات.", `<button class="button button-primary" data-action="new-expense">＋ تسجيل مصروف</button>`)}
    <div class="stock-summary"><div class="summary-chip"><span>إجمالي المصروفات المسجلة</span><strong>${money(total)}</strong></div><div class="summary-chip"><span>عدد السجلات</span><strong>${number(rows.length)}</strong></div></div>
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
    ${pageHeading("التقارير والأرباح والخسائر", "تقارير مالية شاملة وتحليل كامل للأرباح خلال الفترات المحددة.")}
    <section class="card card-pad">
      <form id="report-form" class="report-controls">
        <label>نوع التقرير<select name="type"><option value="sales"${selected("sales", report?.type || "sales")}>المبيعات والأرباح</option><option value="purchases"${selected("purchases", report?.type)}>المشتريات</option><option value="expenses"${selected("expenses", report?.type)}>المصروفات</option><option value="returns"${selected("returns", report?.type)}>المرتجعات</option></select></label>
        <label>من تاريخ<input type="date" name="from" value="${report?.from || localDateValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}" required /></label>
        <label>إلى تاريخ<input type="date" name="to" value="${report?.to || isoToday()}" required /></label>
        <button class="button button-primary">عرض التقرير وتحليل الأرباح</button>
        ${report ? `<button type="button" class="button button-outline" data-action="print-report">طباعة التقرير</button>` : ""}
      </form>
      ${report ? reportMarkup(report) : `<div class="empty-state"><strong>اختر فترة التقرير</strong>حدد نوع التقرير والتواريخ ثم اضغط عرض التقرير وتحليل الأرباح.</div>`}
    </section>`;
}

function reportMarkup(report) {
  const rows = report.rows;
  const total = rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const tax = rows.reduce((sum, row) => sum + Number(row.vatAmount || 0), 0);
  const count = rows.length;
  const periodReturns = (report.type === "sales" || report.type === "purchases") ? list("returns").filter((row) => row.kind === report.type && row.date >= report.from && row.date <= report.to) : [];
  const returnsTotal = periodReturns.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const returnsProfit = report.type === "sales" ? periodReturns.reduce((sum, row) => sum + (row.lines || []).reduce((s, line) => s + Number(line.net || 0) - Number(line.costPrice || 0) * Number(line.quantity || 0), 0), 0) : 0;
  
  const salesRevenue = report.type === "sales" ? total - returnsTotal : 0;
  const grossProfit = report.type === "sales" ? (rows.reduce((sum, row) => sum + (row.lines || []).reduce((s, line) => s + Number(line.net || 0) - Number(line.costPrice || 0) * Number(line.quantity || 0), 0), 0) - returnsProfit) : 0;
  const periodExpenses = list("expenses").filter((row) => row.date >= report.from && row.date <= report.to).reduce((sum, r) => sum + Number(r.total || 0), 0);
  const netProfit = grossProfit - periodExpenses;

  const returnChips = periodReturns.length || report.type === "sales" ? `<div class="summary-chip"><span>المرتجعات (${number(periodReturns.length)})</span><strong>${money(returnsTotal)}</strong></div>` : "";
  const profitMarkup = report.type === "sales" ? `<div class="summary-chip"><span>إجمالي المبيعات الصافية</span><strong>${money(salesRevenue)}</strong></div><div class="summary-chip"><span>إجمالي مجمل الربح</span><strong>${money(grossProfit)}</strong></div><div class="summary-chip"><span>إجمالي المصروفات والرواتب</span><strong>${money(periodExpenses)}</strong></div><div class="summary-chip"><span>صافي الأرباح والخسائر</span><strong style="color:${netProfit >= 0 ? '#10b981':'#ef4444'}">${money(netProfit)}</strong></div>` : "";

  const table = report.type === "expenses"
    ? `<div class="table-wrap"><table><thead><tr><th>رقم المصروف</th><th>التاريخ</th><th>النوع</th><th>التفاصيل</th><th>الضريبة</th><th>الإجمالي</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHTML(row.number)}</td><td>${escapeHTML(row.date)}</td><td>${escapeHTML(row.typeName)}</td><td>${escapeHTML(row.description || "—")}</td><td>${money(row.vatAmount)}</td><td>${money(row.total)}</td></tr>`).join("")}</tbody></table></div>`
    : report.type === "returns" ? returnsTable(rows) : invoiceTable(rows, report.type);
  return `<div id="report-output"><div class="stock-summary"><div class="summary-chip"><span>عدد المستندات</span><strong>${number(count)}</strong></div><div class="summary-chip"><span>إجمالي القيمة</span><strong>${money(total)}</strong></div><div class="summary-chip"><span>ضريبة القيمة المضافة</span><strong>${money(tax)}</strong></div>${returnChips}${profitMarkup}</div>${rows.length ? table : `<div class="empty-state">لا توجد نتائج في الفترة المختارة.</div>`}</div>`;
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
        <div class="span-3"><button class="button button-primary">حفظ الإعدادات</button></div>
      </form>
    </section>
    <section class="card card-pad settings-section"><h3>البيانات الأساسية</h3><div class="quick-actions">
      ${["cashboxes","warehouses","expenseTypes","employees"].map((key) => `<button class="quick-action" data-action="manage-entity" data-entity="${key}"><span>＋</span><span><strong>${entityConfig[key].title}</strong><small>${number(list(key).length)} سجل</small></span></button>`).join("")}
    </div></section>
    <section class="card card-pad settings-section"><h3>النسخ الاحتياطي</h3><p class="muted">نزّل نسخة JSON من بياناتك الحالية أو استعد نسخة سابقة.</p><div class="heading-actions"><button class="button button-outline" data-action="export-data">تنزيل نسخة احتياطية</button><label class="button button-outline file-button">استعادة نسخة<input type="file" accept="application/json,.json" data-action="import-data" hidden /></label></div></section>`;
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
  const cashOptions = optionsFor("cashboxes", "", "بدون سداد الآن (آجل)");
  const body = `
    <form id="invoice-form">
      <div class="form-grid cols-3">
        <label>التاريخ<input name="date" type="date" value="${isoToday()}" required /></label>
        <label>${partnerLabel}${comboHTML({ name: "partnerId", source: partnerCollection, placeholder: isSale ? "عميل نقدي — اكتب للبحث" : "اكتب للبحث عن المورد" })}</label>
        <label>نوع الفاتورة<select name="invoiceStyle"><option value="standard">فاتورة عادية (A4)</option><option value="pos">فاتورة كاشير (حرارية)</option></select></label>
        <label>المخزن<select name="warehouseId">${optionsFor("warehouses", "")}</select></label>
        <label>الخزينة / البنك<select name="cashboxId">${cashOptions}</select></label>
        <label>المدفوع الآن<input name="paid" type="number" min="0" step="0.01" value="0" /></label>
        <label class="span-3">ملاحظات<input name="note" /></label>
      </div>
      <div class="invoice-lines"><div class="card-title"><h3>بنود الفاتورة وآخر أسعار البيع</h3><button class="button button-outline" type="button" data-add-line>＋ إضافة صنف</button></div>
        <div class="table-wrap"><table><thead><tr><th>الصنف (آخر سعر بيع للعميل)</th><th>الكمية</th><th>السعر قبل الضريبة</th><th>خصم %</th><th>الإجمالي شامل الضريبة</th><th></th></tr></thead><tbody data-lines></tbody></table></div>
      </div>
      <div class="totals-box"><div class="total-row"><span>قبل الضريبة</span><strong data-subtotal>0.00</strong></div><div class="total-row"><span>الضريبة</span><strong data-tax>0.00</strong></div><div class="total-row grand"><span>الإجمالي</span><strong data-total>0.00</strong></div><div class="total-row"><span>المتبقي</span><strong data-due>0.00</strong></div></div>
      <p class="modal-error" data-error></p>
    </form>`;
  showModal(isSale ? "فاتورة مبيعات جديدة" : "فاتورة مشتريات جديدة", body, { footer: `<button class="button button-primary" form="invoice-form" type="submit">حفظ وطباعة الفاتورة</button><button class="button button-outline" type="button" data-close-modal>إلغاء</button>` });
  const form = modalRoot.querySelector("#invoice-form");
  const lines = form.querySelector("[data-lines]");

  const lineItem = (row) => list("items").find((entry) => entry.id === row.querySelector(".line-item").value);
  
  function updateItemPrices() {
    const partnerId = form.elements.partnerId.value;
    [...lines.querySelectorAll("tr")].forEach((row) => {
      const item = lineItem(row);
      if (item && isSale) {
        const lastPrice = getLastSalePrice(partnerId, item.id);
        const priceInput = row.querySelector(".line-price");
        if (lastPrice !== null) {
          priceInput.value = lastPrice;
          row.querySelector(".last-price-tip").textContent = `آخر سعر: ${money(lastPrice)}`;
        } else {
          row.querySelector(".last-price-tip").textContent = `سعر افتراضي: ${money(item.salePrice)}`;
        }
      }
      updateLine(row);
    });
  }

  function addLine(focus = false) {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${comboHTML({ source: "items", className: "line-item", placeholder: "ابحث بالاسم أو الكود أو الباركود" })}<small class="muted last-price-tip" style="display:block;margin-top:2px;"></small></td><td><input class="line-qty" type="number" min="0.001" step="any" value="1" required /></td><td><input class="line-price" type="number" min="0" step="0.01" value="0" required /></td><td><input class="line-discount" type="number" min="0" max="100" step="0.01" value="0" /></td><td class="line-total">0.00</td><td><button class="small-button" type="button" data-remove-line>حذف</button></td>`;
    lines.append(row);
    updateLine(row);
    if (focus) row.querySelector(".combo-input").focus();
  }

  function updateLine(row, itemChanged = false) {
    const item = lineItem(row);
    if (itemChanged && item) {
      const partnerId = form.elements.partnerId.value;
      const lastPrice = isSale ? getLastSalePrice(partnerId, item.id) : null;
      row.querySelector(".line-price").value = lastPrice !== null ? lastPrice : Number(isSale ? item.salePrice : item.costPrice) || 0;
      if (isSale) {
        row.querySelector(".last-price-tip").textContent = lastPrice !== null ? `آخر سعر: ${money(lastPrice)}` : `سعر افتراضي: ${money(item.salePrice)}`;
      }
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
  form.elements.partnerId?.addEventListener("change", updateItemPrices);
  form.addEventListener("keydown", (event) => { if (event.key === "Enter" && event.target.matches("input")) event.preventDefault(); });
  
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
  form.elements.paid.addEventListener("input", updateTotals);
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
      const invoiceStyle = form.elements.invoiceStyle.value;

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
      if (paid < 0 || paid > total + 0.01) throw new Error("المبلغ المدفوع غير صحيح.");
      if (paid > 0 && !cashboxId) throw new Error("اختر الخزينة المستلمة للمبلغ.");

      const savedInvoice = await saveInvoice(type, {
        date: form.elements.date.value,
        partnerId: partner?.id || "",
        partnerName: partner?.name || "نقدي",
        cashboxId,
        cashboxName: cashbox?.name || "",
        warehouseId: form.elements.warehouseId.value,
        invoiceStyle,
        lines: itemLines,
        subtotal,
        vatAmount,
        total,
        paid,
        due: Math.max(0, total - paid),
        note: form.elements.note.value.trim(),
      });
      closeModal();
      showToast("تم حفظ الفاتورة بنجاح.");
      printInvoiceObject(type, savedInvoice);
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
  
  let createdInvoice = null;
  await runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    const partnerSnap = partnerRef ? await transaction.get(partnerRef) : null;
    const cashboxSnap = cashboxRef ? await transaction.get(cashboxRef) : null;
    const itemSnaps = [];
    for (const itemRef of itemRefs) itemSnaps.push(await transaction.get(itemRef));
    if (partnerRef && !partnerSnap.exists()) throw new Error("الجهة المحددة غير موجودة.");
    if (cashboxRef && !cashboxSnap.exists()) throw new Error("الخزينة غير موجودة.");
    for (const snap of itemSnaps) if (!snap.exists()) throw new Error("أحد الأصناف لم يعد موجودًا.");
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
    createdInvoice = { ...data, id: invoiceRef.id, number: numberText, createdAt: new Date().toISOString(), createdBy: state.user.email };
    transaction.set(invoiceRef, createdInvoice);
    transaction.set(counterRef, { value: nextNumber }, { merge: true });
    for (const [itemId, quantity] of quantities) {
      const item = itemRecords.get(itemId);
      if (item.trackInventory === false) continue;
      transaction.set(doc(collection(db, "stockMoves")), {
        number: numberText, date: data.date, itemId, itemName: item.name,
        type: isSale ? "بيع" : "شراء", quantity, costPrice: Number(item.costPrice || 0),
        note: `فاتورة ${isSale ? "مبيعات" : "مشتريات"} ${numberText}`,
        createdAt: createdInvoice.createdAt, createdBy: state.user.email,
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
  return createdInvoice;
}

// دالة طباعة الفاتورة سواء كاشير (POS) أو عادية (A4)
function printInvoiceObject(type, invoice) {
  const isPOS = invoice.invoiceStyle === "pos";
  const content = isPOS ? `
    <div class="pos-print-ticket">
      <div class="pos-header">
        <h3>${escapeHTML(state.company.name || "منشأتك")}</h3>
        <p>${type === "sales" ? "فاتورة مبيعات" : "فاتورة مشتريات"} — ${escapeHTML(invoice.number)}</p>
        <small>${escapeHTML(invoice.date)} | ${escapeHTML(invoice.partnerName || "نقدي")}</small>
      </div>
      <table class="pos-table">
        <thead><tr><th>الصنف</th><th>كمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
        <tbody>${(invoice.lines || []).map((l) => `<tr><td>${escapeHTML(l.itemName)}</td><td>${number(l.quantity)}</td><td>${money(l.total / l.quantity)}</td><td>${money(l.total)}</td></tr>`).join("")}</tbody>
      </table>
      <div style="margin-top:10px; border-top:1px dashed #ddd; padding-top:6px; font-size:11px;">
        <div style="display:flex; justify-content:space-between"><span>المجموع قبل الضريبة:</span><strong>${money(invoice.subtotal)}</strong></div>
        <div style="display:flex; justify-content:space-between"><span>الضريبة:</span><strong>${money(invoice.vatAmount)}</strong></div>
        <div style="display:flex; justify-content:space-between; font-weight:800; font-size:13px; margin-top:4px;"><span>الإجمالي النهائي:</span><strong>${money(invoice.total)}</strong></div>
        <div style="display:flex; justify-content:space-between; margin-top:4px;"><span>المدفوع:</span><strong>${money(invoice.paid)}</strong></div>
        <div style="display:flex; justify-content:space-between"><span>المتبقي:</span><strong>${money(invoice.due)}</strong></div>
      </div>
      <div style="text-align:center; margin-top:15px; font-size:10px; color:#555;">شكرًا لتعاملكم معنا</div>
    </div>
  ` : `
    <div style="padding:20px; font-family:Cairo,sans-serif; direction:rtl; text-align:right;">
      <div style="display:flex; justify-content:between; border-bottom:2px solid #333; padding-bottom:10px; margin-bottom:15px;">
        <div><h2>${escapeHTML(state.company.name || "منشأتك")}</h2><p>الرقم الضريبي: ${escapeHTML(state.company.taxNumber || "—")}</p></div>
        <div style="text-align:left;"><h3>${type === "sales" ? "فاتورة ضريبية مبيعات" : "فاتورة مشتريات"}</h3><p>رقم: ${escapeHTML(invoice.number)}</p><p>التاريخ: ${escapeHTML(invoice.date)}</p></div>
      </div>
      <p><strong>الجهة:</strong> ${escapeHTML(invoice.partnerName || "نقدي")}</p>
      <table style="width:100%; border-collapse:collapse; margin:15px 0;">
        <thead><tr style="background:#f1f5f9;"><th style="border:1px solid #cbd5e1; padding:8px;">الصنف</th><th style="border:1px solid #cbd5e1; padding:8px;">الكمية</th><th style="border:1px solid #cbd5e1; padding:8px;">السعر</th><th style="border:1px solid #cbd5e1; padding:8px;">الضريبة</th><th style="border:1px solid #cbd5e1; padding:8px;">الإجمالي</th></tr></thead>
        <tbody>${(invoice.lines || []).map((l) => `<tr><td style="border:1px solid #cbd5e1; padding:8px;">${escapeHTML(l.itemName)}</td><td style="border:1px solid #cbd5e1; padding:8px;">${number(l.quantity)}</td><td style="border:1px solid #cbd5e1; padding:8px;">${money(l.price)}</td><td style="border:1px solid #cbd5e1; padding:8px;">${money(l.vatAmount)}</td><td style="border:1px solid #cbd5e1; padding:8px;">${money(l.total)}</td></tr>`).join("")}</tbody>
      </table>
      <div style="width:300px; margin-right:auto; border:1px solid #cbd5e1; padding:10px; border-radius:8px;">
        <div style="display:flex; justify-content:space-between"><span>المبلغ قبل الضريبة:</span><strong>${money(invoice.subtotal)}</strong></div>
        <div style="display:flex; justify-content:space-between"><span>ضريبة القيمة المضافة:</span><strong>${money(invoice.vatAmount)}</strong></div>
        <div style="display:flex; justify-content:space-between; font-weight:800; border-top:1px solid #cbd5e1; padding-top:5px; margin-top:5px;"><span>الإجمالي الشامل:</span><strong>${money(invoice.total)}</strong></div>
      </div>
    </div>
  `;

  const printWindow = window.open("", "_blank");
  printWindow.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><title>طباعة الفاتورة ${escapeHTML(invoice.number)}</title><link rel="stylesheet" href="styles.css"></head><body>${content}</body></html>`);
  printWindow.document.close();
  setTimeout(() => { printWindow.focus(); printWindow.print(); printWindow.close(); }, 350);
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
        if (!cashSnap.exists()) throw new Error("الخزينة غير موجودة.");
        if (partyRef && !partySnap.exists()) throw new Error("الجهة غير موجودة.");
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
      showToast("تم حفظ السند وتحديث رصيد الخزينة بنجاح.");
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
      if (!cashbox) throw new Error("اختر الخزينة الصارفة للمبلغ.");
      const type = list("expenseTypes").find((row) => row.id === form.elements.typeId.value);
      const vatAmount = roundMoney(amount * rate / 100);
      const total = roundMoney(amount + vatAmount);
      const counterRef = doc(db, "counters", "expenses");
      const expenseRef = doc(collection(db, "expenses"));
      const cashRef = doc(db, "cashboxes", cashbox.id);
      await runTransaction(db, async (transaction) => {
        const [counterSnap, cashSnap] = await Promise.all([transaction.get(counterRef), transaction.get(cashRef)]);
        if (!cashSnap.exists()) throw new Error("الخزينة غير موجودة.");
        const next = Number(counterSnap.data()?.value || 0) + 1;
        transaction.set(counterRef, { value: next }, { merge: true });
        transaction.set(expenseRef, {
          number: `EXP-${String(next).padStart(5, "0")}`, date: form.elements.date.value,
          typeName: type?.name || "مصروف عام", description: form.elements.description.value.trim(),
          amount, vatAmount, total, cashboxId: cashbox.id, cashboxName: cashbox.name,
          createdAt: new Date().toISOString(), createdBy: state.user.email,
        });
        transaction.update(cashRef, { balance: Number(cashSnap.data().balance ?? cashSnap.data().openingBalance ?? 0) - total });
      });
      closeModal();
      showToast("تم تسجيل المصروف بنجاح.");
    } catch (error) {
      form.querySelector("[data-error]").textContent = explainError(error);
      setLoading(button, false);
    }
  });
}

// دالة صرف راتب لموظف وسجله كمصروف مباشر
async function payEmployeeSalary(employeeId) {
  const employee = list("employees").find((e) => e.id === employeeId);
  if (!employee) return;
  const cashboxes = list("cashboxes");
  if (!cashboxes.length) {
    showToast("أضف خزينة أو بنك أولًا لصرف الراتب.", "error");
    return;
  }
  const body = `<form id="salary-form" class="form-grid">
    <label>الموظف<input type="text" readonly value="${escapeHTML(employee.name)}" /></label>
    <label>مبلغ الراتب<input name="amount" type="number" min="0.01" step="0.01" value="${Number(employee.salary || 0)}" required /></label>
    <label>الخزينة / البنك<select name="cashboxId" required>${optionsFor("cashboxes", "", "اختر الخزينة")}</select></label>
    <label>التاريخ<input name="date" type="date" value="${isoToday()}" required /></label>
    <label class="span-2">بيان أو شهر الراتب<input name="note" value="راتب شهر ${new Date().toLocaleString('ar-SA', { month: 'long', year: 'numeric' })}" required /></label>
    <p class="modal-error span-2" data-error></p>
  </form>`;
  showModal(`صرف راتب: ${employee.name}`, body, { small: true, footer: `<button class="button button-primary" form="salary-form" type="submit">تأكيد الصرف</button><button class="button button-outline" type="button" data-close-modal>إلغاء</button>` });
  const form = modalRoot.querySelector("#salary-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = modalRoot.querySelector('[form="salary-form"]');
    setLoading(button, true);
    try {
      const amount = Number(form.elements.amount.value);
      const cashboxId = form.elements.cashboxId.value;
      const cashbox = list("cashboxes").find((c) => c.id === cashboxId);
      if (!(amount > 0) || !cashbox) throw new Error("تحقق من المبلغ والخزينة.");
      const counterRef = doc(db, "counters", "expenses");
      const expenseRef = doc(collection(db, "expenses"));
      const cashRef = doc(db, "cashboxes", cashboxId);
      await runTransaction(db, async (transaction) => {
        const [counterSnap, cashSnap] = await Promise.all([transaction.get(counterRef), transaction.get(cashRef)]);
        if (!cashSnap.exists()) throw new Error("الخزينة غير موجودة.");
        const next = Number(counterSnap.data()?.value || 0) + 1;
        transaction.set(counterRef, { value: next }, { merge: true });
        transaction.set(expenseRef, {
          number: `EXP-${String(next).padStart(5, "0")}`, date: form.elements.date.value,
          typeName: "رواتب وأجور", description: `راتب موظف: ${employee.name} — ${form.elements.note.value.trim()}`,
          amount, vatAmount: 0, total: amount, cashboxId: cashbox.id, cashboxName: cashbox.name,
          createdAt: new Date().toISOString(), createdBy: state.user.email,
        });
        transaction.update(cashRef, { balance: Number(cashSnap.data().balance ?? cashSnap.data().openingBalance ?? 0) - amount });
      });
      closeModal();
      showToast("تم صرف الراتب وتسجيله في المصروفات بنجاح.");
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
        if (!itemSnap.exists()) throw new Error("الصنف غير موجود.");
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
      showToast("تم تسجيل تسوية المخزون بنجاح.");
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
    ${invoice.note ? `<p class="muted">${escapeHTML(invoice.note)}</p>` : ""}
    <div style="margin-top:15px; text-align:left;"><button type="button" class="button button-primary" id="reprint-btn">🖨️ طباعة الفاتورة</button></div>`, { small: true });
  modalRoot.querySelector("#reprint-btn").addEventListener("click", () => printInvoiceObject(type, invoice));
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
          : false;
    if (linked) throw new Error("لا يمكن حذف سجل مرتبط بعمليات سابقة.");
    await deleteDoc(doc(db, config.collection, id));
    showToast("تم الحذف بنجاح.");
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
    if (action === "pay-salary") payEmployeeSalary(button.dataset.id);
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
        showToast("تم حفظ الإعدادات بنجاح.");
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
  return `<div class="table-wrap"><table><thead><tr><th>رقم المرتجع</th><th>النوع</th><th>التاريخ</th><th>الجهة</th><th>الفاتورة الأصلية</th><th>الإجمالي</th><th>المردود نقدًا</th><th>الأثر على الرصيد</th><th>تفاصيل</th></tr></thead><tbody>${rows.map((row) => `<tr><td class="table-primary">${escapeHTML(row.number)}</td><td><span class="badge${row.kind === "sales" ? " warning" : ""}">${row.kind === "sales" ? "مرتجع مبيعات" : "مرتجع مشتريات"}</span></td><td>${escapeHTML(row.date)}</td><td>${escapeHTML(row.partnerName || "نقدي")}</td><td>${escapeHTML(row.originalNumber || "—")}</td><td>${money(row.total)}</td><td>${money(row.refunded)}</td><td>${money(row.balanceEffect)}</td><td><button class="small-button" data-action="view-return" data-id="${escapeHTML(row.id)}">عرض</button></td></tr>`).join("")}</tbody></table></div>`;
}

function renderReturns() {
  const all = list("returns");
  const rows = all.filter((row) => matchesFilter([row.number, row.partnerName, row.originalNumber, row.date, row.note])).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  pageContent.innerHTML = `
    ${pageHeading("المرتجعات", "مرتجعات المبيعات والمشتريات وتأثيرها على المخزون.", `<button class="button button-outline" data-action="new-purchase-return">＋ مرتجع مشتريات</button><button class="button button-primary" data-action="new-sale-return">＋ مرتجع مبيعات</button>`)}
    <section class="card card-pad">${searchBar("ابحث برقم المرتجع أو الجهة", rows.length, "مرتجع")}${returnsTable(rows)}</section>`;
}

function openReturnForm(kind) {
  const isSale = kind === "sales";
  const partnerCollection = isSale ? "customers" : "suppliers";
  const partnerLabel = isSale ? "العميل" : "المورد";
  if (!list("items").length) {
    showToast("أضف صنفًا قبل تسجيل مرتجع.", "error");
    setPage("items");
    return;
  }
  const body = `
    <form id="return-form">
      <div class="form-grid cols-3">
        <label>التاريخ<input name="date" type="date" value="${isoToday()}" required /></label>
        <label>${partnerLabel}${comboHTML({ name: "partnerId", source: partnerCollection, placeholder: isSale ? "عميل نقدي" : "اكتب للبحث" })}</label>
        <label>الفاتورة الأصلية<select name="originalId"></select></label>
        <label>الخزينة<select name="cashboxId">${optionsFor("cashboxes", "", "بدون حركة نقدية")}</select></label>
        <label>المبلغ المردود نقدًا<input name="refunded" type="number" min="0" step="0.01" value="0" /></label>
        <label>ملاحظات<input name="note" /></label>
      </div>
      <div class="invoice-lines"><div class="card-title"><h3>الأصناف المرتجعة</h3><button class="button button-outline" type="button" data-add-line>＋ إضافة صنف</button></div>
        <div class="table-wrap"><table><thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th><th></th></tr></thead><tbody data-lines></tbody></table></div>
      </div>
      <div class="totals-box"><div class="total-row"><span>الإجمالي</span><strong data-total>0.00</strong></div></div>
      <p class="modal-error" data-error></p>
    </form>`;
  showModal(isSale ? "مرتجع مبيعات" : "مرتجع مشتريات", body, { footer: `<button class="button button-primary" form="return-form" type="submit">حفظ المرتجع</button><button class="button button-outline" type="button" data-close-modal>إلغاء</button>` });
  const form = modalRoot.querySelector("#return-form");
  const lines = form.querySelector("[data-lines]");
  const originalSelect = form.elements.originalId;
  const currentOriginal = () => list(kind).find((inv) => inv.id === originalSelect.value);

  function fillOriginals() {
    const partnerId = form.elements.partnerId.value;
    const rows = list(kind).filter((inv) => !partnerId || inv.partnerId === partnerId).slice(0, 100);
    originalSelect.innerHTML = `<option value="">بدون ربط بفاتورة</option>${rows.map((inv) => `<option value="${escapeHTML(inv.id)}">${escapeHTML(inv.number)} — ${escapeHTML(inv.date)}</option>`).join("")}`;
  }
  const lineItem = (row) => list("items").find((entry) => entry.id === row.querySelector(".line-item").value);

  function addLine(focus = false) {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${comboHTML({ source: "items", className: "line-item", placeholder: "ابحث بالصنف" })}</td><td><input class="line-qty" type="number" min="0.001" step="any" value="1" required /></td><td><input class="line-price" type="number" min="0" step="0.01" value="0" required /></td><td class="line-total">0.00</td><td><button class="small-button" type="button" data-remove-line>حذف</button></td>`;
    lines.append(row);
    updateLine(row);
    if (focus) row.querySelector(".combo-input").focus();
  }
  function updateLine(row, itemChanged = false) {
    const item = lineItem(row);
    if (itemChanged && item) row.querySelector(".line-price").value = Number(isSale ? item.salePrice : item.costPrice) || 0;
    const qty = Number(row.querySelector(".line-qty").value || 0);
    const price = Number(row.querySelector(".line-price").value || 0);
    const total = roundMoney(qty * price * (1 + Number(item?.vatRate || 15) / 100));
    row.querySelector(".line-total").textContent = total.toFixed(2);
    updateTotals();
  }
  function updateTotals() {
    let total = 0;
    [...lines.querySelectorAll("tr")].forEach((row) => {
      const item = lineItem(row);
      total += roundMoney(Number(row.querySelector(".line-qty").value || 0) * Number(row.querySelector(".line-price").value || 0) * (1 + Number(item?.vatRate || 15) / 100));
    });
    form.querySelector("[data-total]").textContent = total.toFixed(2);
  }
  form.querySelector("[data-add-line]").addEventListener("click", () => addLine(true));
  form.elements.partnerId.addEventListener("change", fillOriginals);
  lines.addEventListener("change", (event) => { const row = event.target.closest("tr"); if (row) updateLine(row, event.target.matches(".line-item")); });
  lines.addEventListener("input", (event) => { const row = event.target.closest("tr"); if (row) updateLine(row); });
  lines.addEventListener("click", (event) => { if (event.target.matches("[data-remove-line]")) { event.target.closest("tr").remove(); updateTotals(); } });
  fillOriginals();
  addLine();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = modalRoot.querySelector('[form="return-form"]');
    setLoading(button, true);
    try {
      const original = currentOriginal();
      const partnerId = form.elements.partnerId.value || original?.partnerId || "";
      const partner = list(partnerCollection).find((row) => row.id === partnerId);
      const cashboxId = form.elements.cashboxId.value;
      const cashbox = list("cashboxes").find((row) => row.id === cashboxId);
      const itemLines = [...lines.querySelectorAll("tr")].map((row) => {
        const item = lineItem(row);
        if (!item) throw new Error("اختر صنفًا لكل بند.");
        const qty = Number(row.querySelector(".line-qty").value);
        const price = Number(row.querySelector(".line-price").value);
        const net = roundMoney(qty * price);
        const vatRate = Number(item.vatRate || 15);
        const vatAmount = roundMoney(net * vatRate / 100);
        return { itemId: item.id, itemName: item.name, code: item.code || "", quantity: qty, price, net, vatRate, vatAmount, total: roundMoney(net + vatAmount), costPrice: Number(item.costPrice || 0) };
      });
      if (!itemLines.length) throw new Error("أضف بندًا واحدًا على الأقل.");
      const total = roundMoney(itemLines.reduce((sum, line) => sum + line.total, 0));
      const refunded = Number(form.elements.refunded.value || 0);
      await saveReturn(kind, {
        kind, date: form.elements.date.value,
        partnerId: partner?.id || "", partnerName: partner?.name || "نقدي",
        originalId: original?.id || "", originalNumber: original?.number || "",
        cashboxId, cashboxName: cashbox?.name || "",
        lines: itemLines, total, refunded,
        balanceEffect: Math.max(0, roundMoney(total - refunded)),
        note: form.elements.note.value.trim(),
      });
      closeModal();
      showToast("تم حفظ المرتجع بنجاح.");
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
  const itemRefs = [...new Set(data.lines.map((l) => l.itemId))].map((id) => doc(db, "items", id));
  const returnRef = doc(collection(db, "returns"));
  await runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    const partnerSnap = partnerRef ? await transaction.get(partnerRef) : null;
    const cashboxSnap = cashboxRef ? await transaction.get(cashboxRef) : null;
    const itemSnaps = [];
    for (const itemRef of itemRefs) itemSnaps.push(await transaction.get(itemRef));
    const itemRecords = new Map(itemSnaps.map((snap) => [snap.id, snap.data()]));
    const nextNumber = Number(counterSnap.data()?.value || 0) + 1;
    const numberText = `${isSale ? "SRT" : "PRT"}-${String(nextNumber).padStart(5, "0")}`;
    const createdAt = new Date().toISOString();
    transaction.set(returnRef, { ...data, number: numberText, createdAt, createdBy: state.user.email });
    transaction.set(counterRef, { value: nextNumber }, { merge: true });
    for (const line of data.lines) {
      const item = itemRecords.get(line.itemId);
      if (item && item.trackInventory !== false) {
        transaction.update(doc(db, "items", line.itemId), { quantity: Number(item.quantity || 0) + (isSale ? line.quantity : -line.quantity) });
      }
    }
    if (partnerRef && partnerSnap && data.balanceEffect > 0) {
      transaction.update(partnerRef, { balance: Number(partnerSnap.data().balance ?? partnerSnap.data().openingBalance ?? 0) - data.balanceEffect });
    }
    if (cashboxRef && cashboxSnap && data.refunded > 0) {
      transaction.update(cashboxRef, { balance: Number(cashboxSnap.data().balance ?? cashboxSnap.data().openingBalance ?? 0) + (isSale ? -data.refunded : data.refunded) });
    }
  });
}

function viewReturn(id) {
  const row = list("returns").find((entry) => entry.id === id);
  if (!row) return;
  showModal(`تفاصيل المرتجع ${row.number}`, `
    <div class="stock-summary"><div class="summary-chip"><span>التاريخ</span><strong>${escapeHTML(row.date)}</strong></div><div class="summary-chip"><span>الجهة</span><strong>${escapeHTML(row.partnerName)}</strong></div></div>
    <div class="table-wrap"><table><thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>${(row.lines || []).map((l) => `<tr><td>${escapeHTML(l.itemName)}</td><td>${number(l.quantity)}</td><td>${money(l.price)}</td><td>${money(l.total)}</td></tr>`).join("")}</tbody></table></div>`, { small: true });
}

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
    add(pay.date, pay.number, `${receipt ? "سند قبض" : "سند صرف"}`, receipt ? 0 : pay.amount, receipt ? pay.amount : 0, pay.createdAt);
  });
  entries.sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at));
  const delta = (entry) => isCustomer ? entry.debit - entry.credit : entry.credit - entry.debit;
  const openingBase = Number(party.openingBalance || 0);
  let opening = openingBase;
  entries.filter((entry) => entry.date < from).forEach((entry) => { opening = roundMoney(opening + delta(entry)); });
  let running = opening;
  let debit = 0; let credit = 0;
  const rows = entries.filter((entry) => entry.date >= from && entry.date <= to).map((entry) => {
    running = roundMoney(running + delta(entry));
    debit += entry.debit; credit += entry.credit;
    return { ...entry, balance: running };
  });
  return { party, opening, rows, debit: roundMoney(debit), credit: roundMoney(credit), closing: running };
}

function statementMarkup(data, st) {
  const isCustomer = st.type === "customers";
  const p = data.party;
  return `
    <div class="print-only"><h2>كشف حساب ${isCustomer ? "عميل" : "مورد"}: ${escapeHTML(p.name)}</h2><p>${escapeHTML(state.company.name || "")} — من ${escapeHTML(st.from)} إلى ${escapeHTML(st.to)}</p></div>
    <div class="stock-summary"><div class="summary-chip"><span>الحساب</span><strong>${escapeHTML(p.name)}</strong></div><div class="summary-chip"><span>الرصيد الختامي</span><strong>${money(data.closing)}</strong></div></div>
    <div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>المستند</th><th>البيان</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead><tbody>
      <tr class="stmt-balance-row"><td>${escapeHTML(st.from)}</td><td>—</td><td>رصيد سابق</td><td>—</td><td>—</td><td>${money(data.opening)}</td></tr>
      ${data.rows.map((row) => `<tr><td>${escapeHTML(row.date)}</td><td>${escapeHTML(row.docNumber || "—")}</td><td>${escapeHTML(row.desc)}</td><td>${row.debit ? money(row.debit) : "—"}</td><td>${row.credit ? money(row.credit) : "—"}</td><td>${money(row.balance)}</td></tr>`).join("")}
    </tbody></table></div>`;
}

function renderStatements() {
  const st = state.statement || { type: "customers", partyId: "", from: `${new Date().getFullYear()}-01-01`, to: isoToday() };
  const data = st.partyId ? buildStatement(st) : null;
  pageContent.innerHTML = `
    ${pageHeading("كشف حساب تفصيلي", "كشف حساب العملاء والموردين.", data ? `<button class="button button-outline" data-action="print-report">طباعة الكشف</button>` : "")}
    <section class="card card-pad">
      <form id="statement-form" class="report-controls">
        <label>نوع الحساب<select name="type"><option value="customers"${selected("customers", st.type)}>عميل</option><option value="suppliers"${selected("suppliers", st.type)}>مورد</option></select></label>
        <label class="statement-party">الحساب${comboHTML({ name: "partyId", source: st.type, value: st.partyId, placeholder: "ابحث بالاسم أو الكود" })}</label>
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
    state.statement = { type: data.type, partyId: data.partyId, from: data.from, to: data.to };
    renderPage();
  });
}

function openEntityManager(entity) {
  const config = entityConfig[entity];
  const rows = list(config.collection);
  const body = `<div class="toolbar"><button class="button button-primary" type="button" data-modal-add>＋ ${escapeHTML(config.add)}</button><span class="muted">${number(rows.length)} سجل</span></div>${entityTable(entity, rows)}`;
  showModal(config.title, body);
  modalRoot.querySelector("[data-modal-add]").addEventListener("click", () => { closeModal(); openEntityForm(entity); });
  modalRoot.querySelectorAll('[data-action="edit-entity"]').forEach((button) => button.addEventListener("click", () => {
    const row = list(config.collection).find((item) => item.id === button.dataset.id);
    closeModal();
    if (row) openEntityForm(entity, row);
  }));
  modalRoot.querySelectorAll('[data-action="delete-entity"]').forEach((button) => button.addEventListener("click", () => deleteEntity(entity, button.dataset.id)));
  modalRoot.querySelectorAll('[data-action="pay-salary"]').forEach((button) => button.addEventListener("click", () => { closeModal(); payEmployeeSalary(button.dataset.id); }));
}

function startLiveSync() {
  state.unsubscribers.forEach((unsubscribe) => unsubscribe());
  state.unsubscribers = [];
  for (const collectionName of Object.keys(state.collections)) {
    const unsubscribe = onSnapshot(collection(db, collectionName), (snapshot) => {
      state.collections[collectionName] = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
      scheduleRender();
    }, (error) => showToast(explainError(error), "error"));
    state.unsubscribers.push(unsubscribe);
  }
  const settingsUnsubscribe = onSnapshot(doc(db, "settings", "company"), (snapshot) => {
    if (snapshot.exists()) state.company = { ...state.company, ...snapshot.data() };
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
    if (!payload.collections || !window.confirm("سيتم دمج البيانات الحالية بالنسخة. هل تريد المتابعة؟")) return;
    for (const [collectionName, rows] of Object.entries(payload.collections)) {
      if (state.collections[collectionName] && Array.isArray(rows)) {
        for (const row of rows) {
          if (row.id) {
            const { id, ...data } = row;
            await setDoc(doc(db, collectionName, id), data, { merge: true });
          }
        }
      }
    }
    showToast("تم استعادة النسخة الاحتياطية بنجاح.");
  } catch (error) {
    showToast(explainError(error), "error");
  }
}

async function checkAuthorization(user) {
  const membership = await getDoc(doc(db, "authorizedUsers", user.uid));
  if (!membership.exists()) {
    loginMessage.innerHTML = `<div class="access-denied"><strong>ليس لديك صلاحية الوصول.</strong><p>أضف مستندًا في مجموعة authorizedUsers في Firebase Console، واجعل معرّف المستند هو الـ UID التالي:</p><div class="uid-row"><input type="text" readonly value="${escapeHTML(user.uid)}" dir="ltr" /><button type="button" class="button button-outline" data-copy-uid>نسخ</button></div></div>`;
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
document.querySelector("#mobile-menu").addEventListener("click", () => document.querySelector(".sidebar").classList.toggle("mobile-open"));
bindPageEvents();
bindComboEvents();
bindStatementEvents();

document.querySelector("#today-label").textContent = new Intl.DateTimeFormat("ar-SA", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

if (!isConfigured) {
  loginMessage.textContent = "أضف إعدادات Firebase إلى firebase-config.js أولًا، ثم أعد تحميل الصفحة.";
  loginForm.querySelectorAll("input, button").forEach((input) => input.disabled = true);
} else {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      state.user = null;
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
