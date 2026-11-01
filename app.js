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
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const isConfigured = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("YOUR_");
const loginScreen = document.querySelector("#login-screen");
const appShell = document.querySelector("#app-shell");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const pageContent = document.querySelector("#page-content");
const modalRoot = document.querySelector("#modal-root");
const toastRoot = document.querySelector("#toast-root");

const auth = isConfigured ? getAuth(initializeApp(firebaseConfig)) : null;
const db = isConfigured ? getFirestore() : null;
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
  },
  company: { name: "منشأتك", vatRate: 15, currency: "ر.س" },
  filter: "",
  report: null,
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
  modalRoot.querySelector("input, select, button")?.focus();
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
    payments: renderPayments,
    expenses: renderExpenses,
    inventory: renderInventory,
    reports: renderReports,
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
  const todaySales = list("sales").filter((row) => row.date === isoToday()).reduce((sum, row) => sum + Number(row.total || 0), 0);
  const monthPrefix = isoToday().slice(0, 7);
  const monthSales = list("sales").filter((row) => String(row.date || "").startsWith(monthPrefix)).reduce((sum, row) => sum + Number(row.total || 0), 0);
  const customerBalances = list("customers").reduce((sum, row) => sum + Number(row.balance ?? row.openingBalance ?? 0), 0);
  const cashBalance = list("cashboxes").reduce((sum, row) => sum + Number(row.balance ?? row.openingBalance ?? 0), 0);
  const lowItems = list("items").filter((row) => Number(row.lowStock || 0) > 0 && Number(row.quantity || 0) <= Number(row.lowStock || 0));
  const recent = [...list("sales")].sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).slice(0, 5);
  pageContent.innerHTML = `
    ${pageHeading(`أهلًا بك في ${escapeHTML(state.company.name || "منشأتك")}`, "ملخص سريع لحركة منشأتك وأهم الأرقام.", `<button class="button button-primary" data-action="new-sale">＋ فاتورة مبيعات</button>`)}
    <div class="stats-grid">
      ${statCard("مبيعات اليوم", money(todaySales), "↗", "إجمالي الفواتير المسجلة اليوم")}
      ${statCard("مبيعات الشهر", money(monthSales), "▥", "من بداية الشهر الحالي")}
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
    </div>`;
}

function renderEntity(entity) {
  const config = entityConfig[entity];
  const rows = list(config.collection).filter((row) => !state.filter || Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(state.filter.toLowerCase())));
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
  const body = rows.map((row) => `<tr>${config.columns.map(([key, , type]) => `<td>${type === "money" ? money(row[key]) : escapeHTML(row[key] ?? "—")}</td>`).join("")}<td><div class="row-actions"><button class="small-button" data-action="edit-entity" data-entity="${entity}" data-id="${escapeHTML(row.id)}">تعديل</button><button class="small-button" data-action="delete-entity" data-entity="${entity}" data-id="${escapeHTML(row.id)}">حذف</button></div></td></tr>`).join("");
  return `<div class="table-wrap"><table><thead><tr>${head}<th>الإجراءات</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

function renderInvoices(type) {
  const title = type === "sales" ? "فواتير المبيعات" : "فواتير المشتريات";
  const rows = list(type).filter((row) => !state.filter || `${row.number} ${row.partnerName}`.toLowerCase().includes(state.filter.toLowerCase())).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  pageContent.innerHTML = `
    ${pageHeading(title, "عرض ومتابعة الفواتير المسجلة.", `<button class="button button-primary" data-action="new-${type === "sales" ? "sale" : "purchase"}">＋ فاتورة جديدة</button>`)}
    <section class="card card-pad"><div class="toolbar"><input class="toolbar-search" data-filter placeholder="ابحث برقم الفاتورة أو اسم الجهة" value="${escapeHTML(state.filter)}" /><span class="muted">${number(rows.length)} فاتورة</span></div>${invoiceTable(rows, type)}</section>`;
}

function invoiceTable(rows, type, compact = false) {
  if (!rows.length) return `<div class="empty-state"><strong>لا توجد فواتير مسجلة</strong>ابدأ بإضافة أول فاتورة.</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>رقم الفاتورة</th><th>التاريخ</th><th>${type === "sales" ? "العميل" : "المورد"}</th><th>الإجمالي</th>${compact ? "" : "<th>المدفوع</th><th>المتبقي</th>"}<th>الحالة</th>${compact ? "" : "<th>تفاصيل</th>"}</tr></thead><tbody>${rows.map((row) => `<tr><td class="table-primary">${escapeHTML(row.number || "—")}</td><td>${escapeHTML(row.date || "—")}</td><td>${escapeHTML(row.partnerName || "نقدي")}</td><td>${money(row.total)}</td>${compact ? "" : `<td>${money(row.paid)}</td><td>${money(row.due)}</td>`}<td><span class="badge${Number(row.due) > 0 ? " warning" : ""}">${Number(row.due) > 0 ? "آجل" : "مكتملة"}</span></td>${compact ? "" : `<td><button class="small-button" data-action="view-invoice" data-type="${type}" data-id="${escapeHTML(row.id)}">عرض</button></td>`}</tr>`).join("")}</tbody></table></div>`;
}

function renderPayments() {
  const rows = [...list("payments")].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  pageContent.innerHTML = `
    ${pageHeading("سندات القبض والصرف", "سجّل المقبوضات والمدفوعات وتابع حركة الخزينة.", `<button class="button button-primary" data-action="new-payment">＋ سند جديد</button>`)}
    <section class="card card-pad"><div class="table-wrap">${rows.length ? `<table><thead><tr><th>رقم السند</th><th>النوع</th><th>التاريخ</th><th>الجهة</th><th>الخزينة</th><th>المبلغ</th><th>البيان</th></tr></thead><tbody>${rows.map((row) => `<tr><td class="table-primary">${escapeHTML(row.number)}</td><td><span class="badge${row.type === "صرف" ? " warning" : ""}">${escapeHTML(row.type)}</span></td><td>${escapeHTML(row.date)}</td><td>${escapeHTML(row.partyName || "—")}</td><td>${escapeHTML(row.cashboxName || "—")}</td><td>${money(row.amount)}</td><td>${escapeHTML(row.note || "—")}</td></tr>`).join("")}</tbody></table>` : `<div class="empty-state"><strong>لا توجد سندات</strong>أضف سند قبض أو صرف لتسجيل الحركة.</div>`}</div></section>`;
}

function renderExpenses() {
  const rows = [...list("expenses")].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const total = rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
  pageContent.innerHTML = `
    ${pageHeading("المصروفات", "سجّل مصروفات المنشأة وراجع تفاصيلها.", `<button class="button button-primary" data-action="new-expense">＋ تسجيل مصروف</button>`)}
    <div class="stock-summary"><div class="summary-chip"><span>إجمالي المصروفات المسجلة</span><strong>${money(total)}</strong></div><div class="summary-chip"><span>عدد المصروفات</span><strong>${number(rows.length)}</strong></div></div>
    <section class="card card-pad">${rows.length ? `<div class="table-wrap"><table><thead><tr><th>رقم المصروف</th><th>التاريخ</th><th>النوع</th><th>التفاصيل</th><th>الإجمالي</th><th>الخزينة</th></tr></thead><tbody>${rows.map((row) => `<tr><td class="table-primary">${escapeHTML(row.number)}</td><td>${escapeHTML(row.date)}</td><td>${escapeHTML(row.typeName)}</td><td>${escapeHTML(row.description || "—")}</td><td>${money(row.total)}</td><td>${escapeHTML(row.cashboxName || "—")}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state"><strong>لا توجد مصروفات</strong>سجّل المصروفات لمتابعة تكاليف التشغيل.</div>`}</section>`;
}

function renderInventory() {
  const items = list("items");
  const stockValue = items.reduce((sum, row) => sum + Number(row.quantity || 0) * Number(row.costPrice || 0), 0);
  const moves = [...list("stockMoves")].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 30);
  pageContent.innerHTML = `
    ${pageHeading("حركة المخزون", "تابع أرصدة الأصناف وسجّل التسويات المخزنية.", `<button class="button button-primary" data-action="new-stock-move">＋ تسوية مخزون</button>`)}
    <div class="stock-summary"><div class="summary-chip"><span>عدد الأصناف</span><strong>${number(items.length)}</strong></div><div class="summary-chip"><span>قيمة المخزون بالتكلفة</span><strong>${money(stockValue)}</strong></div><div class="summary-chip"><span>حركات مسجلة</span><strong>${number(list("stockMoves").length)}</strong></div></div>
    <section class="card card-pad"><div class="card-title"><h3>آخر الحركات</h3></div>${moves.length ? `<div class="table-wrap"><table><thead><tr><th>رقم الحركة</th><th>التاريخ</th><th>الصنف</th><th>نوع الحركة</th><th>الكمية</th><th>البيان</th></tr></thead><tbody>${moves.map((row) => `<tr><td>${escapeHTML(row.number)}</td><td>${escapeHTML(row.date)}</td><td>${escapeHTML(row.itemName)}</td><td>${escapeHTML(row.type)}</td><td>${number(row.quantity)}</td><td>${escapeHTML(row.note || "—")}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state"><strong>لا توجد حركات مخزنية</strong>ستظهر هنا التسويات التي تسجلها.</div>`}</section>`;
}

function renderReports() {
  const report = state.report;
  pageContent.innerHTML = `
    ${pageHeading("مركز التقارير", "استعرض حركة المبيعات والمشتريات خلال فترة محددة.")}
    <section class="card card-pad">
      <form id="report-form" class="report-controls">
        <label>نوع التقرير<select name="type"><option value="sales"${selected("sales", report?.type || "sales")}>المبيعات</option><option value="purchases"${selected("purchases", report?.type)}>المشتريات</option><option value="expenses"${selected("expenses", report?.type)}>المصروفات</option></select></label>
        <label>من تاريخ<input type="date" name="from" value="${report?.from || localDateValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}" required /></label>
        <label>إلى تاريخ<input type="date" name="to" value="${report?.to || isoToday()}" required /></label>
        <button class="button button-primary">عرض التقرير</button>
        ${report ? `<button type="button" class="button button-outline" data-action="print-report">طباعة</button>` : ""}
      </form>
      ${report ? reportMarkup(report) : `<div class="empty-state"><strong>اختر فترة التقرير</strong>حدد نوع التقرير والتواريخ ثم اضغط عرض التقرير.</div>`}
    </section>`;
}

function reportMarkup(report) {
  const rows = report.rows;
  const total = rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const tax = rows.reduce((sum, row) => sum + Number(row.vatAmount || 0), 0);
  const count = rows.length;
  const table = report.type === "expenses"
    ? `<div class="table-wrap"><table><thead><tr><th>رقم المصروف</th><th>التاريخ</th><th>النوع</th><th>التفاصيل</th><th>الضريبة</th><th>الإجمالي</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHTML(row.number)}</td><td>${escapeHTML(row.date)}</td><td>${escapeHTML(row.typeName)}</td><td>${escapeHTML(row.description || "—")}</td><td>${money(row.vatAmount)}</td><td>${money(row.total)}</td></tr>`).join("")}</tbody></table></div>`
    : invoiceTable(rows, report.type);
  return `<div id="report-output"><div class="stock-summary"><div class="summary-chip"><span>عدد المستندات</span><strong>${number(count)}</strong></div><div class="summary-chip"><span>الإجمالي</span><strong>${money(total)}</strong></div><div class="summary-chip"><span>ضريبة القيمة المضافة</span><strong>${money(tax)}</strong></div></div>${rows.length ? table : `<div class="empty-state">لا توجد نتائج في الفترة المختارة.</div>`}</div>`;
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
        <label>${partnerLabel}<select name="partnerId">${optionsFor(partnerCollection, "", isSale ? "عميل نقدي" : "مورد اختياري")}</select></label>
        <label>المخزن<select name="warehouseId">${optionsFor("warehouses", "")}</select></label>
        <label>الخزينة / البنك<select name="cashboxId">${cashOptions}</select></label>
        <label>المدفوع الآن<input name="paid" type="number" min="0" step="0.01" value="0" /></label>
        <label class="span-2">ملاحظات<input name="note" /></label>
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

  function addLine() {
    const row = document.createElement("tr");
    row.innerHTML = `<td><select class="line-item" required><option value="">اختر الصنف</option>${list("items").map((item) => `<option value="${escapeHTML(item.id)}" data-price="${Number(isSale ? item.salePrice : item.costPrice)}" data-vat="${Number(item.vatRate ?? state.company.vatRate ?? 15)}">${escapeHTML(item.name)} — ${escapeHTML(item.code || "")}</option>`).join("")}</select></td><td><input class="line-qty" type="number" min="0.001" step="any" value="1" required /></td><td><input class="line-price" type="number" min="0" step="0.01" value="0" required /></td><td><input class="line-discount" type="number" min="0" max="100" step="0.01" value="0" /></td><td class="line-total">0.00</td><td><button class="small-button" type="button" data-remove-line>حذف</button></td>`;
    lines.append(row);
    updateLine(row, true);
  }
  function updateLine(row, resetPrice = false) {
    const option = row.querySelector(".line-item").selectedOptions[0];
    if (resetPrice && option?.value) {
      row.querySelector(".line-price").value = option.dataset.price || 0;
    }
    const qty = Number(row.querySelector(".line-qty").value || 0);
    const price = Number(row.querySelector(".line-price").value || 0);
    const discount = Math.min(100, Math.max(0, Number(row.querySelector(".line-discount").value || 0)));
    const rate = Number(option?.dataset.vat || state.company.vatRate || 15) / 100;
    const net = roundMoney(qty * price * (1 - discount / 100));
    row.querySelector(".line-total").textContent = (net + roundMoney(net * rate)).toFixed(2);
    updateTotals();
  }
  function updateTotals() {
    let subtotal = 0;
    let tax = 0;
    [...lines.querySelectorAll("tr")].forEach((row) => {
      const option = row.querySelector(".line-item").selectedOptions[0];
      const net = roundMoney(Number(row.querySelector(".line-qty").value || 0) * Number(row.querySelector(".line-price").value || 0) * (1 - Number(row.querySelector(".line-discount").value || 0) / 100));
      subtotal += net;
      tax += roundMoney(net * Number(option?.dataset.vat || state.company.vatRate || 15) / 100);
    });
    const total = subtotal + tax;
    const paid = Number(form.elements.paid.value || 0);
    form.querySelector("[data-subtotal]").textContent = subtotal.toFixed(2);
    form.querySelector("[data-tax]").textContent = tax.toFixed(2);
    form.querySelector("[data-total]").textContent = total.toFixed(2);
    form.querySelector("[data-due]").textContent = Math.max(0, total - paid).toFixed(2);
  }
  form.querySelector("[data-add-line]").addEventListener("click", addLine);
  lines.addEventListener("change", (event) => {
    const row = event.target.closest("tr");
    if (row) updateLine(row, event.target.matches(".line-item"));
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
        return { itemId: item.id, itemName: item.name, code: item.code || "", quantity: qty, price, discountRate, net, vatRate, vatAmount: vatLine, total: net + vatLine, costPrice: Number(item.costPrice || 0) };
      });
      if (!itemLines.length) throw new Error("أضف بندًا واحدًا على الأقل.");
      const subtotal = roundMoney(itemLines.reduce((sum, line) => sum + line.net, 0));
      const vatAmount = roundMoney(itemLines.reduce((sum, line) => sum + line.vatAmount, 0));
      const total = roundMoney(subtotal + vatAmount);
      const paid = Number(form.elements.paid.value || 0);
      if (paid < 0 || paid > total + 0.01) throw new Error("المبلغ المدفوع يجب أن يكون بين صفر وإجمالي الفاتورة.");
      if (paid > 0 && !cashboxId) throw new Error("اختر الخزينة التي استلمت أو دفعت المبلغ.");
      if (total - paid > 0.01 && !partner) throw new Error(`اختر ${partnerLabel} عند وجود مبلغ آجل.`);
      await saveInvoice(type, {
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
      closeModal();
      showToast("تم حفظ الفاتورة وتحديث الأرصدة والمخزون.");
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
  const partnerDelta = isSale ? data.due : data.due;
  const counterRef = doc(db, "counters", counterName);
  const partnerRef = data.partnerId ? doc(db, partnerCollection, data.partnerId) : null;
  const cashboxRef = data.cashboxId ? doc(db, "cashboxes", data.cashboxId) : null;
  const itemRefs = [...new Set(data.lines.map((line) => line.itemId))].map((id) => doc(db, "items", id));
  const invoiceRef = doc(collection(db, collectionName));
  await runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    const partnerSnap = partnerRef ? await transaction.get(partnerRef) : null;
    const cashboxSnap = cashboxRef ? await transaction.get(cashboxRef) : null;
    const itemSnaps = [];
    for (const itemRef of itemRefs) itemSnaps.push(await transaction.get(itemRef));
    if (partnerRef && !partnerSnap.exists()) throw new Error(`${isSale ? "العميل" : "المورد"} غير موجود.`);
    if (cashboxRef && !cashboxSnap.exists()) throw new Error("الخزينة المحددة غير موجودة.");
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
    transaction.set(counterRef, { value: nextNumber }, { merge: true });
    for (const [itemId, quantity] of quantities) {
      const item = itemRecords.get(itemId);
      if (item.trackInventory === false) continue;
      if (isSale) {
        transaction.update(doc(db, "items", itemId), { quantity: Number(item.quantity || 0) - quantity });
      } else {
        const previousQty = Number(item.quantity || 0);
        const newQty = previousQty + quantity;
        const weightedCost = (previousQty * Number(item.costPrice || 0) + quantity * data.lines.filter((line) => line.itemId === itemId).reduce((sum, line) => sum + line.price * line.quantity, 0)) / (newQty || 1);
        transaction.update(doc(db, "items", itemId), { quantity: newQty, costPrice: weightedCost });
      }
    }
    if (partnerRef && partnerDelta > 0) transaction.update(partnerRef, { balance: Number(partnerSnap.data().balance ?? partnerSnap.data().openingBalance ?? 0) + partnerDelta });
    if (cashboxRef && data.paid > 0) {
      const sign = isSale ? 1 : -1;
      transaction.update(cashboxRef, { balance: Number(cashboxSnap.data().balance ?? cashboxSnap.data().openingBalance ?? 0) + sign * data.paid });
    }
  });
}

function openPaymentForm() {
  const footer = `<button class="button button-primary" form="payment-form" type="submit">حفظ السند</button><button class="button button-outline" type="button" data-close-modal>إلغاء</button>`;
  const body = `<form id="payment-form" class="form-grid">
    <label>نوع السند<select name="type"><option>قبض</option><option>صرف</option></select></label>
    <label>التاريخ<input name="date" type="date" value="${isoToday()}" required /></label>
    <label>الخزينة / البنك<select name="cashboxId" required>${optionsFor("cashboxes", "", "اختر الخزينة")}</select></label>
    <label>الجهة<select name="partyType"><option value="">جهة أخرى</option><option value="customers">عميل</option><option value="suppliers">مورد</option></select></label>
    <label>اسم الجهة<select name="partyId"><option value="">— اختياري —</option></select></label>
    <label>المبلغ<input name="amount" type="number" min="0.01" step="0.01" required /></label>
    <label class="span-2">البيان<input name="note" /></label>
    <p class="modal-error span-2" data-error></p>
  </form>`;
  showModal("سند قبض أو صرف", body, { small: true, footer });
  const form = modalRoot.querySelector("#payment-form");
  form.elements.partyType.addEventListener("change", () => {
    const source = form.elements.partyType.value;
    form.elements.partyId.innerHTML = `<option value="">— اختياري —</option>${source ? list(source).map((row) => `<option value="${escapeHTML(row.id)}">${escapeHTML(row.name)}</option>`).join("") : ""}`;
  });
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
          const balanceSign = partyType === "customers" ? -1 : -1;
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
    <label class="span-2">الصنف<select name="itemId" required>${optionsFor("items", "", "اختر الصنف")}</select></label>
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
        transaction.update(itemRef, { quantity: nextQty, ...(type === "زيادة" && costPrice > 0 ? { costPrice } : {}) });
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
    ${invoice.note ? `<p class="muted">${escapeHTML(invoice.note)}</p>` : ""}`, { small: true });
}

async function deleteEntity(entity, id) {
  const config = entityConfig[entity];
  const row = list(config.collection).find((item) => item.id === id);
  if (!row || !window.confirm(`هل تريد حذف "${row.name || row.code}"؟`)) return;
  try {
    const linked = entity === "items"
    ? [...list("sales"), ...list("purchases")].some((invoice) => (invoice.lines || []).some((line) => line.itemId === id)) || list("stockMoves").some((move) => move.itemId === id)
    : entity === "customers"
      ? list("sales").some((invoice) => invoice.partnerId === id)
      : entity === "suppliers"
        ? list("purchases").some((invoice) => invoice.partnerId === id)
        : entity === "cashboxes"
          ? [...list("sales"), ...list("purchases"), ...list("expenses"), ...list("payments")].some((record) => record.cashboxId === id)
          : entity === "warehouses"
            ? [...list("sales"), ...list("purchases")].some((invoice) => invoice.warehouseId === id)
            : false;
    if (linked) {
    throw new Error("لا يمكن حذف سجل مرتبط بفواتير سابقة.");
    }
    const snapshot = await getDoc(doc(db, config.collection, id));
    if (entity === "items" && Number(snapshot.data()?.quantity || 0) !== 0) throw new Error("لا يمكن حذف صنف له رصيد مخزني؛ استخدم تسوية المخزون أولًا.");
    const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
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
    if (event.target.matches('[data-action="import-data"]')) importData(event.target.files?.[0]);
  });
}

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
      if (state.user) renderPage();
    }, (error) => {
      showToast(explainError(error), "error");
    });
    state.unsubscribers.push(unsubscribe);
  }
  const settingsUnsubscribe = onSnapshot(doc(db, "settings", "company"), (snapshot) => {
    if (snapshot.exists()) state.company = { ...state.company, ...snapshot.data() };
    if (state.user) renderPage();
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

function exportData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    company: state.company,
    collections: state.collections,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `daftar-backup-${isoToday()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("تم تنزيل النسخة الاحتياطية.");
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
    if (payload.company) await setDoc(doc(db, "settings", "company"), payload.company, { merge: true });
    showToast("تم استعادة بيانات النسخة.");
  } catch (error) {
    showToast(explainError(error), "error");
  }
}

async function checkAuthorization(user) {
  const membership = await getDoc(doc(db, "authorizedUsers", user.uid));
  if (!membership.exists()) {
    loginMessage.textContent = `الحساب صحيح، لكن لا توجد له صلاحية في Firestore. أنشئ مستندًا في authorizedUsers واجعل معرّف المستند هذا UID نفسه: ${user.uid}`;
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

document.querySelector("#today-label").textContent = new Intl.DateTimeFormat("ar-SA", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

if (!isConfigured) {
  loginMessage.textContent = "أضف إعدادات Firebase إلى firebase-config.js أولًا، ثم أعد تحميل الصفحة.";
  loginForm.querySelectorAll("input, button").forEach((input) => input.disabled = true);
} else {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      state.user = null;
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
// ... existing code ...
async function checkAuthorization(user) {
  const membership = await getDoc(doc(db, "authorizedUsers", user.uid));
  if (!membership.exists()) {
    loginMessage.innerHTML = `
      <div style="background: #fff0ef; border: 1px solid #fecaca; padding: 12px; border-radius: 10px; margin-top: 10px; text-align: right;">
        <p style="color: #c94f53; font-weight: bold; margin: 0 0 6px 0;">ليس لديك صلاحية الوصول.</p>
        <p style="font-size: 11px; color: #555; margin: 0 0 8px 0;">تأكد من إضافة UID المستخدم إلى authorizedUsers في Firebase Console.</p>
        <div style="display: flex; gap: 6px; align-items: center;">
          <input type="text" readonly value="${user.uid}" id="uid-input" style="font-family: monospace; font-size: 11px; padding: 4px 8px; direction: ltr; text-align: left;" />
          <button type="button" class="button button-outline" style="min-height: 30px; padding: 2px 10px; font-size: 11px;" onclick="document.getElementById('uid-input').select(); document.execCommand('copy'); alert('تم نسخ الـ UID!');">نسخ</button>
        </div>
      </div>
    `;
    await signOut(auth);
    return false;
  }
  return true;
}

loginForm.addEventListener("submit", async (event) => {
// ... existing code ...
