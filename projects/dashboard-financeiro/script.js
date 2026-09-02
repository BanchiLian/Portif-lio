"use strict";

/* ==========================================================================
   Nexus Finance — painel financeiro pessoal (dados locais, uso offline)
   ========================================================================== */

const KEY = "nexus-finance-v4";
const LEGACY_KEY = "nexus-finance-v3";
const OLD_KEYS = ["nxs_trans", "nxs_budgets", "nxs_goals", "nxs_accounts", "nxs_check"];

const $ = id => document.getElementById(id);
const uid = prefix => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const esc = s => String(s ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
const today = () => new Date().toISOString().slice(0, 10);
const monthOf = d => String(d).slice(0, 7);
const brDate = d => String(d).split("-").reverse().join("/");

let hideValues = false;
let cashChart;
let expenseChart;

const money = n => hideValues
  ? "R$ •••••"
  : Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/* ---------------------------------------------------------------- Estado --- */

const DEFAULT_CATEGORIES = [
  { name: "Moradia", kind: "expense", color: "#e50914" },
  { name: "Alimentação", kind: "expense", color: "#f5b942" },
  { name: "Transporte", kind: "expense", color: "#4d8dff" },
  { name: "Saúde", kind: "expense", color: "#43d17a" },
  { name: "Lazer", kind: "expense", color: "#8e44ad" },
  { name: "Educação", kind: "expense", color: "#00b8d9" },
  { name: "Assinaturas", kind: "expense", color: "#ff7a45" },
  { name: "Outros", kind: "expense", color: "#7a7a7a" },
  { name: "Salário", kind: "income", color: "#43d17a" },
  { name: "Renda extra", kind: "income", color: "#2ecc71" }
];
const FALLBACK_COLORS = ["#e50914", "#f5b942", "#4d8dff", "#43d17a", "#8e44ad", "#00b8d9", "#ff7a45", "#c0392b", "#16a085", "#d35400"];

function read(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function initialState() {
  return {
    version: 4,
    prefs: { hideValues: false },
    accounts: [{ id: "acc-main", name: "Conta principal", openingBalance: 0 }],
    categories: DEFAULT_CATEGORIES.map((c, i) => ({ id: `cat-${i}`, ...c })),
    transactions: [],
    bills: [],
    recurring: [],
    budgets: [],
    goals: []
  };
}

/* Lê o formato mais recente disponível e devolve algo cru para o normalize. */
function loadRaw() {
  const current = read(KEY, null);
  if (current) return current;

  const legacy = read(LEGACY_KEY, null);
  if (legacy) return legacy;

  const oldAccounts = read("nxs_accounts", []);
  const oldTrans = read("nxs_trans", []);
  if (oldAccounts.length || oldTrans.length) {
    const accounts = (oldAccounts.length ? oldAccounts : ["Conta principal"]).map((a, i) => ({ id: `acc-${i}`, name: String(a), openingBalance: 0 }));
    const accountId = name => accounts.find(a => a.name === name)?.id || accounts[0].id;
    return {
      accounts,
      transactions: oldTrans.map(t => ({
        id: String(t.id || uid("tx")),
        description: t.desc || t.description || "Lançamento",
        amount: Number(t.amount) || 0,
        date: t.date || today(),
        type: t.type === "transfer" ? "goal" : t.type,
        category: t.category || "Outros",
        accountId: accountId(t.account),
        notes: t.justification || t.notes || ""
      })),
      bills: read("nxs_check", []).map(b => ({ ...b, id: String(b.id), accountId: accounts[0].id })),
      budgets: read("nxs_budgets", []),
      goals: read("nxs_goals", [])
    };
  }
  return null;
}

/* Garante o formato v4 a partir de qualquer versão anterior ou de um backup. */
function normalize(input) {
  const base = initialState();
  const s = { ...base, ...(input || {}) };

  s.version = 4;
  s.prefs = { hideValues: Boolean(s.prefs?.hideValues) };

  s.accounts = (s.accounts || []).map((a, i) => typeof a === "string"
    ? { id: `acc-${i}`, name: a, openingBalance: 0 }
    : { id: String(a.id || uid("acc")), name: String(a.name || "Conta"), openingBalance: Number(a.openingBalance) || 0 });
  if (!s.accounts.length) s.accounts = base.accounts;
  const accountIds = new Set(s.accounts.map(a => a.id));
  const firstAccount = s.accounts[0].id;

  s.categories = (s.categories && s.categories.length ? s.categories : base.categories).map((c, i) => ({
    id: String(c.id || `cat-${i}`),
    name: String(c.name || "Categoria"),
    kind: c.kind === "income" ? "income" : "expense",
    color: /^#[0-9a-f]{6}$/i.test(c.color || "") ? c.color : FALLBACK_COLORS[i % FALLBACK_COLORS.length]
  }));

  s.transactions = (s.transactions || []).filter(t => t && t.date).map(t => {
    const type = ["income", "expense", "goal", "transfer"].includes(t.type) ? t.type : "expense";
    return {
      id: String(t.id || uid("tx")),
      description: String(t.description || t.desc || "Lançamento"),
      amount: Math.abs(Number(t.amount) || 0),
      date: String(t.date).slice(0, 10),
      type,
      category: String(t.category || "Outros"),
      accountId: accountIds.has(t.accountId) ? t.accountId : (s.accounts.find(a => a.name === t.account)?.id || firstAccount),
      toAccountId: type === "transfer" && accountIds.has(t.toAccountId) ? t.toAccountId : undefined,
      goalWithdraw: type === "goal" ? Boolean(t.goalWithdraw) : undefined,
      recurringId: t.recurringId || undefined,
      notes: String(t.notes || t.justification || "")
    };
  });

  s.bills = (s.bills || []).map(b => ({
    id: String(b.id || uid("bill")),
    name: String(b.name || "Conta"),
    amount: Math.abs(Number(b.amount) || 0),
    day: Math.min(31, Math.max(1, Number(b.day) || 1)),
    category: String(b.category || "Outros"),
    accountId: accountIds.has(b.accountId) ? b.accountId : firstAccount,
    since: /^\d{4}-\d{2}$/.test(b.since || "") ? b.since : monthOf(today()),
    payments: b.payments && typeof b.payments === "object" ? b.payments : {}
  }));

  s.recurring = (s.recurring || []).map(r => ({
    id: String(r.id || uid("rec")),
    description: String(r.description || "Recorrente"),
    amount: Math.abs(Number(r.amount) || 0),
    day: Math.min(31, Math.max(1, Number(r.day) || 1)),
    type: r.type === "income" ? "income" : "expense",
    category: String(r.category || "Outros"),
    accountId: accountIds.has(r.accountId) ? r.accountId : firstAccount,
    start: /^\d{4}-\d{2}$/.test(r.start || "") ? r.start : monthOf(today()),
    active: r.active !== false,
    generated: r.generated && typeof r.generated === "object" ? r.generated : {}
  }));

  s.budgets = (s.budgets || []).map(b => ({ id: String(b.id || uid("budget")), name: String(b.name || "Categoria"), limit: Math.abs(Number(b.limit) || 0) }));
  s.goals = (s.goals || []).map(g => ({ id: String(g.id || uid("goal")), name: String(g.name || "Meta"), target: Math.abs(Number(g.target) || 0) }));

  return s;
}

let state = normalize(loadRaw());
hideValues = state.prefs.hideValues;

function save() {
  state.prefs.hideValues = hideValues;
  localStorage.setItem(KEY, JSON.stringify(state));
}

/* Persiste imediatamente o estado migrado (mantendo o dado antigo como cópia). */
save();

/* Cria os lançamentos dos recorrentes desde o mês inicial até o mês atual. */
function runRecurring() {
  const now = monthOf(today());
  let created = 0;

  state.recurring.forEach(rec => {
    if (!rec.active) return;
    for (let cursor = rec.start; cursor <= now; cursor = nextMonth(cursor)) {
      if (rec.generated[cursor]) continue;
      const [year, month] = cursor.split("-").map(Number);
      const day = Math.min(rec.day, new Date(year, month, 0).getDate());
      const date = `${cursor}-${String(day).padStart(2, "0")}`;
      const tx = {
        id: uid("tx"),
        description: rec.description,
        amount: rec.amount,
        date,
        type: rec.type,
        category: rec.category,
        accountId: rec.accountId,
        recurringId: rec.id,
        notes: "Lançamento recorrente"
      };
      state.transactions.push(tx);
      rec.generated[cursor] = tx.id;
      created++;
    }
  });

  if (created) save();
  return created;
}

function nextMonth(ym) {
  let [y, m] = ym.split("-").map(Number);
  m += 1;
  if (m > 12) { m = 1; y += 1; }
  return `${y}-${String(m).padStart(2, "0")}`;
}

/* ------------------------------------------------------------- Auxiliares --- */

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2600);
}

function accountName(id) {
  return state.accounts.find(a => a.id === id)?.name || "Conta removida";
}

function categoryColor(name) {
  const found = state.categories.find(c => c.name.toLowerCase() === String(name).toLowerCase());
  if (found) return found.color;
  let hash = 0;
  for (const ch of String(name)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

function balance(account) {
  return state.transactions.reduce((total, t) => {
    if (t.type === "transfer") {
      if (t.accountId === account.id) return total - t.amount;
      if (t.toAccountId === account.id) return total + t.amount;
      return total;
    }
    if (t.accountId !== account.id) return total;
    if (t.type === "income") return total + t.amount;
    if (t.type === "expense") return total - t.amount;
    if (t.type === "goal") return total + (t.goalWithdraw ? t.amount : -t.amount);
    return total;
  }, account.openingBalance);
}

function goalSaved(name) {
  return state.transactions
    .filter(t => t.type === "goal" && t.category === name)
    .reduce((total, t) => total + (t.goalWithdraw ? -t.amount : t.amount), 0);
}

function reservedInGoals() {
  return state.goals.reduce((total, g) => total + Math.max(0, goalSaved(g.name)), 0);
}

function selectedTransactions() {
  const mode = $("view-mode").value;
  const year = $("filter-year").value;
  const month = $("filter-month").value;
  return state.transactions.filter(t => mode === "all" || t.date.startsWith(mode === "year" ? year : `${year}-${month}`));
}

function selectedPeriod() {
  return `${$("filter-year").value}-${$("filter-month").value}`;
}

/* Contas fixas em atraso nos últimos 12 meses (sem pagamento registrado). */
function overdueBills() {
  const now = monthOf(today());
  const currentDay = new Date().getDate();
  const limit = (() => { let c = now; for (let i = 0; i < 11; i++) c = prevMonth(c); return c; })();

  return state.bills.map(bill => {
    let count = 0;
    const start = bill.since > limit ? bill.since : limit;
    for (let cursor = start; cursor <= now; cursor = nextMonth(cursor)) {
      if (bill.payments[cursor]) continue;
      if (cursor === now && bill.day >= currentDay) continue;
      count++;
    }
    return { bill, count };
  }).filter(x => x.count > 0);
}

function prevMonth(ym) {
  let [y, m] = ym.split("-").map(Number);
  m -= 1;
  if (m < 1) { m = 12; y -= 1; }
  return `${y}-${String(m).padStart(2, "0")}`;
}

/* --------------------------------------------------------------- Selects --- */

function categoryNames(kind) {
  const used = state.transactions.filter(t => (kind ? true : true)).map(t => t.category);
  const declared = state.categories.filter(c => !kind || c.kind === kind).map(c => c.name);
  return [...new Set([...declared, ...state.budgets.map(b => b.name), ...used])];
}

function fillAccountSelect(id, selected) {
  const options = state.accounts.map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join("");
  const el = $(id);
  if (!el) return;
  el.innerHTML = options;
  if (selected) el.value = selected;
}

function setOptions() {
  ["tx-account", "tx-to-account", "bill-account", "recurring-account", "payment-account"].forEach(id => fillAccountSelect(id));

  $("category-options").innerHTML = [...new Set(state.categories.map(c => c.name))]
    .map(name => `<option value="${esc(name)}">`).join("");

  syncTransactionType();
}

/* Ajusta os campos do modal de lançamento conforme o tipo escolhido. */
function syncTransactionType() {
  const type = $("tx-type").value;
  const categoryField = $("tx-category-field");
  const categorySelect = $("tx-category");
  const toAccountField = $("tx-to-account-field");
  const toAccountSelect = $("tx-to-account");
  const isTransfer = type === "transfer";
  const isGoal = type === "goal" || type === "goal-withdraw";

  toAccountField.hidden = !isTransfer;
  toAccountSelect.disabled = !isTransfer;
  toAccountSelect.required = isTransfer;

  categoryField.hidden = isTransfer;
  categorySelect.disabled = isTransfer;
  categorySelect.required = !isTransfer;

  if (isTransfer) return;

  if (isGoal) {
    categoryField.firstChild.textContent = "Meta";
    categorySelect.innerHTML = state.goals.length
      ? state.goals.map(g => `<option value="${esc(g.name)}">${esc(g.name)}</option>`).join("")
      : `<option value="">Crie uma meta primeiro</option>`;
  } else {
    categoryField.firstChild.textContent = "Categoria";
    const kind = type === "income" ? "income" : "expense";
    categorySelect.innerHTML = categoryNames(kind).map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
  }
}

/* --------------------------------------------------------------- Filtros --- */

function initFilters() {
  $("filter-month").innerHTML = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
    .map((n, i) => `<option value="${String(i + 1).padStart(2, "0")}">${n}</option>`).join("");
  $("filter-month").value = String(new Date().getMonth() + 1).padStart(2, "0");
  refreshYearOptions();
  applyFilterVisibility();
}

function refreshYearOptions() {
  const current = $("filter-year").value;
  const now = new Date().getFullYear();
  const years = new Set([now, ...state.transactions.map(t => Number(t.date.slice(0, 4))).filter(Boolean)]);
  $("filter-year").innerHTML = [...years].sort((a, b) => b - a).map(y => `<option>${y}</option>`).join("");
  if (current) $("filter-year").value = current;
}

function applyFilterVisibility() {
  const mode = $("view-mode").value;
  $("filter-month").hidden = mode !== "month";
  $("filter-year").hidden = mode === "all";
}

/* ------------------------------------------------------------ Renderização --- */

function render() {
  refreshYearOptions();
  setOptions();

  const txs = selectedTransactions();
  const income = txs.filter(t => t.type === "income").reduce((n, t) => n + t.amount, 0);
  const expense = txs.filter(t => t.type === "expense").reduce((n, t) => n + t.amount, 0);
  const total = state.accounts.reduce((n, a) => n + balance(a), 0);
  const period = selectedPeriod();
  const pending = state.bills.filter(b => !b.payments[period]).reduce((n, b) => n + b.amount, 0);

  $("main-balance").textContent = money(total);
  $("kpi-income").textContent = money(income);
  $("kpi-expense").textContent = money(expense);
  $("kpi-result").textContent = money(income - expense);
  $("kpi-result").className = income - expense >= 0 ? "positive" : "negative";
  $("kpi-goals").textContent = money(reservedInGoals());
  $("kpi-pending").textContent = money(pending);
  $("period-label").textContent = $("view-mode").value === "all"
    ? "Patrimônio disponível em todas as contas"
    : "Indicadores do período selecionado";

  $("privacy-button").setAttribute("aria-pressed", String(hideValues));
  $("accounts-rail").innerHTML = state.accounts
    .map(a => `<article class="account-card"><span>${esc(a.name)}</span><strong>${money(balance(a))}</strong></article>`).join("");

  renderAlerts();
  renderBills(period);
  renderRecurring();
  renderBudgets(txs);
  renderGoals();
  renderHistory();
  renderRecent(txs);
  renderAccounts();
  renderCategories();
  renderCharts(txs);
}

function renderAlerts() {
  const overdue = overdueBills();
  const totalCount = overdue.reduce((n, x) => n + x.count, 0);
  $("alerts").innerHTML = totalCount
    ? `<div class="alert"><strong>${totalCount} vencimento(s) em atraso</strong> em ${overdue.length} conta(s) fixa(s). Confira a aba Contas fixas.</div>`
    : "";
}

function renderBills(period) {
  $("bills-grid").innerHTML = state.bills.length ? state.bills.map(b => {
    const paid = b.payments[period];
    return `<article class="item-card">
      <div class="item-top"><div><strong>${esc(b.name)}</strong><small>Vence dia ${b.day}</small></div><strong>${money(b.amount)}</strong></div>
      <p class="muted small">${esc(b.category)} · ${esc(accountName(b.accountId))}</p>
      <div class="item-actions">
        ${paid
          ? `<span class="positive small">Pago em ${esc(brDate(paid.date || ""))}</span><button class="mini-button" data-unpay="${esc(b.id)}">Desfazer</button>`
          : `<button class="mini-button" data-pay="${esc(b.id)}">Registrar pagamento</button>`}
        <button class="mini-button" data-edit-bill="${esc(b.id)}">Editar</button>
        <button class="mini-button" data-delete-bill="${esc(b.id)}">Excluir</button>
      </div>
    </article>`;
  }).join("") : `<p class="empty">Nenhuma conta fixa cadastrada.</p>`;
}

function renderRecurring() {
  const now = monthOf(today());
  $("recurring-grid").innerHTML = state.recurring.length ? state.recurring.map(r => {
    const launched = Boolean(r.generated[now]);
    return `<article class="item-card ${r.active ? "" : "muted-card"}">
      <div class="item-top"><div><strong>${esc(r.description)}</strong><small>Todo dia ${r.day} · ${r.type === "income" ? "Entrada" : "Saída"}</small></div><strong class="${r.type === "income" ? "positive" : "negative"}">${money(r.amount)}</strong></div>
      <p class="muted small">${esc(r.category)} · ${esc(accountName(r.accountId))} · desde ${esc(brMonth(r.start))}</p>
      <p class="muted small">${r.active ? (launched ? "Lançado neste mês" : "Aguardando o dia do mês") : "Pausado"}</p>
      <div class="item-actions">
        <button class="mini-button" data-toggle-recurring="${esc(r.id)}">${r.active ? "Pausar" : "Retomar"}</button>
        <button class="mini-button" data-edit-recurring="${esc(r.id)}">Editar</button>
        <button class="mini-button" data-delete-recurring="${esc(r.id)}">Excluir</button>
      </div>
    </article>`;
  }).join("") : `<p class="empty">Nenhum lançamento recorrente. Cadastre o salário ou uma assinatura.</p>`;
}

function brMonth(ym) {
  const [y, m] = ym.split("-");
  return `${["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][Number(m) - 1]}/${y}`;
}

function renderBudgets(txs) {
  $("budgets-grid").innerHTML = state.budgets.length ? state.budgets.map(b => {
    const spent = txs.filter(t => t.type === "expense" && t.category === b.name).reduce((n, t) => n + t.amount, 0);
    const limit = b.limit;
    const pct = Math.min(100, limit ? spent / limit * 100 : 0);
    return `<article class="item-card">
      <div class="item-top"><strong>${esc(b.name)}</strong><strong class="${spent > limit ? "negative" : ""}">${money(spent)}</strong></div>
      <div class="progress"><span style="width:${pct}%;background:${spent > limit ? "var(--red)" : "var(--green)"}"></span></div>
      <p class="muted small">${pct.toFixed(0)}% de ${money(limit)}</p>
      <div class="item-actions"><button class="mini-button" data-edit-budget="${esc(b.id)}">Editar</button><button class="mini-button" data-delete-budget="${esc(b.id)}">Excluir</button></div>
    </article>`;
  }).join("") : `<p class="empty">Crie limites para acompanhar seus gastos.</p>`;
}

function renderGoals() {
  $("goals-grid").innerHTML = state.goals.length ? state.goals.map(g => {
    const value = goalSaved(g.name);
    const pct = g.target ? Math.min(100, Math.max(0, value / g.target * 100)) : 0;
    return `<article class="item-card">
      <div class="item-top"><strong>${esc(g.name)}</strong><strong>${money(value)}</strong></div>
      <div class="progress"><span style="width:${pct}%;background:var(--blue)"></span></div>
      <p class="muted small">${pct.toFixed(0)}% de ${money(g.target)}</p>
      <div class="item-actions">
        <button class="mini-button" data-goal-add="${esc(g.name)}">Guardar</button>
        <button class="mini-button" data-goal-withdraw="${esc(g.name)}">Resgatar</button>
        <button class="mini-button" data-edit-goal="${esc(g.id)}">Editar</button>
        <button class="mini-button" data-delete-goal="${esc(g.id)}">Excluir</button>
      </div>
    </article>`;
  }).join("") : `<p class="empty">Nenhuma meta criada.</p>`;
}

function filteredHistory() {
  const query = $("history-search").value.toLowerCase();
  const type = $("history-type").value;
  return selectedTransactions().filter(t =>
    (type === "all" || t.type === type) &&
    [t.description, t.category, accountName(t.accountId), t.type === "transfer" ? accountName(t.toAccountId) : ""]
      .some(v => String(v).toLowerCase().includes(query)));
}

function txLabel(t) {
  if (t.type === "income") return "Entrada";
  if (t.type === "expense") return "Saída";
  if (t.type === "transfer") return "Transferência";
  return t.goalWithdraw ? "Resgate de meta" : "Meta";
}

function txRow(t) {
  const positive = t.type === "income" || (t.type === "goal" && t.goalWithdraw);
  const neutral = t.type === "transfer";
  const detail = t.type === "transfer" ? `${esc(accountName(t.accountId))} → ${esc(accountName(t.toAccountId))}` : esc(accountName(t.accountId));
  return `<tr>
    <td>${brDate(t.date)}</td>
    <td><strong>${esc(t.description)}</strong>${t.notes ? `<br><small class="muted">${esc(t.notes)}</small>` : ""}</td>
    <td>${t.type === "transfer" ? "—" : esc(t.category)}</td>
    <td>${detail}</td>
    <td>${txLabel(t)}</td>
    <td class="${neutral ? "" : positive ? "positive" : "negative"}">${neutral ? "" : positive ? "+ " : "− "}${money(t.amount)}</td>
    <td class="row-actions">
      <button class="mini-button" data-edit-tx="${esc(t.id)}">Editar</button>
      <button class="mini-button" data-delete-tx="${esc(t.id)}">Excluir</button>
    </td>
  </tr>`;
}

function renderHistory() {
  $("history-body").innerHTML = filteredHistory()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(txRow).join("") || `<tr><td colspan="7" class="empty">Nenhum lançamento encontrado.</td></tr>`;
}

function renderRecent(txs) {
  $("recent-list").innerHTML = txs.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map(t => {
    const icon = t.type === "income" ? "↑" : t.type === "transfer" ? "⇄" : t.type === "goal" ? "◎" : "↓";
    const positive = t.type === "income" || (t.type === "goal" && t.goalWithdraw);
    return `<div class="activity">
      <span class="activity-icon">${icon}</span>
      <div class="activity-main"><strong>${esc(t.description)}</strong><small>${t.type === "transfer" ? "Transferência" : esc(t.category)} · ${brDate(t.date)}</small></div>
      <span class="activity-value ${t.type === "transfer" ? "" : positive ? "positive" : "negative"}">${money(t.amount)}</span>
    </div>`;
  }).join("") || `<p class="empty">Registre sua primeira movimentação.</p>`;
}

function renderAccounts() {
  $("account-list").innerHTML = state.accounts.map(a => `<div class="setting-row">
    <div><strong>${esc(a.name)}</strong><small>Saldo inicial: ${money(a.openingBalance)} · Atual: ${money(balance(a))}</small></div>
    <button class="mini-button" data-delete-account="${esc(a.id)}">Excluir</button>
  </div>`).join("");
}

function renderCategories() {
  $("category-list").innerHTML = state.categories.map(c => `<div class="setting-row">
    <div><strong><span class="swatch" style="background:${esc(c.color)}"></span>${esc(c.name)}</strong><small>${c.kind === "income" ? "Entrada" : "Saída"}</small></div>
    <button class="mini-button" data-delete-category="${esc(c.id)}">Excluir</button>
  </div>`).join("");
}

function renderCharts(txs) {
  if (typeof Chart === "undefined") return;
  cashChart?.destroy();
  expenseChart?.destroy();

  const monthly = $("view-mode").value === "month";
  const labels = monthly
    ? Array.from({ length: new Date(Number($("filter-year").value), Number($("filter-month").value), 0).getDate() }, (_, i) => i + 1)
    : ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const income = labels.map(() => 0);
  const outflow = labels.map(() => 0);

  txs.forEach(t => {
    if (t.type === "transfer") return;
    const i = monthly ? Number(t.date.slice(8, 10)) - 1 : Number(t.date.slice(5, 7)) - 1;
    if (t.type === "income" || (t.type === "goal" && t.goalWithdraw)) income[i] += t.amount;
    else outflow[i] += t.amount;
  });

  Chart.defaults.color = "#888";
  const maskTicks = { callback: value => hideValues ? "•••" : value };

  cashChart = new Chart($("cash-chart"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Entradas", data: income, backgroundColor: "#43d17a", borderRadius: 4 },
        { label: "Saídas e metas", data: outflow, backgroundColor: "#e50914", borderRadius: 4 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { tooltip: { enabled: !hideValues } },
      scales: { x: { grid: { display: false } }, y: { grid: { color: "#292929" }, ticks: maskTicks } }
    }
  });

  const byCategory = {};
  txs.filter(t => t.type === "expense").forEach(t => { byCategory[t.category] = (byCategory[t.category] || 0) + t.amount; });
  const names = Object.keys(byCategory);

  expenseChart = new Chart($("expense-chart"), {
    type: "doughnut",
    data: {
      labels: names.length ? names : ["Sem despesas"],
      datasets: [{
        data: names.length ? Object.values(byCategory) : [1],
        backgroundColor: names.length ? names.map(categoryColor) : ["#333"],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: { legend: { position: "bottom" }, tooltip: { enabled: !hideValues } }
    }
  });
}

/* ------------------------------------------------------------- Exclusão ---- */

function remove(kind, id) {
  const listByKind = { tx: "transactions", bill: "bills", budget: "budgets", goal: "goals", account: "accounts", recurring: "recurring", category: "categories" };
  const list = listByKind[kind];

  if (kind === "account") {
    const linked = state.transactions.some(t => t.accountId === id || t.toAccountId === id)
      || state.bills.some(b => b.accountId === id)
      || state.recurring.some(r => r.accountId === id);
    if (state.accounts.length === 1 || linked) return toast("A conta possui vínculos ou é a única cadastrada.");
  }

  if (!confirm("Confirma a exclusão?")) return;

  if (kind === "tx") {
    const tx = state.transactions.find(t => String(t.id) === id);
    if (tx) {
      state.bills.forEach(b => {
        for (const [period, payment] of Object.entries(b.payments)) {
          if (payment && payment.transactionId === tx.id) delete b.payments[period];
        }
      });
      if (tx.recurringId) {
        const rec = state.recurring.find(r => r.id === tx.recurringId);
        if (rec) {
          for (const [period, generatedId] of Object.entries(rec.generated)) {
            if (generatedId === tx.id) rec.generated[period] = "removed";
          }
        }
      }
    }
  }

  if (kind === "recurring") {
    const rec = state.recurring.find(r => String(r.id) === id);
    const generatedIds = new Set(Object.values(rec?.generated || {}));
    state.transactions = state.transactions.filter(t => !generatedIds.has(t.id));
  }

  state[list] = state[list].filter(x => String(x.id) !== id);
  save();
  render();
  toast("Item excluído.");
}

/* --------------------------------------------------------- Import/Export --- */

function download(name, text, type) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(new Blob([text], { type }));
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

const csvCell = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
const CSV_HEADERS = ["Data", "Tipo", "Descrição", "Categoria", "Conta", "Valor", "Observações"];

function csvText(rows) {
  return "﻿" + [CSV_HEADERS, ...rows].map(r => r.map(csvCell).join(";")).join("\r\n");
}

function parseCSV(text) {
  const firstLine = text.split(/\r?\n/, 1)[0];
  const delimiter = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ";" : ",";
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (c === delimiter && !quoted) {
      row.push(cell); cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some(x => x.trim())) rows.push(row);
      row = []; cell = "";
    } else {
      cell += c;
    }
  }
  row.push(cell);
  if (row.some(x => x.trim())) rows.push(row);
  return rows;
}

function numberBR(value) {
  let s = String(value).replace(/R\$|\s/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  return Math.abs(Number(s));
}

function importCSV(text) {
  const rows = parseCSV(text.replace(/^﻿/, ""));
  if (rows.length < 2) throw Error("O arquivo não possui lançamentos.");
  const norm = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const heads = rows.shift().map(norm);
  const col = name => heads.indexOf(norm(name));

  const existing = new Set(state.transactions.map(t => `${t.date}|${t.type}|${t.category}|${t.amount}|${t.description.toLowerCase()}`));
  let count = 0;
  let skipped = 0;

  rows.forEach(r => {
    let date = r[col("Data")];
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
      const [d, m, y] = date.split("/");
      date = `${y}-${m}-${d}`;
    }
    let type = norm(r[col("Tipo")]);
    type = type.startsWith("entr") || type === "income" ? "income"
      : type.startsWith("meta") || type === "goal" ? "goal"
      : "expense";
    const amount = numberBR(r[col("Valor")]);
    const description = r[col("Descrição")];
    const accName = r[col("Conta")];
    if (!date || !amount || !description) return;

    let account = state.accounts.find(a => norm(a.name) === norm(accName));
    if (!account) {
      account = { id: uid("acc"), name: accName || "Conta importada", openingBalance: 0 };
      state.accounts.push(account);
    }
    const category = r[col("Categoria")] || "Outros";
    const fingerprint = `${date}|${type}|${category}|${amount}|${String(description).toLowerCase()}`;
    if (existing.has(fingerprint)) { skipped++; return; }
    existing.add(fingerprint);

    state.transactions.push({
      id: uid("tx"), date, type, description,
      category, accountId: account.id, amount,
      notes: r[col("Observações")] || ""
    });
    count++;
  });

  if (!count && !skipped) throw Error("Nenhuma linha válida foi encontrada.");
  save();
  return { count, skipped };
}

/* --------------------------------------------------------- Relatório PDF --- */

function buildReport() {
  const txs = selectedTransactions().slice().sort((a, b) => a.date.localeCompare(b.date));
  const income = txs.filter(t => t.type === "income").reduce((n, t) => n + t.amount, 0);
  const expense = txs.filter(t => t.type === "expense").reduce((n, t) => n + t.amount, 0);
  const byCategory = {};
  txs.filter(t => t.type === "expense").forEach(t => { byCategory[t.category] = (byCategory[t.category] || 0) + t.amount; });

  const periodText = $("view-mode").value === "all"
    ? "Todo o período"
    : $("view-mode").value === "year"
      ? `Ano de ${$("filter-year").value}`
      : `${brMonth(selectedPeriod())}`;

  const fmt = n => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  $("report").innerHTML = `
    <h1>Nexus Finance — Relatório</h1>
    <p class="report-meta">${periodText} · gerado em ${brDate(today())}</p>
    <table class="report-summary">
      <tr><th>Entradas</th><td>${fmt(income)}</td></tr>
      <tr><th>Saídas</th><td>${fmt(expense)}</td></tr>
      <tr><th>Resultado</th><td>${fmt(income - expense)}</td></tr>
      <tr><th>Patrimônio atual</th><td>${fmt(state.accounts.reduce((n, a) => n + balance(a), 0))}</td></tr>
      <tr><th>Reservado em metas</th><td>${fmt(reservedInGoals())}</td></tr>
    </table>
    <h2>Despesas por categoria</h2>
    <table class="report-table">
      <thead><tr><th>Categoria</th><th>Valor</th></tr></thead>
      <tbody>${Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${fmt(v)}</td></tr>`).join("") || `<tr><td colspan="2">Sem despesas.</td></tr>`}</tbody>
    </table>
    <h2>Lançamentos (${txs.length})</h2>
    <table class="report-table">
      <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Conta</th><th>Tipo</th><th>Valor</th></tr></thead>
      <tbody>${txs.map(t => `<tr><td>${brDate(t.date)}</td><td>${esc(t.description)}</td><td>${t.type === "transfer" ? "—" : esc(t.category)}</td><td>${esc(accountName(t.accountId))}${t.type === "transfer" ? " → " + esc(accountName(t.toAccountId)) : ""}</td><td>${txLabel(t)}</td><td>${fmt(t.amount)}</td></tr>`).join("") || `<tr><td colspan="6">Nenhum lançamento no período.</td></tr>`}</tbody>
    </table>`;
}

/* --------------------------------------------------------------- Modais ---- */

const editing = { tx: null, bill: null, recurring: null, budget: null, goal: null };

function openModal(id) {
  setOptions();
  const dialog = $(id);
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function resetTransactionModal() {
  editing.tx = null;
  $("tx-modal-title").textContent = "Novo lançamento";
  $("transaction-form").reset();
  $("tx-date").value = today();
  syncTransactionType();
}

function openTransactionEdit(id) {
  const t = state.transactions.find(x => String(x.id) === id);
  if (!t) return;
  editing.tx = t.id;
  openModal("transaction-modal");
  $("tx-modal-title").textContent = "Editar lançamento";
  $("tx-type").value = t.type === "goal" && t.goalWithdraw ? "goal-withdraw" : t.type;
  syncTransactionType();
  $("tx-description").value = t.description;
  $("tx-amount").value = t.amount;
  $("tx-date").value = t.date;
  $("tx-account").value = t.accountId;
  if (t.type === "transfer") $("tx-to-account").value = t.toAccountId || state.accounts[0].id;
  else $("tx-category").value = t.category;
  $("tx-notes").value = t.notes || "";
}

/* ---------------------------------------------------------------- Boot ----- */

document.addEventListener("DOMContentLoaded", () => {
  initFilters();
  runRecurring();
  $("tx-date").value = today();
  $("payment-date").value = today();
  $("recurring-start").value = monthOf(today());
  render();

  /* Cliques globais (navegação, abrir modais, ações dos cards). */
  document.addEventListener("click", e => {
    const el = e.target.closest("button,[data-action]");
    if (!el) return;
    const d = el.dataset;

    if (d.section) {
      document.querySelectorAll(".page,.nav-item,.tab").forEach(x => x.classList.remove("active"));
      $(d.section).classList.add("active");
      document.querySelectorAll(`.nav-item[data-section="${d.section}"]`).forEach(x => { x.classList.add("active"); x.setAttribute("aria-current", "page"); });
      document.querySelectorAll(`.nav-item:not([data-section="${d.section}"])`).forEach(x => x.removeAttribute("aria-current"));
      document.querySelector(`.tab[data-section="${d.section}"]`)?.classList.add("active");
      document.querySelector(".sidebar").classList.remove("open");
      document.querySelector(".sidebar-overlay").classList.remove("open");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    if (d.action === "menu") {
      document.querySelector(".sidebar").classList.toggle("open");
      document.querySelector(".sidebar-overlay").classList.toggle("open");
    }

    if (d.open) {
      if (d.open === "transaction-modal") resetTransactionModal();
      if (d.open === "bill-modal" && !editing.bill) { $("bill-modal-title").textContent = "Nova conta fixa"; $("bill-form").reset(); }
      if (d.open === "recurring-modal" && !editing.recurring) { $("recurring-modal-title").textContent = "Novo recorrente"; $("recurring-form").reset(); $("recurring-start").value = monthOf(today()); }
      if (d.open === "budget-modal" && !editing.budget) { $("budget-modal-title").textContent = "Novo orçamento"; $("budget-form").reset(); }
      if (d.open === "goal-modal" && !editing.goal) { $("goal-modal-title").textContent = "Nova meta"; $("goal-form").reset(); }
      openModal(d.open);
    }

    if (d.editTx) openTransactionEdit(d.editTx);
    if (d.deleteTx) remove("tx", d.deleteTx);

    if (d.editBill) {
      const b = state.bills.find(x => String(x.id) === d.editBill);
      if (b) {
        editing.bill = b.id;
        openModal("bill-modal");
        $("bill-modal-title").textContent = "Editar conta fixa";
        $("bill-name").value = b.name; $("bill-amount").value = b.amount; $("bill-day").value = b.day;
        $("bill-category").value = b.category; $("bill-account").value = b.accountId;
      }
    }
    if (d.deleteBill) remove("bill", d.deleteBill);

    if (d.pay) {
      const bill = state.bills.find(x => String(x.id) === d.pay);
      $("payment-bill-id").value = bill.id;
      $("payment-amount").value = bill.amount;
      $("payment-account").value = bill.accountId;
      $("payment-date").value = today();
      openModal("payment-modal");
    }
    if (d.unpay) {
      const bill = state.bills.find(x => String(x.id) === d.unpay);
      const payment = bill?.payments[selectedPeriod()];
      if (payment && confirm("Desfazer este pagamento e remover o lançamento gerado?")) {
        state.transactions = state.transactions.filter(t => t.id !== payment.transactionId);
        delete bill.payments[selectedPeriod()];
        save(); render(); toast("Pagamento desfeito.");
      }
    }

    if (d.editRecurring) {
      const r = state.recurring.find(x => String(x.id) === d.editRecurring);
      if (r) {
        editing.recurring = r.id;
        openModal("recurring-modal");
        $("recurring-modal-title").textContent = "Editar recorrente";
        $("recurring-name").value = r.description; $("recurring-amount").value = r.amount; $("recurring-day").value = r.day;
        $("recurring-type").value = r.type; $("recurring-category").value = r.category;
        $("recurring-account").value = r.accountId; $("recurring-start").value = r.start;
      }
    }
    if (d.toggleRecurring) {
      const r = state.recurring.find(x => String(x.id) === d.toggleRecurring);
      if (r) { r.active = !r.active; if (r.active) runRecurring(); save(); render(); }
    }
    if (d.deleteRecurring) remove("recurring", d.deleteRecurring);

    if (d.editBudget) {
      const b = state.budgets.find(x => String(x.id) === d.editBudget);
      if (b) {
        editing.budget = b.id;
        openModal("budget-modal");
        $("budget-modal-title").textContent = "Editar orçamento";
        $("budget-name").value = b.name; $("budget-limit").value = b.limit;
      }
    }
    if (d.deleteBudget) remove("budget", d.deleteBudget);

    if (d.editGoal) {
      const g = state.goals.find(x => String(x.id) === d.editGoal);
      if (g) {
        editing.goal = g.id;
        openModal("goal-modal");
        $("goal-modal-title").textContent = "Editar meta";
        $("goal-name").value = g.name; $("goal-target").value = g.target;
      }
    }
    if (d.deleteGoal) remove("goal", d.deleteGoal);

    if (d.goalAdd || d.goalWithdraw) {
      resetTransactionModal();
      openModal("transaction-modal");
      $("tx-type").value = d.goalAdd ? "goal" : "goal-withdraw";
      syncTransactionType();
      $("tx-category").value = d.goalAdd || d.goalWithdraw;
      $("tx-description").value = d.goalAdd ? `Guardar em ${d.goalAdd}` : `Resgate de ${d.goalWithdraw}`;
      $("tx-amount").focus();
    }

    if (d.deleteAccount) remove("account", d.deleteAccount);
    if (d.deleteCategory) remove("category", d.deleteCategory);
  });

  /* Filtros de período. */
  ["view-mode", "filter-month", "filter-year"].forEach(id => $(id).addEventListener("change", () => {
    applyFilterVisibility();
    render();
  }));

  ["history-search", "history-type"].forEach(id => $(id).addEventListener("input", renderHistory));
  $("history-type").addEventListener("change", renderHistory);

  $("tx-type").addEventListener("change", syncTransactionType);

  $("privacy-button").addEventListener("click", () => {
    hideValues = !hideValues;
    save();
    render();
  });

  /* -------- Formulários -------- */

  $("transaction-form").addEventListener("submit", e => {
    if (e.submitter?.value === "cancel") { resetTransactionModal(); return; }
    e.preventDefault();
    const uiType = $("tx-type").value;
    const type = uiType === "goal-withdraw" ? "goal" : uiType;
    const data = {
      description: $("tx-description").value.trim(),
      amount: Math.abs(Number($("tx-amount").value)),
      date: $("tx-date").value,
      type,
      category: type === "transfer" ? "" : $("tx-category").value,
      accountId: $("tx-account").value,
      toAccountId: type === "transfer" ? $("tx-to-account").value : undefined,
      goalWithdraw: type === "goal" ? uiType === "goal-withdraw" : undefined,
      notes: $("tx-notes").value.trim()
    };
    if (type === "transfer" && data.accountId === data.toAccountId) { toast("Escolha contas diferentes para a transferência."); return; }
    if (!data.amount) { toast("Informe um valor válido."); return; }

    if (editing.tx) {
      const t = state.transactions.find(x => x.id === editing.tx);
      Object.assign(t, data);
    } else {
      state.transactions.push({ id: uid("tx"), ...data });
    }
    save();
    $("transaction-modal").close();
    resetTransactionModal();
    render();
    toast(editing.tx ? "Lançamento atualizado." : "Lançamento salvo.");
  });

  $("bill-form").addEventListener("submit", e => {
    if (e.submitter?.value === "cancel") { editing.bill = null; return; }
    e.preventDefault();
    const data = {
      name: $("bill-name").value.trim(),
      amount: Math.abs(Number($("bill-amount").value)),
      day: Math.min(31, Math.max(1, Number($("bill-day").value))),
      category: $("bill-category").value.trim() || "Outros",
      accountId: $("bill-account").value
    };
    if (editing.bill) Object.assign(state.bills.find(b => b.id === editing.bill), data);
    else state.bills.push({ id: uid("bill"), ...data, since: monthOf(today()), payments: {} });
    editing.bill = null;
    save();
    $("bill-modal").close();
    render();
    toast("Conta fixa salva.");
  });

  $("recurring-form").addEventListener("submit", e => {
    if (e.submitter?.value === "cancel") { editing.recurring = null; return; }
    e.preventDefault();
    const data = {
      description: $("recurring-name").value.trim(),
      amount: Math.abs(Number($("recurring-amount").value)),
      day: Math.min(31, Math.max(1, Number($("recurring-day").value))),
      type: $("recurring-type").value,
      category: $("recurring-category").value.trim() || "Outros",
      accountId: $("recurring-account").value,
      start: $("recurring-start").value || monthOf(today())
    };
    if (editing.recurring) {
      Object.assign(state.recurring.find(r => r.id === editing.recurring), data);
    } else {
      state.recurring.push({ id: uid("rec"), ...data, active: true, generated: {} });
    }
    editing.recurring = null;
    runRecurring();
    save();
    $("recurring-modal").close();
    render();
    toast("Recorrente salvo.");
  });

  $("payment-form").addEventListener("submit", e => {
    if (e.submitter?.value === "cancel") return;
    e.preventDefault();
    const bill = state.bills.find(x => String(x.id) === $("payment-bill-id").value);
    const date = $("payment-date").value;
    const tx = {
      id: uid("tx"),
      description: bill.name,
      amount: Math.abs(Number($("payment-amount").value)),
      date,
      type: "expense",
      category: bill.category,
      accountId: $("payment-account").value,
      notes: "Pagamento de conta fixa"
    };
    bill.payments[monthOf(date)] = { date, transactionId: tx.id };
    state.transactions.push(tx);
    save();
    $("payment-modal").close();
    render();
    toast("Pagamento registrado.");
  });

  $("budget-form").addEventListener("submit", e => {
    if (e.submitter?.value === "cancel") { editing.budget = null; return; }
    e.preventDefault();
    const data = { name: $("budget-name").value.trim(), limit: Math.abs(Number($("budget-limit").value)) };
    if (editing.budget) Object.assign(state.budgets.find(b => b.id === editing.budget), data);
    else state.budgets.push({ id: uid("budget"), ...data });
    editing.budget = null;
    save();
    $("budget-modal").close();
    render();
    toast("Orçamento salvo.");
  });

  $("goal-form").addEventListener("submit", e => {
    if (e.submitter?.value === "cancel") { editing.goal = null; return; }
    e.preventDefault();
    const data = { name: $("goal-name").value.trim(), target: Math.abs(Number($("goal-target").value)) };
    if (editing.goal) Object.assign(state.goals.find(g => g.id === editing.goal), data);
    else state.goals.push({ id: uid("goal"), ...data });
    editing.goal = null;
    save();
    $("goal-modal").close();
    render();
    toast("Meta salva.");
  });

  $("account-form").addEventListener("submit", e => {
    e.preventDefault();
    state.accounts.push({ id: uid("acc"), name: $("account-name").value.trim(), openingBalance: Number($("account-opening").value) || 0 });
    save();
    e.target.reset();
    $("account-opening").value = 0;
    render();
    toast("Conta adicionada.");
  });

  $("category-form").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("category-name").value.trim();
    if (state.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) { toast("Categoria já existe."); return; }
    state.categories.push({ id: uid("cat"), name, kind: $("category-kind").value, color: $("category-color").value });
    save();
    e.target.reset();
    $("category-color").value = "#e50914";
    render();
    toast("Categoria adicionada.");
  });

  /* -------- Excel, backup, relatório, reset -------- */

  $("csv-template").onclick = () => download("modelo-nexus-finance.csv",
    csvText([[today(), "Saída", "Exemplo", "Alimentação", "Conta principal", "25,90", "Apague esta linha"]]),
    "text/csv;charset=utf-8");

  $("csv-export").onclick = () => download(`nexus-lancamentos-${today()}.csv`,
    csvText(state.transactions.map(t => [
      t.date,
      { income: "Entrada", expense: "Saída", goal: t.goalWithdraw ? "Resgate" : "Meta", transfer: "Transferência" }[t.type],
      t.description, t.type === "transfer" ? "" : t.category, accountName(t.accountId),
      t.amount.toFixed(2).replace(".", ","), t.notes
    ])), "text/csv;charset=utf-8");

  $("csv-import").onclick = () => $("csv-file").click();
  $("csv-file").onchange = async e => {
    try {
      const { count, skipped } = importCSV(await e.target.files[0].text());
      render();
      $("file-status").textContent = `${count} lançamento(s) importado(s)${skipped ? `, ${skipped} ignorado(s) por já existirem` : ""}.`;
      toast("Importação concluída.");
    } catch (err) {
      $("file-status").textContent = err.message;
    }
    e.target.value = "";
  };

  $("backup-export").onclick = () => download(`nexus-backup-${today()}.json`, JSON.stringify(state, null, 2), "application/json");
  $("backup-import").onclick = () => $("backup-file").click();
  $("backup-file").onchange = async e => {
    try {
      const data = normalize(JSON.parse(await e.target.files[0].text()));
      if (!confirm("Substituir os dados atuais pelo backup selecionado?")) { e.target.value = ""; return; }
      state = data;
      hideValues = state.prefs.hideValues;
      save();
      render();
      toast("Backup restaurado.");
    } catch {
      $("file-status").textContent = "Backup inválido.";
    }
    e.target.value = "";
  };

  $("print-report").onclick = () => { buildReport(); window.print(); };

  $("reset-app").onclick = () => {
    if (!confirm("Apagar todos os dados do Nexus Finance? Faça um backup antes.")) return;
    [KEY, LEGACY_KEY, ...OLD_KEYS].forEach(k => localStorage.removeItem(k));
    state = normalize(null);
    hideValues = false;
    save();
    render();
    toast("Dados do aplicativo apagados.");
  };

  /* -------- Instalação como app (PWA) -------- */

  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferredPrompt = e;
    $("install-app").hidden = false;
    $("install-hint").hidden = true;
  });
  $("install-app").addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    $("install-app").hidden = true;
  });
  window.addEventListener("appinstalled", () => {
    $("install-app").hidden = true;
    $("install-hint").hidden = true;
    toast("App instalado.");
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
});
