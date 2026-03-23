const form = document.getElementById('finance-form');
const transactionList = document.getElementById('transaction-list');
const totalBalance = document.getElementById('total-balance');
const totalIncome = document.getElementById('total-income');
const totalExpense = document.getElementById('total-expense');

// Carrega do LocalStorage ou inicia vazio
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];

function updateLocalStorage() {
    localStorage.setItem('transactions', JSON.stringify(transactions));
}

function addTransaction(e) {
    e.preventDefault();
    const desc = document.getElementById('desc').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const type = document.getElementById('type').value;

    const transaction = {
        id: Math.floor(Math.random() * 100000),
        desc,
        amount,
        type
    };

    transactions.push(transaction);
    init();
    form.reset();
}

function removeTransaction(id) {
    transactions = transactions.filter(t => t.id !== id);
    init();
}

function updateValues() {
    const income = transactions
        .filter(t => t.type === 'income')
        .reduce((acc, t) => acc + t.amount, 0);
    
    const expense = transactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => acc + t.amount, 0);

    const total = income - expense;

    totalIncome.innerHTML = `R$ ${income.toLocaleString('pt-BR')}`;
    totalExpense.innerHTML = `R$ ${expense.toLocaleString('pt-BR')}`;
    totalBalance.innerHTML = `R$ ${total.toLocaleString('pt-BR')}`;
    
    updateChart(income, expense);
}

function updateUI() {
    transactionList.innerHTML = '';
    transactions.forEach(t => {
        const cssClass = t.type === 'income' ? 'income-text' : 'expense-text';
        const li = document.createElement('li');
        li.classList.add('item');
        li.innerHTML = `
            <span>${t.desc}</span>
            <span class="${cssClass}">R$ ${t.amount.toFixed(2)}</span>
            <button onclick="removeTransaction(${t.id})">x</button>
        `;
        transactionList.appendChild(li);
    });
}

// Gráfico Moderno
let ctx = document.getElementById('financeChart').getContext('2d');
let myChart;

function updateChart(inc, exp) {
    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Entradas', 'Saídas'],
            datasets: [{
                data: [inc, exp],
                backgroundColor: ['#00f2ff', '#7000ff'],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            plugins: { legend: { labels: { color: '#fff' } } }
        }
    });
}

function init() {
    updateUI();
    updateValues();
    updateLocalStorage();
}

// Data atual
document.getElementById('date').innerText = new Date().toLocaleDateString('pt-BR');

form.addEventListener('submit', addTransaction);
init();