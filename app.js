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
      { key: "salePrice", label: "سعر البيع الافتراضي", type: "number", required: true, min: 0 },
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
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast${type === "error" ? " error" : ""}`;
  toast.textContent = message;
  toastRoot.append(toast);
  window.setTimeout(() => toast.remove(), 3500);
}

function explainError(error) {
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
      <section class="modal ${options.small ? "modal-small" : ""}">
        <header class="modal-header"><h2>${escapeHTML(title)}</h2><button class="icon-button" type="button" data-close-modal>×</button></header>
        <div class="modal-body">${body}</div>
        ${options.footer ? `<footer class="modal-footer">${options.footer}</footer>` : ""}
      </section>
    </div>`;
  modalRoot.querySelectorAll("[data-close-modal]").forEach((b) => b.addEventListener("click", closeModal));
}

function closeModal() { modalRoot.innerHTML = ""; }

function setPage(page) {
  if (!titles[page]) return;
  state.page = page;
  document.querySelectorAll(".nav-link").forEach((btn) => btn.classList.toggle("active", btn.dataset.page === page));
  document.querySelector("#page-title").textContent = titles[page];
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
  const todaySales = list("sales").filter((row) => row.date === isoToday()).reduce((sum, row) => sum + Number(row.total || 0), 0);
  const monthPrefix = isoToday().slice(0, 7);
  const monthSales = list("sales").filter((row) => String(row.date || "").startsWith(monthPrefix)).reduce((sum, row) => sum + Number(row.total || 0), 0);
  const monthCost = list("sales").filter((row) => String(row.date || "").startsWith(monthPrefix)).reduce((sum, inv) => sum + (inv.lines || []).reduce((s, l) => s + Number(l.costPrice || 0) * Number(l.quantity || 0), 0), 0);
  const monthExpenses = list("expenses").filter((row) => String(row.date || "").startsWith(monthPrefix)).reduce((sum, r) => sum + Number(r.total || 0), 0);
  const monthProfit = (monthSales - monthCost) - monthExpenses;
  const cashBalance = list("cashboxes").reduce((sum, row) => sum + Number(row.balance ?? row.openingBalance ?? 0), 0);
  const lowItems = list("items").filter((row) => Number(row.lowStock || 0) > 0 && Number(row.quantity || 0) <= Number(row.lowStock || 0));

  pageContent.innerHTML = `
    ${pageHeading(`أهلًا بك في ${escapeHTML(state.company.name || "منشأتك")}`, "تحليل العمل والرسوم البيانية.", `<button class="button button-primary" data-action="new-sale">＋ فاتورة مبيعات جديدة</button>`)}
    <div class="stats-grid">
      ${statCard("مبيعات اليوم", money(todaySales), "↗")}
      ${statCard("مبيعات الشهر", money(monthSales), "▥")}
      ${statCard("صافي ربح الشهر", money(monthProfit), "⚡")}
      ${statCard("الرصيد النقدي", money(cashBalance), "▣")}
    </div>
    <div class="dashboard-grid">
      <section class="card card-pad">
        <div class="card-title"><h3>حركة المبيعات والمشتريات (شهرياً)</h3></div>
        <div class="chart-container"><canvas id="salesChart"></canvas></div>
      </section>
      <section class="card card-pad">
        <div class="card-title"><h3>تنبيهات المخزون</h3></div>
        ${lowItems.length ? `<div class="table-wrap"><table><thead><tr><th>الصنف</th><th>الرصيد</th></tr></thead><tbody>${lowItems.slice(0, 5).map((item) => `<tr><td>${escapeHTML(item.name)}</td><td>${number(item.quantity)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state">المخزون آمن.</div>`}
      </section>
    </div>`;

  setTimeout(() => {
    const ctx = document.getElementById('salesChart')?.getContext('2d');
    if (!ctx) return;
    const months = Array.from({length: 6}, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      return localDateValue(d).slice(0, 7);
    });
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: months,
        datasets: [
          { label: 'المبيعات', data: months.map(m => list("sales").filter(s => String(s.date).startsWith(m)).reduce((a, s) => a + Number(s.total || 0), 0)), borderColor: '#4f46e5', fill: true },
          { label: 'المشتريات', data: months.map(m => list("purchases").filter(p => String(p.date).startsWith(m)).reduce((a, p) => a + Number(p.total || 0), 0)), borderColor: '#c94f53', fill: true }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }, 50);
}

function renderEntity(entity) {
  const config = entityConfig[entity];
  const rows = list(config.collection);
  pageContent.innerHTML = `
    ${pageHeading(config.title, `إدارة ${config.title}`, `<button class="button button-primary" data-action="add-entity" data-entity="${entity}">＋ ${config.add}</button>`)}
    <section class="card card-pad">${entityTable(entity, rows)}</section>`;
}

function entityTable(entity, rows) {
  const config = entityConfig[entity];
  if (!rows.length) return `<div class="empty-state">لا توجد بيانات.</div>`;
  const head = config.columns.map(([, label]) => `<th>${label}</th>`).join("");
  const body = rows.map((row) => `<tr>${config.columns.map(([key, , type]) => `<td>${type === "money" ? money(row[key]) : escapeHTML(row[key] ?? "—")}</td>`).join("")}<td><div class="row-actions">${entity === "employees" ? `<button class="small-button" data-action="pay-salary" data-id="${escapeHTML(row.id)}">صرف راتب</button>` : ""}<button class="small-button" data-action="delete-entity" data-entity="${entity}" data-id="${escapeHTML(row.id)}">حذف</button></div></td></tr>`).join("");
  return `<div class="table-wrap"><table><thead><tr>${head}<th>الإجراءات</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

function renderInvoices(type) {
  const rows = list(type);
  pageContent.innerHTML = `
    ${pageHeading(type === "sales" ? "فواتير المبيعات" : "فواتير المشتريات", "إدارة الفواتير والطباعة", `<button class="button button-primary" data-action="new-${type === "sales" ? "sale" : "purchase"}">＋ فاتورة جديدة</button>`)}
    <section class="card card-pad">${invoiceTable(rows, type)}</section>`;
}

function invoiceTable(rows, type) {
  if (!rows.length) return `<div class="empty-state">لا توجد فواتير.</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>رقم الفاتورة</th><th>التاريخ</th><th>الجهة</th><th>الإجمالي</th><th>الإجراءات</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHTML(row.number)}</td><td>${escapeHTML(row.date)}</td><td>${escapeHTML(row.partnerName || "نقدي")}</td><td>${money(row.total)}</td><td><button class="small-button" data-action="view-invoice" data-type="${type}" data-id="${escapeHTML(row.id)}">عرض وطباعة</button></td></tr>`).join("")}</tbody></table></div>`;
}

function renderPayments() {
  pageContent.innerHTML = `${pageHeading("سندات القبض والصرف", "حركة الخزينة", `<button class="button button-primary" data-action="new-payment">＋ سند جديد</button>`)}`;
}

function renderExpenses() {
  pageContent.innerHTML = `${pageHeading("المصروفات العامة", "التكاليف والرواتب", `<button class="button button-primary" data-action="new-expense">＋ تسجيل مصروف</button>`)}`;
}

function renderInventory() {
  pageContent.innerHTML = `${pageHeading("حركة المخزون", "التسويات والترصيد", `<button class="button button-primary" data-action="new-stock-move">＋ تسوية مخزون</button>`)}`;
}

function renderReports() {
  pageContent.innerHTML = `${pageHeading("التقارير والأرباح والخسائر", "استعراض الأداء المالي")}`;
}

function renderReturns() {
  pageContent.innerHTML = `${pageHeading("المرتجعات", "مرتجعات المبيعات والمشتريات")}`;
}

function renderStatements() {
  pageContent.innerHTML = `${pageHeading("كشف حساب تفصيلي", "حسابات العملاء والموردين")}`;
}

function renderSettings() {
  pageContent.innerHTML = `${pageHeading("الإعدادات", "بيانات المنشأة")}`;
}

function openEntityForm(entity) {
  const config = entityConfig[entity];
  const fields = config.fields.map((f) => `<label>${f.label}<input name="${f.key}" type="${f.type || 'text'}" required /></label>`).join("");
  showModal(config.add, `<form id="entity-form" class="form-grid">${fields}<div class="span-2"><button class="button button-primary" type="submit">حفظ</button></div></form>`, { small: true });
  modalRoot.querySelector("#entity-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    await setDoc(doc(collection(db, config.collection)), data);
    closeModal();
    showToast("تم الحفظ بنجاح.");
  });
}

function openInvoice(type) {
  const isSale = type === "sales";
  const body = `
    <form id="invoice-form">
      <div class="form-grid cols-3">
        <label>التاريخ<input name="date" type="date" value="${isoToday()}" required /></label>
        <label>الجهة${comboHTML({ name: "partnerId", source: isSale ? "customers" : "suppliers" })}</label>
        <label>نوع الفاتورة<select name="invoiceStyle"><option value="standard">A4 عادية</option><option value="pos">كاشير (حرارية)</option></select></label>
      </div>
      <div class="invoice-lines">
        <button class="button button-outline" type="button" data-add-line>＋ إضافة صنف</button>
        <table><thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody data-lines></tbody></table>
      </div>
      <button class="button button-primary" type="submit">حفظ وطباعة</button>
    </form>`;
  showModal(isSale ? "فاتورة مبيعات" : "فاتورة مشتريات", body);
  const form = modalRoot.querySelector("#invoice-form");
  const lines = form.querySelector("[data-lines]");

  function addLine() {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${comboHTML({ source: "items", className: "line-item" })}</td><td><input class="line-qty" type="number" value="1" /></td><td><input class="line-price" type="number" value="0" /></td><td class="line-total">0.00</td>`;
    lines.append(row);
  }
  form.querySelector("[data-add-line]").addEventListener("click", addLine);
  addLine();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = {
      date: form.elements.date.value,
      partnerId: form.elements.partnerId.value,
      invoiceStyle: form.elements.invoiceStyle.value,
      lines: [...lines.querySelectorAll("tr")].map(r => ({
        itemId: r.querySelector(".line-item").value,
        quantity: Number(r.querySelector(".line-qty").value),
        price: Number(r.querySelector(".line-price").value),
        total: Number(r.querySelector(".line-qty").value) * Number(r.querySelector(".line-price").value)
      })),
      total: [...lines.querySelectorAll("tr")].reduce((a, r) => a + (Number(r.querySelector(".line-qty").value) * Number(r.querySelector(".line-price").value)), 0)
    };
    await setDoc(doc(collection(db, type)), data);
    closeModal();
    showToast("تم الحفظ والطباعة.");
  });
}

function bindPageEvents() {
  pageContent.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === "new-sale") openInvoice("sales");
    if (action === "new-purchase") openInvoice("purchases");
    if (action === "add-entity") openEntityForm(btn.dataset.entity);
  });
}

function bindComboEvents() {}

function startLiveSync() {
  for (const collectionName of Object.keys(state.collections)) {
    onSnapshot(collection(db, collectionName), (snapshot) => {
      state.collections[collectionName] = snapshot.docs.map((e) => ({ id: e.id, ...e.data() }));
      scheduleRender();
    });
  }
}

document.querySelector("#logout-button").addEventListener("click", () => signOut(auth));
document.querySelector("#main-nav").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-page]");
  if (btn) setPage(btn.dataset.page);
});

bindPageEvents();
bindComboEvents();

if (isConfigured) {
  onAuthStateChanged(auth, (user) => {
    if (!user) return;
    state.user = user;
    appShell.classList.remove("is-hidden");
    loginScreen.classList.add("is-hidden");
    startLiveSync();
    setPage("dashboard");
  });
}
