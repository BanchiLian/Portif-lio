// --- DEFAULTS ---
const defBudgets = [
    { id: 'b1', name: 'Alimentação', limit: 400, kws: ['ifood', 'restaurante', 'lanche', 'pizza', 'mercado'] },
    { id: 'b2', name: 'Transporte', limit: 1500, kws: ['moto', 'carro', 'gasolina', 'uber'] },
    { id: 'b3', name: 'Lazer', limit: 300, kws: ['futvlei', 'futebol', 'jogo', 'pc', 'ps5'] },
    { id: 'b4', name: 'Moradia', limit: 300, kws: ['conta', 'luz', 'agua', 'aluguel'] }
];
const defGoals = [
    { id: 'g1', name: 'Poupança', target: 10000 },
    { id: 'g2', name: 'Ações / FIIs', target: 250000 }
];
const defAccounts = ["CAIXXXA", "BUBANK", "WISA"];

// --- DB (LOCAL STORAGE) ---
let trans = JSON.parse(localStorage.getItem('nxs_trans')) || [];
let budgets = JSON.parse(localStorage.getItem('nxs_budgets')) || defBudgets;
let goals = JSON.parse(localStorage.getItem('nxs_goals')) || defGoals;
let accounts = JSON.parse(localStorage.getItem('nxs_accounts')) || defAccounts;
let checklist = JSON.parse(localStorage.getItem('nxs_check')) || [];

// --- STATE ---
let isHidden = false;
let currentView = { mode: 'month', year: new Date().getFullYear().toString(), month: (new Date().getMonth()+1).toString().padStart(2,'0') };
let pendingTx = null;

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    initFilters();
    populateSelects();
    refreshApp();
});

// --- NAVIGATION & MOBILE MENU ---
function toggleMenu() {
    document.querySelector('.sidebar').classList.toggle('active');
    document.querySelector('.sidebar-overlay').classList.toggle('active');
}

function navTo(secId) {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
    document.getElementById(`sec-${secId}`).classList.add('active');
    event.currentTarget.classList.add('active');
    
    // Se estiver no celular, fecha o menu ao clicar num link
    if(window.innerWidth <= 768) {
        document.querySelector('.sidebar').classList.remove('active');
        document.querySelector('.sidebar-overlay').classList.remove('active');
    }
}
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function toggleEye() { isHidden = !isHidden; refreshApp(); }
function formatCur(val) { return isHidden ? "R$ ••••••" : `R$ ${val.toLocaleString('pt-BR',{minimumFractionDigits:2})}`; }

// --- FILTERS LOGIC ---
function initFilters() {
    const ySel = document.getElementById('filter-year');
    const y = new Date().getFullYear();
    ySel.innerHTML = `<option value="${y}">${y}</option><option value="${y-1}">${y-1}</option>`;
    
    document.getElementById('view-mode').value = currentView.mode;
    document.getElementById('filter-year').value = currentView.year;
    document.getElementById('filter-month').value = currentView.month;
}
function updateFilters() {
    currentView.mode = document.getElementById('view-mode').value;
    document.getElementById('filter-year').style.display = currentView.mode === 'all' ? 'none' : 'block';
    document.getElementById('filter-month').style.display = currentView.mode === 'month' ? 'block' : 'none';
    refreshApp();
}

// --- POPULATE FORMS ---
function populateSelects() {
    const accHtml = accounts.map(a => `<option value="${a}">${a}</option>`).join('');
    document.getElementById('t-account').innerHTML = accHtml;
    document.getElementById('pay-account').innerHTML = accHtml;
    
    const catHtml = `
        <optgroup label="Orçamentos">${budgets.map(b => `<option value="${b.name}">${b.name}</option>`).join('')}</optgroup>
        <optgroup label="Metas">${goals.map(g => `<option value="${g.name}">${g.name}</option>`).join('')}</optgroup>
        <option value="Outros">Outros</option>
    `;
    document.getElementById('t-category').innerHTML = catHtml;
    document.getElementById('c-category').innerHTML = catHtml;

    document.getElementById('settings-accounts-list').innerHTML = accounts.map(a => `
        <li><span>${a}</span> <button class="btn-del" onclick="delAccount('${a}')"><i class="fa-solid fa-trash"></i></button></li>
    `).join('');
}

// --- SMART CATEGORIZATION ---
document.getElementById('t-desc').addEventListener('input', (e) => {
    const text = e.target.value.toLowerCase();
    for (let b of budgets) {
        if (b.kws && b.kws.some(k => text.includes(k))) {
            document.getElementById('t-type').value = 'expense';
            document.getElementById('t-category').value = b.name;
            return;
        }
    }
});

// --- CORE: ADD TRANSACTION & OVERSPEND ---
document.getElementById('form-transaction').addEventListener('submit', (e) => {
    e.preventDefault();
    const tx = {
        id: Date.now(),
        desc: document.getElementById('t-desc').value,
        amount: parseFloat(document.getElementById('t-amount').value),
        date: document.getElementById('t-date').value,
        type: document.getElementById('t-type').value,
        category: document.getElementById('t-category').value,
        account: document.getElementById('t-account').value
    };

    const txMonth = tx.date.substring(0, 7);
    const currStr = `${currentView.year}-${currentView.month}`;
    if (tx.type === 'expense' && txMonth === currStr) {
        const bdg = budgets.find(b => b.name === tx.category);
        if (bdg) {
            const spent = trans.filter(t => t.type==='expense' && t.category===tx.category && t.date.startsWith(currStr)).reduce((s, t) => s+t.amount, 0);
            if (spent + tx.amount > bdg.limit) {
                pendingTx = tx;
                document.getElementById('j-category-name').innerText = bdg.name;
                closeModal('modal-transaction');
                openModal('modal-justification');
                return;
            }
        }
    }
    commitTx(tx);
});

document.getElementById('form-justification').addEventListener('submit', (e) => {
    e.preventDefault();
    pendingTx.justification = document.getElementById('j-reason').value;
    commitTx(pendingTx);
    closeModal('modal-justification');
});
function cancelJustification() { pendingTx = null; closeModal('modal-justification'); }

function commitTx(tx) {
    trans.push(tx);
    localStorage.setItem('nxs_trans', JSON.stringify(trans));
    document.getElementById('form-transaction').reset();
    document.getElementById('t-date').valueAsDate = new Date();
    document.getElementById('j-reason').value = '';
    closeModal('modal-transaction');
    refreshApp();
}

// --- CHECKLIST LOGIC ---
document.getElementById('form-checklist').addEventListener('submit', (e) => {
    e.preventDefault();
    checklist.push({
        id: 'c'+Date.now(),
        name: document.getElementById('c-name').value,
        amount: parseFloat(document.getElementById('c-amount').value),
        day: parseInt(document.getElementById('c-day').value),
        category: document.getElementById('c-category').value,
        payments: {}
    });
    localStorage.setItem('nxs_check', JSON.stringify(checklist));
    e.target.reset(); closeModal('modal-checklist'); refreshApp();
});

function openPayCheck(id) {
    const item = checklist.find(c => c.id === id);
    document.getElementById('pay-id').value = item.id;
    document.getElementById('pay-name').innerText = item.name;
    document.getElementById('pay-amount').value = item.amount;
    document.getElementById('pay-date').valueAsDate = new Date();
    openModal('modal-pay-check');
}

document.getElementById('form-pay-check').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('pay-id').value;
    const item = checklist.find(c => c.id === id);
    const date = document.getElementById('pay-date').value;
    const period = date.substring(0, 7); 
    
    item.payments[period] = date;
    localStorage.setItem('nxs_check', JSON.stringify(checklist));
    
    commitTx({
        id: Date.now(), desc: item.name, amount: parseFloat(document.getElementById('pay-amount').value),
        date: date, type: 'expense', category: item.category, account: document.getElementById('pay-account').value
    });
    closeModal('modal-pay-check');
});

function delCheck(id) { checklist = checklist.filter(c => c.id !== id); localStorage.setItem('nxs_check', JSON.stringify(checklist)); refreshApp(); }

// --- BUDGET & GOAL FORMS ---
document.getElementById('form-budget').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('b-name').value;
    const limit = parseFloat(document.getElementById('b-limit').value);
    const kwsStr = document.getElementById('b-keywords').value;
    const kws = kwsStr ? kwsStr.split(',').map(k => k.trim().toLowerCase()) : [];
    budgets.push({ id: 'b'+Date.now(), name, limit, kws });
    localStorage.setItem('nxs_budgets', JSON.stringify(budgets));
    e.target.reset(); closeModal('modal-budget'); populateSelects(); refreshApp();
});

document.getElementById('form-goal').addEventListener('submit', (e) => {
    e.preventDefault();
    goals.push({ id: 'g'+Date.now(), name: document.getElementById('g-name').value, target: parseFloat(document.getElementById('g-target').value) });
    localStorage.setItem('nxs_goals', JSON.stringify(goals));
    e.target.reset(); closeModal('modal-goal'); populateSelects(); refreshApp();
});

// --- SETTINGS FORMS ---
document.getElementById('form-account').addEventListener('submit', (e) => {
    e.preventDefault(); accounts.push(document.getElementById('cfg-account-name').value);
    localStorage.setItem('nxs_accounts', JSON.stringify(accounts));
    e.target.reset(); populateSelects(); refreshApp();
});
function delAccount(name) { accounts = accounts.filter(a => a !== name); localStorage.setItem('nxs_accounts', JSON.stringify(accounts)); populateSelects(); refreshApp(); }
function hardReset() { if(confirm('Apagar TUDO?')){ localStorage.clear(); location.reload(); } }
function delTrans(id) { trans = trans.filter(t => t.id !== id); localStorage.setItem('nxs_trans', JSON.stringify(trans)); refreshApp(); }

// --- RENDER APPLICATION ---
function refreshApp() {
    currentView.mode = document.getElementById('view-mode').value;
    currentView.year = document.getElementById('filter-year').value;
    currentView.month = document.getElementById('filter-month').value;
    
    const periodStr = `${currentView.year}-${currentView.month}`;

    let viewTrans = trans;
    if (currentView.mode === 'year') viewTrans = trans.filter(t => t.date.startsWith(currentView.year));
    else if (currentView.mode === 'month') viewTrans = trans.filter(t => t.date.startsWith(periodStr));

    let globalBalance = 0;
    const accBals = {}; accounts.forEach(a => accBals[a] = 0);
    const goalSaved = {}; goals.forEach(g => goalSaved[g.name] = 0);

    trans.forEach(t => {
        if(t.type === 'income') {
            globalBalance += t.amount;
            if(accBals[t.account]!==undefined) accBals[t.account] += t.amount;
        } else if(t.type === 'expense') {
            globalBalance -= t.amount;
            if(accBals[t.account]!==undefined) accBals[t.account] -= t.amount;
        } else {
            globalBalance -= t.amount;
            if(accBals[t.account]!==undefined) accBals[t.account] -= t.amount;
            if(goalSaved[t.category]!==undefined) goalSaved[t.category] += t.amount;
        }
    });

    document.getElementById('main-balance').innerText = formatCur(globalBalance);

    const alertsBox = document.getElementById('alerts-container');
    alertsBox.innerHTML = '';
    if(currentView.mode === 'month') {
        const over = trans.filter(t => t.date.startsWith(periodStr) && t.justification);
        alertsBox.innerHTML = over.map(t => `<div class="alert-banner"><h4>⚠️ ${t.category} Excedido</h4><p>"${t.justification}"</p></div>`).join('');
    }

    document.getElementById('accounts-rail').innerHTML = accounts.map(a => `<div class="account-card"><h3>${a}</h3><div class="val">${formatCur(accBals[a])}</div></div>`).join('');

    if(currentView.mode !== 'month') {
        document.getElementById('checklist-grid').innerHTML = "<p style='color:#666'>Selecione a Visão Mensal para gerenciar o checklist.</p>";
    } else {
        document.getElementById('checklist-grid').innerHTML = checklist.map(c => {
            const isPaid = c.payments && c.payments[periodStr];
            return `
            <div class="check-item">
                <button class="check-btn ${isPaid ? 'paid' : ''}" onclick="${isPaid ? '' : `openPayCheck('${c.id}')`}"><i class="fa-solid ${isPaid ? 'fa-circle-check' : 'fa-circle'}"></i></button>
                <div class="check-info"><strong>${c.name}</strong><small>Vence dia ${c.day} • ${formatCur(c.amount)}</small></div>
                <div class="check-actions">
                    ${isPaid ? `<small style="color:var(--green-money)">Pago: ${c.payments[periodStr].split('-').reverse().join('/')}</small>` : ''}
                    <button onclick="delCheck('${c.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>`;
        }).join('');
    }

    document.getElementById('budgets-grid').innerHTML = budgets.map(b => {
        let spent = viewTrans.filter(t => t.type === 'expense' && t.category === b.name).reduce((s,t) => s+t.amount, 0);
        let limit = currentView.mode === 'year' ? b.limit * 12 : b.limit;
        const perc = Math.min((spent/limit)*100, 100);
        return `
            <div class="budget-card">
                <div class="card-top"><span class="card-title">${b.name}</span><span class="card-val">R$ ${spent.toFixed(0)}</span></div>
                <div class="progress-bg"><div class="progress-fill ${perc<80?'safe':''}" style="width:${perc}%"></div></div>
                <div class="card-bot"><span>Usado</span><span>Teto: R$ ${limit}</span></div>
            </div>`;
    }).join('');

    document.getElementById('goals-grid').innerHTML = goals.map(g => {
        const saved = goalSaved[g.name];
        const perc = Math.min((saved/g.target)*100, 100);
        return `
            <div class="goal-card">
                <div class="card-top"><span class="card-title">${g.name}</span><span class="card-val">${formatCur(saved)}</span></div>
                <div class="progress-bg"><div class="progress-fill" style="width:${perc}%; background:var(--blue-invest)"></div></div>
                <div class="card-bot"><span>${perc.toFixed(1)}%</span><span>Meta: R$ ${g.target.toLocaleString()}</span></div>
            </div>`;
    }).join('');

    document.getElementById('history-tbody').innerHTML = [...viewTrans].reverse().map(t => {
        let cls = t.type==='income'?'val-income':(t.type==='expense'?'val-expense':'val-transfer');
        return `<tr><td style="white-space:nowrap">${t.date.split('-').reverse().join('/')}</td><td><strong>${t.desc}</strong><br><small style="color:#666">${t.justification?'⚠️ '+t.justification:''}</small></td><td>${t.category}</td><td>${t.account}</td><td class="${cls}" style="white-space:nowrap">R$ ${t.amount.toFixed(2)}</td><td><button class="btn-del" onclick="delTrans(${t.id})"><i class="fa-solid fa-trash"></i></button></td></tr>`;
    }).join('');

    renderCharts(viewTrans, globalBalance, goalSaved);
}

// --- CHARTS ---
let chartEvol, chartPat, chartDesp;
Chart.defaults.color = '#808080';

function renderCharts(viewTrans, globalBalance, goalSaved) {
    if(chartEvol) chartEvol.destroy();
    let labels=[], dInc=[], dExp=[], dBal=[];
    
    if(currentView.mode === 'month') {
        const days = new Date(currentView.year, currentView.month, 0).getDate();
        for(let i=1; i<=days; i++) labels.push(i);
        dInc = Array(days).fill(0); dExp = Array(days).fill(0); dBal = Array(days).fill(0);
        viewTrans.forEach(t => {
            const day = parseInt(t.date.substring(8,10)) - 1;
            if(t.type==='income') dInc[day] += t.amount;
            else if(t.type==='expense') dExp[day] += t.amount;
        });
        let run = 0;
        for(let i=0; i<days; i++) { run += dInc[i] - dExp[i]; dBal[i] = run; }
        document.getElementById('chart-title-main').innerText = "Fluxo de Caixa Diário";
    } else {
        labels = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        dInc = Array(12).fill(0); dExp = Array(12).fill(0); dBal = Array(12).fill(0);
        viewTrans.forEach(t => {
            const mIndex = parseInt(t.date.substring(5,7)) - 1;
            if(t.type==='income') dInc[mIndex] += t.amount;
            else if(t.type==='expense') dExp[mIndex] += t.amount;
        });
        let run = 0;
        for(let i=0; i<12; i++) { run += dInc[i] - dExp[i]; dBal[i] = run; }
        document.getElementById('chart-title-main').innerText = "Evolução Mensal";
    }

    chartEvol = new Chart(document.getElementById('evolucaoChart'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { type: 'line', label: 'Saldo Gerado', data: dBal, borderColor: '#fff', tension: 0.4 },
                { type: 'bar', label: 'Entradas', data: dInc, backgroundColor: '#46d369', borderRadius:4 },
                { type: 'bar', label: 'Saídas', data: dExp, backgroundColor: '#E50914', borderRadius:4 }
            ]
        },
        options: { responsive:true, maintainAspectRatio:false, scales: { x:{grid:{display:false}} } }
    });

    if(chartPat) chartPat.destroy();
    const patLabels = ['Conta Livre'], patData = [globalBalance], patColors = ['#0071eb'];
    goals.forEach(g => { patLabels.push(g.name); patData.push(goalSaved[g.name]||0); patColors.push(g.name==='Poupança'?'#46d369':'#E50914'); });
    chartPat = new Chart(document.getElementById('patrimonioChart'), {
        type: 'doughnut',
        data: { labels: patLabels, datasets: [{ data: patData, backgroundColor: patColors, borderWidth:0 }] },
        options: { responsive:true, maintainAspectRatio:false, cutout:'70%', plugins:{legend:{position:'right'}} }
    });

    if(chartDesp) chartDesp.destroy();
    const despMap = {};
    viewTrans.filter(t => t.type==='expense').forEach(t => despMap[t.category] = (despMap[t.category]||0) + t.amount);
    chartDesp = new Chart(document.getElementById('despesasChart'), {
        type: 'bar',
        data: { labels: Object.keys(despMap).length?Object.keys(despMap):['Vazio'], datasets: [{ data: Object.keys(despMap).length?Object.values(despMap):[0], backgroundColor: '#E50914', borderRadius: 4 }] },
        options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}}} }
    });
}