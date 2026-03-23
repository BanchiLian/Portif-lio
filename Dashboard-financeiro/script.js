// Elementos do DOM
const form = document.getElementById('finance-form');
const transactionList = document.getElementById('transaction-list');
const dateInput = document.getElementById('t-date');
const filterYear = document.getElementById('filter-year');
const filterMonth = document.getElementById('filter-month');
const annualBudgetInput = document.getElementById('annual-budget-input');

// Constante do Orçamento Mensal Máximo
const BASE_BUDGET = 2100.00;

// Configuração Inicial de Data
dateInput.valueAsDate = new Date();
document.getElementById('date').innerText = new Date().toLocaleDateString('pt-BR');

// Estado da Aplicação
let transactions = JSON.parse(localStorage.getItem('nexus_transactions_v2')) || [];
let annualBudget = parseFloat(localStorage.getItem('nexus_annual_budget')) || 25000.00;
annualBudgetInput.value = annualBudget;

let barChart, doughnutChart, mixedChart;

// Eventos
filterYear.addEventListener('change', updateUI);
filterMonth.addEventListener('change', updateUI);
form.addEventListener('submit', addTransaction);

annualBudgetInput.addEventListener('change', (e) => {
    annualBudget = parseFloat(e.target.value) || 0;
    localStorage.setItem('nexus_annual_budget', annualBudget);
    updateUI();
});

function updateLocalStorage() {
    localStorage.setItem('nexus_transactions_v2', JSON.stringify(transactions));
}

function addTransaction(e) {
    e.preventDefault();
    const desc = document.getElementById('desc').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const date = document.getElementById('t-date').value;
    const type = document.getElementById('type').value;
    const category = document.getElementById('category').value;
    const account = document.getElementById('account-select').value;

    transactions.push({ id: Date.now(), desc, amount, date, type, category, account });
    updateLocalStorage();
    updateUI();
    
    document.getElementById('desc').value = '';
    document.getElementById('amount').value = '';
}

function removeTransaction(id) {
    transactions = transactions.filter(t => t.id !== id);
    updateLocalStorage();
    updateUI();
}

function clearData() {
    if(confirm('Tem certeza que deseja apagar todos os dados?')) {
        transactions = [];
        updateLocalStorage();
        updateUI();
    }
}

function updateUI() {
    const sYear = filterYear.value;
    const sMonth = filterMonth.value;

    let filteredTransactions = transactions.filter(t => t.date.substring(0, 4) === sYear);
    if (sMonth !== 'all') {
        filteredTransactions = filteredTransactions.filter(t => t.date.substring(5, 7) === sMonth);
    }

    let income = 0, expense = 0;
    let globalBalance = 0;
    const accounts = { "CAIXXXA": 0, "BUBANK": 0, "WISA": 0 };
    
    let totalPoupanca = 0;
    let totalInvestimentos = 0;

    // LÓGICA DE SALDOS E PATRIMÔNIO (Isolamento de Contas)
    transactions.forEach(t => {
        const isInvestment = (t.category === 'Poupança' || t.category === 'Investimentos');

        if (t.type === 'income') {
            if (!isInvestment) {
                // Entrada normal aumenta o saldo da conta corrente
                globalBalance += t.amount;
                if(accounts[t.account] !== undefined) accounts[t.account] += t.amount;
            }
        } else {
            // Se for saída
            if (t.category === 'Poupança') {
                totalPoupanca += t.amount; // Apenas guarda, não subtrai da conta corrente
            } else if (t.category === 'Investimentos') {
                totalInvestimentos += t.amount; // Apenas guarda, não subtrai da conta corrente
            } else {
                // Gasto comum, diminui da conta corrente
                globalBalance -= t.amount;
                if(accounts[t.account] !== undefined) accounts[t.account] -= t.amount;
            }
        }
    });

    // Impede que poupança e investimentos fiquem negativos visualmente
    totalPoupanca = Math.max(0, totalPoupanca);
    totalInvestimentos = Math.max(0, totalInvestimentos);

    // Entradas e Saídas do Período Filtrado
    filteredTransactions.forEach(t => {
        if (t.type === 'income' && t.category !== 'Poupança' && t.category !== 'Investimentos') income += t.amount;
        if (t.type === 'expense' && t.category !== 'Poupança' && t.category !== 'Investimentos') expense += t.amount;
    });

    // Atualiza Textos
    document.getElementById('total-balance').innerText = `R$ ${globalBalance.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    document.getElementById('total-income').innerText = `R$ ${income.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    document.getElementById('total-expense').innerText = `R$ ${expense.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    document.getElementById('total-poupanca').innerText = `R$ ${totalPoupanca.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    document.getElementById('total-investimentos').innerText = `R$ ${totalInvestimentos.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;

    // LÓGICA DO ORÇAMENTO INTELIGENTE
    const budgetLabel = document.getElementById('budget-label');
    const budgetLeft = document.getElementById('budget-left');
    const budgetSub = document.getElementById('budget-sub');
    const annualConfig = document.getElementById('annual-budget-config');

    if (sMonth === 'all') {
        // MODO ANUAL
        annualConfig.style.display = "flex";
        budgetLabel.innerText = "Orçamento Anual Restante";
        
        let totalYearExpenses = 0;
        transactions.forEach(t => {
            if(t.date.substring(0, 4) === sYear && t.type === 'expense' && t.category !== 'Poupança' && t.category !== 'Investimentos'){
                totalYearExpenses += t.amount;
            }
        });
        
        const left = annualBudget - totalYearExpenses;
        budgetLeft.innerText = `R$ ${left.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        budgetLeft.style.color = left >= 0 ? "#fff" : "var(--accent-red)";
        budgetSub.innerText = `Gasto Total: R$ ${totalYearExpenses.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    } else {
        // MODO MENSAL
        annualConfig.style.display = "none";
        budgetLabel.innerText = "Limite Mensal Disponível";
        const monthNum = parseInt(sMonth);
        
        // Verifica se estourou em meses anteriores
        let accumulatedOverspend = 0;
        
        for (let m = 1; m < monthNum; m++) {
            let mExp = 0;
            transactions.forEach(t => {
                const tYear = t.date.substring(0, 4);
                const tMonth = parseInt(t.date.substring(5, 7));
                if (tYear === sYear && tMonth === m && t.type === 'expense' && t.category !== 'Poupança' && t.category !== 'Investimentos') {
                    mExp += t.amount;
                }
            });
            // Se gastou MAIS que a base, acumula a dívida. Se gastou menos, NÃO rola o limite (Fica zero).
            if (mExp > BASE_BUDGET) {
                accumulatedOverspend += (mExp - BASE_BUDGET);
            }
        }

        // O teto deste mês é o base (2100) MENOS o que você estourou nos passados. O Máximo é sempre 2100.
        const currentMonthLimit = BASE_BUDGET - accumulatedOverspend;

        const leftThisMonth = currentMonthLimit - expense;
        budgetLeft.innerText = `R$ ${leftThisMonth.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        budgetLeft.style.color = leftThisMonth >= 0 ? "var(--accent-green)" : "var(--accent-red)";
        
        if(accumulatedOverspend > 0) {
            budgetSub.innerText = `Teto Reduzido por Excesso Passado: R$ ${currentMonthLimit.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
            budgetSub.style.color = "var(--accent-red)";
        } else {
            budgetSub.innerText = `Limite Máximo: R$ ${BASE_BUDGET.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
            budgetSub.style.color = "var(--text-muted)";
        }
    }

    // Atualiza Histórico
    transactionList.innerHTML = '';
    const recentTransactions = [...filteredTransactions].reverse().slice(0, 15);
    recentTransactions.forEach(t => {
        const cssClass = t.type === 'income' ? 'income-text' : 'expense-text';
        const sign = t.type === 'income' ? '+' : '-';
        const li = document.createElement('li');
        li.classList.add('item');
        li.innerHTML = `
            <div style="flex:1">
                <strong>${t.desc}</strong> <br>
                <small style="color:#8b92a5">${t.date.split('-').reverse().join('/')} • ${t.category}</small>
            </div>
            <div style="text-align:right">
                <span class="${cssClass}">${sign} R$ ${t.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span> <br>
                <button class="btn-del" onclick="removeTransaction(${t.id})">Apagar</button>
            </div>
        `;
        transactionList.appendChild(li);
    });

    // Atualiza Sidebar Contas
    const accountsList = document.getElementById('accounts-list');
    accountsList.innerHTML = '';
    const colors = ["#00c3ff", "#ff3366", "#ff8a00"];
    Object.keys(accounts).forEach((acc, index) => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${acc}</span><div>R$ ${accounts[acc].toLocaleString('pt-BR', {minimumFractionDigits: 2})} <span class="dot" style="background:${colors[index]}"></span></div>`;
        accountsList.appendChild(li);
    });

    updateCharts(sYear, filteredTransactions);
}

// Configs Globais Chart.js
Chart.defaults.color = '#8b92a5';
Chart.defaults.scale.grid.color = 'rgba(255, 255, 255, 0.05)';

function updateCharts(sYear, filteredTransactions) {
    const incomeByCategory = {};
    const expenseByCategory = {};

    filteredTransactions.forEach(t => {
        if (t.category !== 'Poupança' && t.category !== 'Investimentos') {
            if (t.type === 'income') incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + t.amount;
            else expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + t.amount;
        }
    });

    if(barChart) barChart.destroy();
    barChart = new Chart(document.getElementById('barChart'), {
        type: 'bar',
        data: {
            labels: Object.keys(incomeByCategory).length ? Object.keys(incomeByCategory) : ['Nenhuma'],
            datasets: [{ data: Object.keys(incomeByCategory).length ? Object.values(incomeByCategory) : [0], backgroundColor: '#00c3ff', borderRadius: 4 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: {display: false} } }
    });

    if(doughnutChart) doughnutChart.destroy();
    doughnutChart = new Chart(document.getElementById('doughnutChart'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(expenseByCategory).length ? Object.keys(expenseByCategory) : ['Nenhuma'],
            datasets: [{ data: Object.keys(expenseByCategory).length ? Object.values(expenseByCategory) : [1], backgroundColor: ['#ff3366', '#ff8a00', '#00c3ff', '#9d00ff', '#f1f1f1'], borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right' } } }
    });

    const monthlyData = { labels: ["01","02","03","04","05","06","07","08","09","10","11","12"], income: Array(12).fill(0), expense: Array(12).fill(0) };
    
    transactions.forEach(t => {
        if(t.date.substring(0, 4) === sYear && t.category !== 'Poupança' && t.category !== 'Investimentos') {
            const mIndex = parseInt(t.date.substring(5, 7)) - 1;
            if(t.type === 'income') monthlyData.income[mIndex] += t.amount;
            else monthlyData.expense[mIndex] += t.amount;
        }
    });

    if(mixedChart) mixedChart.destroy();
    mixedChart = new Chart(document.getElementById('mixedChart'), {
        type: 'bar',
        data: {
            labels: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'],
            datasets: [
                { type: 'line', label: 'Despesas', data: monthlyData.expense, borderColor: '#ff3366', borderWidth: 2, fill: false, tension: 0.4 },
                { type: 'bar', label: 'Entradas', data: monthlyData.income, backgroundColor: '#00c3ff', borderRadius: 4 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// Inicializa
updateUI();