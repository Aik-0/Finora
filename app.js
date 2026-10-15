
"use strict";

/* =====================================
   FINORA — PERSONAL FINANCE DASHBOARD
   ===================================== */

const TRANSACTIONS_KEY = "finora_transactions_v1";
const THEME_KEY = "finora_theme_v1";
const BUDGET_KEY = "finora_monthly_budget_v1";

const CHART_COLORS = [
    "#15966b",
    "#68cda2",
    "#e5a14b",
    "#6488e5",
    "#d96c9d",
    "#8b79d9",
    "#4da7bd",
    "#e17458",
    "#9aa69e"
];

let transactions = loadTransactions();
let expenseChart = null;
let toastTimer = null;

/* ---------- BASIC HELPERS ---------- */

function $(id) {
    return document.getElementById(id);
}

function getLocalDate() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatMoney(amount) {
    const value = Number(amount);

    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "SAR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(dateString) {
    const parts = String(dateString).split("-");

    if (parts.length !== 3) {
        return dateString;
    }

    const date = new Date(
        Number(parts[0]),
        Number(parts[1]) - 1,
        Number(parts[2])
    );

    if (Number.isNaN(date.getTime())) {
        return dateString;
    }

    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    }).format(date);
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
}

function showToast(message) {
    const toast = $("toast");

    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2800);
}

/* ---------- LOCAL STORAGE ---------- */

function loadTransactions() {
    try {
        const stored = localStorage.getItem(TRANSACTIONS_KEY);

        if (!stored) return [];

        const parsed = JSON.parse(stored);

        if (!Array.isArray(parsed)) return [];

        return parsed.filter(item => {
            return (
                item &&
                typeof item.id === "string" &&
                typeof item.title === "string" &&
                Number.isFinite(item.amount) &&
                item.amount > 0 &&
                ["income", "expense"].includes(item.type) &&
                typeof item.category === "string" &&
                typeof item.date === "string" &&
                /^\d{4}-\d{2}-\d{2}$/.test(item.date)
            );
        });
    } catch (error) {
        console.error("Could not load transactions:", error);
        return [];
    }
}

function saveTransactions() {
    try {
        localStorage.setItem(
            TRANSACTIONS_KEY,
            JSON.stringify(transactions)
        );

        return true;
    } catch (error) {
        console.error("Could not save transactions:", error);
        showToast("Could not save data in this browser.");
        return false;
    }
}

/* ---------- TRANSACTION CALCULATIONS ---------- */

function getTotals(items = transactions) {
    const income = items
        .filter(item => item.type === "income")
        .reduce((sum, item) => sum + item.amount, 0);

    const expenses = items
        .filter(item => item.type === "expense")
        .reduce((sum, item) => sum + item.amount, 0);

    const balance = income - expenses;

    const savingsRate = income > 0
        ? (balance / income) * 100
        : 0;

    return {
        income,
        expenses,
        balance,
        savingsRate
    };
}

function getMonthlyTransactions() {
    const currentMonth = getLocalDate().slice(0, 7);

    return transactions.filter(item => {
        return item.date.startsWith(currentMonth);
    });
}

function getMonthlyStats() {
    const items = getMonthlyTransactions();

    const income = items
        .filter(item => item.type === "income")
        .reduce((sum, item) => sum + item.amount, 0);

    const expensesOnly = items.filter(item => {
        return item.type === "expense";
    });

    const expenses = expensesOnly.reduce((sum, item) => {
        return sum + item.amount;
    }, 0);

    const categories = {};

    expensesOnly.forEach(item => {
        categories[item.category] =
            (categories[item.category] || 0) + item.amount;
    });

    const largestCategory = Object.entries(categories)
        .sort((a, b) => b[1] - a[1])[0] || null;

    return {
        income,
        expenses,
        largestCategory,
        transactionCount: items.length
    };
}

/* ---------- DASHBOARD SUMMARY ---------- */

function renderSummary() {
    const totals = getTotals();

    $("total-balance").textContent = formatMoney(totals.balance);
    $("total-income").textContent = formatMoney(totals.income);
    $("total-expenses").textContent = formatMoney(totals.expenses);

    $("savings-rate").textContent =
        `${totals.savingsRate.toFixed(1)}%`;

    $("total-balance").style.color =
        totals.balance < 0 ? "var(--red)" : "var(--text)";
}

/* ---------- TRANSACTION TABLE ---------- */

function getCategoryIcon(category) {
    const icons = {
        Food: "♧",
        Shopping: "◇",
        Transport: "↗",
        Bills: "▤",
        Health: "✚",
        Education: "▣",
        Entertainment: "♫",
        Salary: "↙",
        Other: "◈"
    };

    return icons[category] || "◈";
}

function renderTransactions() {
    const tbody = $("transactions-body");
    const emptyState = $("transactions-empty");
    const filter = $("transaction-filter").value;

    const filteredTransactions = [...transactions]
        .filter(item => {
            return filter === "all" || item.type === filter;
        })
        .sort((a, b) => {
            const dateComparison = b.date.localeCompare(a.date);

            if (dateComparison !== 0) {
                return dateComparison;
            }

            return b.id.localeCompare(a.id);
        });

    tbody.replaceChildren();

    filteredTransactions.forEach(item => {
        const row = document.createElement("tr");

        const amountClass = item.type === "income"
            ? "amount-income"
            : "amount-expense";

        const amountPrefix = item.type === "income" ? "+" : "−";

        const typeLabel = item.type === "income"
            ? "Income"
            : "Expense";

        row.innerHTML = `
            <td>
                <div class="transaction-name">
                    <span class="transaction-icon">
                        ${escapeHTML(getCategoryIcon(item.category))}
                    </span>
                    <div>
                        <div class="transaction-title">
                            ${escapeHTML(item.title)}
                        </div>
                        <div class="transaction-subtitle">
                            Personal transaction
                        </div>
                    </div>
                </div>
            </td>

            <td>
                <span class="category-text">
                    ${escapeHTML(item.category)}
                </span>
            </td>

            <td>
                <span class="date-text">
                    ${escapeHTML(formatDate(item.date))}
                </span>
            </td>

            <td>
                <span class="type-badge ${item.type}">
                    ${typeLabel}
                </span>
            </td>

            <td class="${amountClass}">
                ${amountPrefix}${formatMoney(item.amount)}
            </td>

            <td>
                <button
                    type="button"
                    class="delete-button"
                    data-delete-id="${escapeHTML(item.id)}"
                    aria-label="Delete ${escapeHTML(item.title)}"
                >
                    Delete
                </button>
            </td>
        `;

        tbody.appendChild(row);
    });

    const hasTransactions = filteredTransactions.length > 0;

    emptyState.classList.toggle("visible", !hasTransactions);
    tbody.parentElement.classList.toggle("has-no-transactions", !hasTransactions);

    $("transaction-count").textContent =
        `${filteredTransactions.length} transaction${filteredTransactions.length === 1 ? "" : "s"}`;

    $("clear-transactions").disabled = transactions.length === 0;

    renderChart();
}

/* ---------- EXPENSE CHART ---------- */

function renderChart() {
    const canvas = $("expense-chart");
    const empty = $("chart-empty");
    const legend = $("chart-legend");

    const expenses = transactions.filter(item => {
        return item.type === "expense";
    });

    const categories = {};

    expenses.forEach(item => {
        categories[item.category] =
            (categories[item.category] || 0) + item.amount;
    });

    const labels = Object.keys(categories);
    const values = Object.values(categories);

    if (expenseChart) {
        expenseChart.destroy();
        expenseChart = null;
    }

    legend.replaceChildren();

    const hasExpenses = values.length > 0;

    empty.classList.toggle("hidden", hasExpenses);
    canvas.style.visibility = hasExpenses ? "visible" : "hidden";

    if (!hasExpenses || typeof Chart === "undefined") {
        if (hasExpenses && typeof Chart === "undefined") {
            empty.classList.remove("hidden");
            empty.querySelector("p").textContent =
                "Chart library unavailable. Check your internet connection.";
        }

        return;
    }

    expenseChart = new Chart(canvas, {
        type: "doughnut",

        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: labels.map((_, index) => {
                    return CHART_COLORS[index % CHART_COLORS.length];
                }),
                borderWidth: 0,
                hoverOffset: 6
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "72%",

            plugins: {
                legend: {
                    display: false
                },

                tooltip: {
                    callbacks: {
                        label(context) {
                            return `${context.label}: ${formatMoney(context.raw)}`;
                        }
                    }
                }
            }
        }
    });

    labels.forEach((label, index) => {
        const item = document.createElement("div");
        item.className = "legend-item";

        const dot = document.createElement("span");
        dot.className = "legend-dot";
        dot.style.background =
            CHART_COLORS[index % CHART_COLORS.length];

        const text = document.createElement("span");
        text.textContent = `${label} · ${formatMoney(values[index])}`;

        item.append(dot, text);
        legend.appendChild(item);
    });
}

/* ---------- MONTHLY BUDGET ---------- */

function getSavedBudget() {
    try {
        const rawValue = localStorage.getItem(BUDGET_KEY);

        if (rawValue === null) return 0;

        const value = Number(rawValue);

        return Number.isFinite(value) && value > 0
            ? value
            : 0;
    } catch (error) {
        console.error("Could not load budget:", error);
        return 0;
    }
}

function saveBudget(value) {
    try {
        localStorage.setItem(BUDGET_KEY, String(value));
        return true;
    } catch (error) {
        console.error("Could not save budget:", error);
        showToast("Could not save your budget in this browser.");
        return false;
    }
}

function renderBudgetAndAI() {
    const budgetInput = $("budget-amount");
    const spentElement = $("budget-spent");
    const remainingElement = $("budget-remaining");
    const progressElement = $("budget-progress");
    const progressTrack = $("budget-progress-track");
    const statusElement = $("budget-status");
    const adviceList = $("ai-advice-list");

    if (
        !budgetInput ||
        !spentElement ||
        !remainingElement ||
        !progressElement ||
        !progressTrack ||
        !statusElement ||
        !adviceList
    ) {
        return;
    }

    const budget = getSavedBudget();
    const stats = getMonthlyStats();
    const remaining = budget - stats.expenses;

    const usage = budget > 0
        ? (stats.expenses / budget) * 100
        : 0;

    // Keep the input in sync without overwriting an active edit.
    if (document.activeElement !== budgetInput) {
        budgetInput.value = budget > 0 ? String(budget) : "";
    }

    spentElement.textContent = formatMoney(stats.expenses);

    remainingElement.textContent = budget > 0
        ? formatMoney(remaining)
        : "Set a budget";

    progressElement.style.width =
        `${Math.min(100, Math.max(0, usage))}%`;

    progressElement.classList.toggle(
        "budget-over",
        budget > 0 && stats.expenses > budget
    );

    progressTrack.setAttribute(
        "aria-valuenow",
        String(Math.min(100, Math.max(0, usage)))
    );

    if (budget <= 0) {
        statusElement.textContent =
            "Set a budget to start tracking your spending.";
    } else if (remaining < 0) {
        statusElement.textContent =
            `You exceeded your budget by ${formatMoney(Math.abs(remaining))}.`;
    } else {
        statusElement.textContent =
            `${usage.toFixed(1)}% of your monthly budget used.`;
    }

    renderFinancialAdvice(stats, budget, adviceList);
}

/* ---------- SMART FINANCIAL INSIGHTS ---------- */

function getFinancialAdvice(stats, budget) {
    const advice = [];

    if (stats.transactionCount === 0) {
        return [{
            title: "Start tracking your money",
            message:
                "Add your income and expenses to receive insights based on your financial activity.",
            icon: "✦"
        }];
    }

    if (budget <= 0) {
        advice.push({
            title: "Set a monthly budget",
            message:
                "Choose a spending limit to help monitor your expenses throughout the month.",
            icon: "◎"
        });
    } else {
        const usage = (stats.expenses / budget) * 100;

        if (stats.expenses > budget) {
            advice.push({
                title: "Budget exceeded",
                message:
                    `Your expenses are ${formatMoney(stats.expenses - budget)} above your monthly budget. Review your upcoming spending.`,
                icon: "!"
            });
        } else if (usage >= 80) {
            advice.push({
                title: "You're close to your limit",
                message:
                    `You have used ${usage.toFixed(0)}% of your budget. Consider reducing non-essential expenses.`,
                icon: "◷"
            });
        } else {
            advice.push({
                title: "Budget check",
                message:
                    `You have ${formatMoney(budget - stats.expenses)} left in your monthly budget.`,
                icon: "✓"
            });
        }
    }

    if (stats.largestCategory) {
        const [category, amount] = stats.largestCategory;

        advice.push({
            title: "Your biggest spending category",
            message:
                `${category} is your highest expense category this month, at ${formatMoney(amount)}.`,
            icon: "◈"
        });
    }

    if (stats.income > 0) {
        const difference = stats.income - stats.expenses;

        if (difference > 0) {
            advice.push({
                title: "Think about your savings",
                message:
                    `Your recorded income is higher than your expenses by ${formatMoney(difference)} this month. Consider setting some money aside for future goals.`,
                icon: "✧"
            });
        } else if (difference < 0) {
            advice.push({
                title: "Review your spending",
                message:
                    "Your recorded expenses exceed your income this month. Review your budget and prioritize essential costs.",
                icon: "↘"
            });
        }
    } else if (stats.expenses > 0) {
        advice.push({
            title: "Record your income",
            message:
                "You have recorded expenses but no income this month. Add your income for a clearer financial picture.",
            icon: "↗"
        });
    }

    return advice.slice(0, 3);
}

function renderFinancialAdvice(stats, budget, adviceList) {
    const advice = getFinancialAdvice(stats, budget);

    adviceList.replaceChildren();

    advice.forEach(item => {
        const card = document.createElement("article");
        card.className = "ai-advice-card";

        const icon = document.createElement("span");
        icon.className = "ai-advice-icon";
        icon.textContent = item.icon;

        const content = document.createElement("div");

        const title = document.createElement("h3");
        title.textContent = item.title;

        const message = document.createElement("p");
        message.textContent = item.message;

        content.append(title, message);
        card.append(icon, content);

        adviceList.appendChild(card);
    });
}

/* ---------- THEME ---------- */

function applyTheme(theme) {
    const isDark = theme === "dark";

    document.body.classList.toggle("dark-mode", isDark);

    $("theme-icon").textContent = isDark ? "☀" : "☾";
    $("theme-label").textContent = isDark ? "Light mode" : "Dark mode";

    try {
        localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
    } catch (error) {
        console.warn("Could not save theme preference.");
    }

    if (expenseChart) {
        expenseChart.options.plugins.tooltip.titleColor =
            isDark ? "#e7f0eb" : "#192a24";

        expenseChart.update();
    }
}

function initializeTheme() {
    let savedTheme = "light";

    try {
        savedTheme = localStorage.getItem(THEME_KEY) || "light";
    } catch (error) {
        console.warn("Could not load theme preference.");
    }

    applyTheme(savedTheme);

    $("theme-toggle").addEventListener("click", () => {
        const isDark = document.body.classList.contains("dark-mode");

        applyTheme(isDark ? "light" : "dark");
    });
}

/* ---------- FORM VALIDATION ---------- */

function isValidDate(dateString) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return false;
    }

    const parts = dateString.split("-").map(Number);

    const date = new Date(
        parts[0],
        parts[1] - 1,
        parts[2]
    );

    return (
        date.getFullYear() === parts[0] &&
        date.getMonth() === parts[1] - 1 &&
        date.getDate() === parts[2]
    );
}

/* ---------- ADD TRANSACTION ---------- */

function initializeTransactionForm() {
    const form = $("transaction-form");
    const dateInput = $("transaction-date");
    const typeInput = $("transaction-type");
    const categoryInput = $("transaction-category");

    dateInput.value = getLocalDate();

    typeInput.addEventListener("change", () => {
        if (typeInput.value === "income") {
            categoryInput.value = "Salary";
        } else if (categoryInput.value === "Salary") {
            categoryInput.value = "Food";
        }
    });

    form.addEventListener("submit", event => {
        event.preventDefault();

        const title = $("transaction-title").value.trim();
        const amountRaw = $("transaction-amount").value;
        const amount = Number(amountRaw);
        const type = typeInput.value;
        const category = categoryInput.value;
        const date = dateInput.value;

        if (!title) {
            showToast("Enter a transaction name.");
            return;
        }

        if (
            amountRaw.trim() === "" ||
            !Number.isFinite(amount) ||
            amount <= 0 ||
            amount > 1000000000
        ) {
            showToast("Enter a valid amount greater than zero.");
            return;
        }

        if (!["income", "expense"].includes(type)) {
            showToast("Select a valid transaction type.");
            return;
        }

        if (!isValidDate(date)) {
            showToast("Select a valid transaction date.");
            return;
        }

        const transaction = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            title,
            amount: Math.round(amount * 100) / 100,
            type,
            category,
            date
        };

        transactions.unshift(transaction);

        if (!saveTransactions()) {
            transactions.shift();
            return;
        }

        form.reset();
        dateInput.value = getLocalDate();
        typeInput.value = "expense";
        categoryInput.value = "Food";

        renderDashboard();
        showToast("Transaction added successfully!");
    });
}

/* ---------- DELETE TRANSACTIONS ---------- */

function initializeTransactionActions() {
    $("transactions-body").addEventListener("click", event => {
        const button = event.target.closest("[data-delete-id]");

        if (!button) return;

        const id = button.dataset.deleteId;
        const index = transactions.findIndex(item => item.id === id);

        if (index === -1) return;

        const deleted = transactions.splice(index, 1)[0];

        if (!saveTransactions()) {
            transactions.splice(index, 0, deleted);
            return;
        }

        renderDashboard();
        showToast("Transaction deleted.");
    });

    $("transaction-filter").addEventListener("change", () => {
        renderTransactions();
    });

    $("clear-transactions").addEventListener("click", () => {
        if (transactions.length === 0) return;

        const confirmed = window.confirm(
            "Delete all transactions? This action cannot be undone."
        );

        if (!confirmed) return;

        const previousTransactions = transactions;
        transactions = [];

        if (!saveTransactions()) {
            transactions = previousTransactions;
            return;
        }

        renderDashboard();
        showToast("All transactions cleared.");
    });
}

/* ---------- BUDGET FORM ---------- */

function initializeBudgetForm() {
    const form = $("budget-form");
    const budgetInput = $("budget-amount");

    form.addEventListener("submit", event => {
        event.preventDefault();

        const rawValue = budgetInput.value.trim();
        const value = Number(rawValue);

        if (
            rawValue === "" ||
            !Number.isFinite(value) ||
            value <= 0 ||
            value > 1000000000
        ) {
            showToast("Enter a valid budget greater than zero.");
            return;
        }

        const roundedValue = Math.round(value * 100) / 100;

        if (saveBudget(roundedValue)) {
            renderBudgetAndAI();
            showToast("Monthly budget saved!");
        }
    });
}

/* ---------- NAVIGATION ---------- */

function initializeNavigation() {
    const links = document.querySelectorAll(".nav-item");

    links.forEach(link => {
        link.addEventListener("click", () => {
            links.forEach(item => item.classList.remove("active"));
            link.classList.add("active");
        });
    });
}

/* ---------- DASHBOARD RENDER ---------- */

function renderDashboard() {
    renderSummary();
    renderTransactions();
    renderBudgetAndAI();
}

/* ---------- INITIALIZATION ---------- */

document.addEventListener("DOMContentLoaded", () => {
    initializeTheme();
    initializeTransactionForm();
    initializeTransactionActions();
    initializeBudgetForm();
    initializeNavigation();

    renderDashboard();
});
