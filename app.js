const STORAGE_KEY = "pocket-plan-budget-v1";

const currencySymbols = {
  USD: "$",
  CAD: "$",
  AUD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  JPY: "¥",
};

const incomeInput = document.querySelector("#income");
const incomePeriodOptions = document.querySelectorAll('input[name="income-period"]');
const annualSalaryInput = document.querySelector("#annual-salary");
const taxRateInput = document.querySelector("#tax-rate");
const currencySelect = document.querySelector("#currency");
const savingsPeriodSelect = document.querySelector("#savings-period");
const savingsTargetInput = document.querySelector("#savings-target");
const expenseList = document.querySelector("#expense-list");
const saveStatus = document.querySelector("#save-status");
const remainingCard = document.querySelector("#remaining-card");
const stickySummary = document.querySelector("#sticky-summary");
const state = {
  income: "",
  incomePeriod: "monthly",
  annualSalary: "",
  taxRate: "25",
  currency: "USD",
  savingsPeriod: "monthly",
  savingsTarget: "",
  expenses: [],
};

function showStatus(message, isError = false) {
  saveStatus.textContent = message;
  saveStatus.classList.toggle("error", isError);
}

function readSavedBudget() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) {
      return;
    }

    const budget = JSON.parse(saved);
    const validBudget = budget !== null && typeof budget === "object" && !Array.isArray(budget);
    const validCurrency = validBudget && Object.hasOwn(currencySymbols, budget.currency);
    const validExpenses = Array.isArray(budget.expenses)
      && budget.expenses.every((expense) =>
        expense
        && typeof expense.name === "string"
        && typeof expense.amount === "string");
    const validSavingsPeriod = budget.savingsPeriod === undefined
      || budget.savingsPeriod === "monthly"
      || budget.savingsPeriod === "annual";
    const validSavingsTarget = budget.savingsTarget === undefined
      || typeof budget.savingsTarget === "string";
    const validIncomePeriod = budget.incomePeriod === undefined
      || budget.incomePeriod === "monthly"
      || budget.incomePeriod === "annual";
    const validAnnualSalary = budget.annualSalary === undefined
      || typeof budget.annualSalary === "string";
    const validTaxRate = budget.taxRate === undefined
      || typeof budget.taxRate === "string";

    if (
      !validBudget
      || typeof budget.income !== "string"
      || !validCurrency
      || !validExpenses
      || !validSavingsPeriod
      || !validSavingsTarget
      || !validIncomePeriod
      || !validAnnualSalary
      || !validTaxRate
    ) {
      throw new Error("Saved budget data has an unexpected format.");
    }

    state.income = budget.income;
    state.incomePeriod = budget.incomePeriod ?? "monthly";
    state.annualSalary = budget.annualSalary ?? "";
    state.taxRate = budget.taxRate ?? "25";
    state.currency = budget.currency;
    state.savingsPeriod = budget.savingsPeriod ?? "monthly";
    state.savingsTarget = budget.savingsTarget ?? "";
    state.expenses = budget.expenses;
  } catch (error) {
    console.error("Unable to read the saved budget.", error);
    showStatus("Saved data could not be read. Changes will start a new budget.", true);
  }
}

function saveBudget() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    showStatus("Saved on this device");
  } catch (error) {
    console.error("Unable to save the budget in this browser.", error);
    showStatus("Could not save in this browser. Check your storage settings.", true);
  }
}

function amountOrZero(value) {
  const amount = Number.parseFloat(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function monthlyIncome() {
  if (state.incomePeriod === "monthly") {
    return amountOrZero(state.income);
  }

  const salary = amountOrZero(state.annualSalary);
  const taxRate = Math.min(100, Math.max(0, Number.parseFloat(state.taxRate) || 0));
  return salary * (1 - taxRate / 100) / 12;
}

function formatCurrency(value) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: state.currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function renderSummary() {
  const income = monthlyIncome();
  const enteredSavingsTarget = amountOrZero(state.savingsTarget);
  const monthlySavingsTarget = state.savingsPeriod === "annual"
    ? enteredSavingsTarget / 12
    : enteredSavingsTarget;
  const annualSavingsTarget = monthlySavingsTarget * 12;
  const expenses = state.expenses.reduce(
    (total, expense) => total + amountOrZero(expense.amount),
    0,
  );
  const remaining = income - expenses;

  document.querySelector("#summary-income").textContent = formatCurrency(income);
  document.querySelector("#sticky-income").textContent = formatCurrency(income);
  document.querySelector("#income-summary-caption").textContent = state.incomePeriod === "annual"
    ? "Estimated monthly take-home"
    : "Take-home pay";
  document.querySelector("#summary-expenses").textContent = formatCurrency(expenses);
  document.querySelector("#sticky-expenses").textContent = formatCurrency(expenses);
  document.querySelector("#summary-remaining").textContent = formatCurrency(remaining);
  document.querySelector("#sticky-remaining").textContent = formatCurrency(remaining);
  document.querySelector("#remaining-caption").textContent = remaining < 0
    ? "More planned than your income"
    : "Available to save after expenses";
  remainingCard.classList.toggle("negative", remaining < 0);
  document.querySelector("#sticky-remaining-card").classList.toggle("negative", remaining < 0);
  document.querySelector("#income-symbol").textContent = currencySymbols[state.currency];
  document.querySelector("#annual-salary-symbol").textContent = currencySymbols[state.currency];
  document.querySelector("#savings-symbol").textContent = currencySymbols[state.currency];
  document.querySelector("#savings-monthly").textContent = formatCurrency(monthlySavingsTarget);
  document.querySelector("#savings-yearly").textContent = formatCurrency(annualSavingsTarget);
  document.querySelector("#estimated-monthly-income").textContent = formatCurrency(income);
  renderSavingsProgress(remaining, monthlySavingsTarget);
  renderDailyRate(income, monthlySavingsTarget, expenses);

  document.querySelectorAll(".expense-percentage").forEach((percentage, index) => {
    const expenseAmount = amountOrZero(state.expenses[index].amount);
    if (income === 0) {
      percentage.textContent = expenseAmount > 0 ? "∞" : "0%";
      percentage.setAttribute(
        "aria-label",
        expenseAmount > 0
          ? "Infinite percentage because monthly income is zero"
          : "0% because no expense amount has been entered",
      );
      return;
    }

    const value = (expenseAmount / income * 100).toFixed(1).replace(/\.0$/, "");
    percentage.textContent = `${value}%`;
    percentage.setAttribute("aria-label", `${value}% of monthly income`);
  });
}

function renderDailyRate(income, monthlySavingsTarget, expenses) {
  const dailyBudget = (income - monthlySavingsTarget) / 30.4;
  const dailySpend = expenses / 30.4;
  const dailyRemaining = dailyBudget - dailySpend;
  document.querySelector("#daily-total-budget").textContent = formatCurrency(dailyBudget);
  document.querySelector("#daily-average-spend").textContent = formatCurrency(dailySpend);
  document.querySelector("#daily-remaining").textContent = formatCurrency(dailyRemaining);
  document.querySelector("#daily-remaining-monthly").textContent = formatCurrency(dailyRemaining * 30.4);
  const guidance = document.querySelector("#daily-rate-guidance");
  guidance.classList.toggle("off-target", dailyRemaining < 0);
  guidance.textContent = dailyRemaining < 0
    ? `Your planned spending is ${formatCurrency(-dailyRemaining)} per day over the budget needed to meet your savings goal.`
    : `You have ${formatCurrency(dailyRemaining)} available to spend per day while still meeting your savings goal.`;
}

function renderSavingsProgress(remaining, target, today = new Date()) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthsRemaining = 11 - month + (daysInMonth - today.getDate() + 1) / daysInMonth;
  const savings = Math.max(0, remaining);
  const progress = target > 0 ? savings / target * 100 : 0;
  const shortfall = Math.max(0, target - remaining);
  document.querySelector("#savings-progress-percent").textContent = target > 0
    ? `${Number(progress.toFixed(1))}%`
    : "—";
  document.querySelector("#savings-progress-bar").value = Math.min(100, progress);
  document.querySelector("#savings-progress-caption").textContent = target > 0
    ? `Of your ${formatCurrency(target)} monthly target`
    : "Set a savings target above to see your progress.";
  document.querySelector("#savings-year-end").textContent = formatCurrency(savings * monthsRemaining);
  document.querySelector("#savings-year-end-label").textContent = `By December 31, ${year}`;
  document.querySelector("#savings-projection-note").textContent =
    `Additional savings from ${today.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })} through year-end, including today and a prorated current month. Based on ${formatCurrency(savings)} available to save each month; excludes savings already accumulated.`;
  document.querySelector("#savings-annual-projection").textContent = formatCurrency(remaining * 12);
  const guidance = document.querySelector("#savings-guidance");
  guidance.classList.toggle("off-target", target > 0 && shortfall > 0);
  guidance.textContent = target <= 0
    ? "Choose a monthly or annual target in Make a plan to see how your savings compare."
    : shortfall > 0
      ? `Reduce monthly expenses by ${formatCurrency(Math.round(shortfall * 100) / 100)} to meet your savings target.${shortfall > monthlyIncome() - remaining ? " Meeting this target will also require more income, even if you eliminate all expenses." : ""}`
      : "You’re on track to meet your savings target. Keep your current spending plan going.";
}

function renderExpenses() {
  expenseList.replaceChildren();

  if (state.expenses.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "empty-state";
    emptyMessage.textContent = "No expenses yet. Add one to start planning.";
    expenseList.append(emptyMessage);
    return;
  }

  state.expenses.forEach((expense, index) => {
    const row = document.createElement("div");
    row.className = "expense-row";

    const nameLabel = document.createElement("label");
    nameLabel.className = "visually-hidden";
    nameLabel.htmlFor = `expense-name-${index}`;
    nameLabel.textContent = `Expense ${index + 1} name`;

    const nameInput = document.createElement("input");
    nameInput.id = `expense-name-${index}`;
    nameInput.type = "text";
    nameInput.maxLength = 80;
    nameInput.placeholder = "e.g. Rent";
    nameInput.value = expense.name;
    nameInput.setAttribute("aria-label", `Expense ${index + 1} name`);
    nameInput.addEventListener("input", () => {
      state.expenses[index].name = nameInput.value;
      saveBudget();
    });

    const amountWrap = document.createElement("div");
    amountWrap.className = "expense-amount-wrap";

    const symbol = document.createElement("span");
    symbol.className = "input-symbol";
    symbol.setAttribute("aria-hidden", "true");
    symbol.textContent = currencySymbols[state.currency];

    const amountInput = document.createElement("input");
    amountInput.id = `expense-amount-${index}`;
    amountInput.type = "number";
    amountInput.min = "0";
    amountInput.step = "0.01";
    amountInput.inputMode = "decimal";
    amountInput.placeholder = "0.00";
    amountInput.value = expense.amount;
    amountInput.setAttribute("aria-label", `Expense ${index + 1} amount`);
    amountInput.addEventListener("input", () => {
      state.expenses[index].amount = amountInput.value;
      renderSummary();
      saveBudget();
    });

    const percentage = document.createElement("span");
    percentage.className = "expense-percentage";
    percentage.title = "Percentage of monthly income";

    const removeButton = document.createElement("button");
    removeButton.className = "remove-expense";
    removeButton.type = "button";
    removeButton.setAttribute("aria-label", `Remove expense ${index + 1}`);
    removeButton.textContent = "×";
    removeButton.addEventListener("click", () => {
      state.expenses.splice(index, 1);
      renderExpenses();
      renderSummary();
      saveBudget();
    });

    amountWrap.append(symbol, amountInput);
    row.append(nameLabel, nameInput, amountWrap, percentage, removeButton);
    expenseList.append(row);
  });
}

function render() {
  incomeInput.value = state.income;
  incomePeriodOptions.forEach((option) => {
    option.checked = option.value === state.incomePeriod;
  });
  annualSalaryInput.value = state.annualSalary;
  taxRateInput.value = state.taxRate;
  document.querySelector("#monthly-income-field").hidden = state.incomePeriod !== "monthly";
  document.querySelector("#annual-income-field").hidden = state.incomePeriod !== "annual";
  currencySelect.value = state.currency;
  savingsPeriodSelect.value = state.savingsPeriod;
  savingsTargetInput.value = state.savingsTarget;
  document.querySelector("#savings-input-label").textContent = state.savingsPeriod === "annual"
    ? "Annual savings goal"
    : "Monthly savings target";
  renderExpenses();
  renderSummary();
}

incomeInput.addEventListener("input", () => {
  state.income = incomeInput.value;
  renderSummary();
  saveBudget();
});

incomePeriodOptions.forEach((option) => {
  option.addEventListener("change", () => {
    state.incomePeriod = option.value;
    render();
    saveBudget();
  });
});

annualSalaryInput.addEventListener("input", () => {
  state.annualSalary = annualSalaryInput.value;
  renderSummary();
  saveBudget();
});

taxRateInput.addEventListener("input", () => {
  state.taxRate = taxRateInput.value;
  renderSummary();
  saveBudget();
});

currencySelect.addEventListener("change", () => {
  state.currency = currencySelect.value;
  renderExpenses();
  renderSummary();
  saveBudget();
});

savingsPeriodSelect.addEventListener("change", () => {
  state.savingsPeriod = savingsPeriodSelect.value;
  document.querySelector("#savings-input-label").textContent = state.savingsPeriod === "annual"
    ? "Annual savings goal"
    : "Monthly savings target";
  renderSummary();
  saveBudget();
});

savingsTargetInput.addEventListener("input", () => {
  state.savingsTarget = savingsTargetInput.value;
  renderSummary();
  saveBudget();
});

document.querySelector("#add-expense").addEventListener("click", () => {
  state.expenses.push({ name: "", amount: "" });
  renderExpenses();
  renderSummary();
  saveBudget();
  expenseList.lastElementChild.querySelector("input").focus();
});

document.querySelector("#clear-budget").addEventListener("click", () => {
  if (!window.confirm("Clear all income and expenses saved in this browser?")) {
    return;
  }

  state.income = "";
  state.incomePeriod = "monthly";
  state.annualSalary = "";
  state.taxRate = "25";
  state.currency = "USD";
  state.savingsPeriod = "monthly";
  state.savingsTarget = "";
  state.expenses = [];
  render();

  try {
    localStorage.removeItem(STORAGE_KEY);
    showStatus("Budget cleared from this device");
  } catch (error) {
    console.error("Unable to clear the saved budget.", error);
    showStatus("Could not clear saved data in this browser.", true);
  }
});

const calculatorPanel = document.querySelector("#calculator-panel");
const calculatorToggle = document.querySelector("#calculator-toggle");
const calculatorDisplay = document.querySelector("#calculator-display");
const calculatorKeys = document.querySelector("#calculator-keys");
const calculatorState = {
  display: "0",
  storedValue: null,
  operator: null,
  waitingForOperand: false,
};

function updateCalculatorDisplay() {
  calculatorDisplay.textContent = calculatorState.display;
}

function formatCalculatorValue(value) {
  if (!Number.isFinite(value)) {
    return "Error";
  }
  return String(Number.parseFloat(value.toPrecision(10)));
}

function calculate(left, right, operator) {
  switch (operator) {
    case "+":
      return left + right;
    case "−":
      return left - right;
    case "×":
      return left * right;
    case "÷":
      return right === 0 ? Number.NaN : left / right;
    default:
      return right;
  }
}

function enterCalculatorDigit(digit) {
  if (calculatorState.display === "Error") {
    calculatorState.storedValue = null;
    calculatorState.operator = null;
    calculatorState.waitingForOperand = false;
    calculatorState.display = digit;
  } else if (calculatorState.waitingForOperand) {
    calculatorState.display = digit;
    calculatorState.waitingForOperand = false;
  } else if (calculatorState.display === "0") {
    calculatorState.display = digit;
  } else if (calculatorState.display.replace("-", "").length < 12) {
    calculatorState.display += digit;
  }
  updateCalculatorDisplay();
}

function chooseCalculatorOperator(operator) {
  const currentValue = Number(calculatorState.display);
  if (calculatorState.display === "Error") {
    return;
  }

  if (calculatorState.operator && !calculatorState.waitingForOperand) {
    const result = calculate(calculatorState.storedValue, currentValue, calculatorState.operator);
    calculatorState.display = formatCalculatorValue(result);
    calculatorState.storedValue = result;
  } else {
    calculatorState.storedValue = currentValue;
  }
  calculatorState.operator = operator;
  calculatorState.waitingForOperand = true;
  updateCalculatorDisplay();
}

function performCalculatorAction(action) {
  const value = Number(calculatorState.display);

  switch (action) {
    case "clear":
      calculatorState.display = "0";
      calculatorState.storedValue = null;
      calculatorState.operator = null;
      calculatorState.waitingForOperand = false;
      break;
    case "decimal":
      if (calculatorState.display === "Error" || calculatorState.waitingForOperand) {
        calculatorState.display = "0.";
        calculatorState.waitingForOperand = false;
      } else if (!calculatorState.display.includes(".")) {
        calculatorState.display += ".";
      }
      break;
    case "sign":
      if (calculatorState.display !== "Error" && value !== 0) {
        calculatorState.display = formatCalculatorValue(-value);
      }
      break;
    case "percent":
      if (calculatorState.display !== "Error") {
        calculatorState.display = formatCalculatorValue(value / 100);
      }
      break;
    case "equals":
      if (calculatorState.operator && calculatorState.storedValue !== null) {
        calculatorState.display = formatCalculatorValue(
          calculate(calculatorState.storedValue, value, calculatorState.operator),
        );
        calculatorState.storedValue = null;
        calculatorState.operator = null;
        calculatorState.waitingForOperand = true;
      }
      break;
    default:
      return;
  }
  updateCalculatorDisplay();
}

function setCalculatorOpen(open) {
  const animationDuration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 320;
  calculatorToggle.setAttribute("aria-expanded", String(open));
  calculatorToggle.setAttribute("aria-label", open ? "Close calculator" : "Open calculator");
  calculatorToggle.classList.toggle("is-open", open);

  if (open) {
    calculatorPanel.hidden = false;
    const panelRect = calculatorPanel.getBoundingClientRect();
    const toggleRect = calculatorToggle.getBoundingClientRect();
    const offsetX = toggleRect.left + toggleRect.width / 2 - (panelRect.left + panelRect.width / 2);
    const offsetY = toggleRect.top + toggleRect.height / 2 - (panelRect.top + panelRect.height / 2);
    calculatorPanel.animate(
      [
        { transform: `translate(${offsetX}px, ${offsetY}px) scale(0.08)`, opacity: 0 },
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
      ],
      { duration: animationDuration, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
    );
    return;
  }

  const panelRect = calculatorPanel.getBoundingClientRect();
  const toggleRect = calculatorToggle.getBoundingClientRect();
  const offsetX = toggleRect.left + toggleRect.width / 2 - (panelRect.left + panelRect.width / 2);
  const offsetY = toggleRect.top + toggleRect.height / 2 - (panelRect.top + panelRect.height / 2);
  const animation = calculatorPanel.animate(
    [
      { transform: "translate(0, 0) scale(1)", opacity: 1 },
      { transform: `translate(${offsetX}px, ${offsetY}px) scale(0.08)`, opacity: 0 },
    ],
    { duration: animationDuration === 1 ? 1 : 280, easing: "cubic-bezier(0.4, 0, 1, 1)" },
  );
  animation.onfinish = () => {
    if (calculatorToggle.getAttribute("aria-expanded") === "false") {
      calculatorPanel.hidden = true;
    }
  };
}

calculatorToggle.addEventListener("click", () => {
  setCalculatorOpen(calculatorToggle.getAttribute("aria-expanded") !== "true");
});

calculatorKeys.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) {
    return;
  }

  if (button.dataset.digit !== undefined) {
    enterCalculatorDigit(button.dataset.digit);
  } else if (button.dataset.operator) {
    chooseCalculatorOperator(button.dataset.operator);
  } else if (button.dataset.action) {
    performCalculatorAction(button.dataset.action);
  }
});

document.querySelector("#calculator-drag-handle").addEventListener("pointerdown", (event) => {
  if (event.button !== 0) {
    return;
  }
  const panelRect = calculatorPanel.getBoundingClientRect();
  const pointerOffsetX = event.clientX - panelRect.left;
  const pointerOffsetY = event.clientY - panelRect.top;
  const handle = event.currentTarget;
  handle.setPointerCapture(event.pointerId);

  function movePanel(moveEvent) {
    const left = Math.max(8, Math.min(window.innerWidth - panelRect.width - 8, moveEvent.clientX - pointerOffsetX));
    const top = Math.max(8, Math.min(window.innerHeight - panelRect.height - 8, moveEvent.clientY - pointerOffsetY));
    calculatorPanel.style.left = `${left}px`;
    calculatorPanel.style.top = `${top}px`;
    calculatorPanel.style.bottom = "auto";
  }

  function stopMoving() {
    handle.removeEventListener("pointermove", movePanel);
    handle.removeEventListener("pointerup", stopMoving);
    handle.removeEventListener("pointercancel", stopMoving);
  }

  handle.addEventListener("pointermove", movePanel);
  handle.addEventListener("pointerup", stopMoving);
  handle.addEventListener("pointercancel", stopMoving);
});

document.addEventListener("keydown", (event) => {
  const target = event.target;
  if (
    calculatorPanel.hidden
    || event.altKey
    || event.ctrlKey
    || event.metaKey
    || target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || target.isContentEditable
  ) {
    return;
  }

  if (/^\d$/.test(event.key)) {
    enterCalculatorDigit(event.key);
  } else if (event.key === ".") {
    performCalculatorAction("decimal");
  } else if (["+", "-", "*", "/"].includes(event.key)) {
    const operator = { "+": "+", "-": "−", "*": "×", "/": "÷" }[event.key];
    chooseCalculatorOperator(operator);
  } else if (event.key === "Enter" || event.key === "=") {
    performCalculatorAction("equals");
  } else if (event.key === "Escape") {
    setCalculatorOpen(false);
  } else if (event.key === "Backspace") {
    calculatorState.display = calculatorState.display === "Error"
      ? "0"
      : calculatorState.display.length > 1
      ? calculatorState.display.slice(0, -1)
      : "0";
    updateCalculatorDisplay();
  }
});

readSavedBudget();
render();

const summaryObserver = new IntersectionObserver(([entry]) => {
  const showStickySummary = !entry.isIntersecting && entry.boundingClientRect.top < 0;
  stickySummary.classList.toggle("is-visible", showStickySummary);
  stickySummary.setAttribute("aria-hidden", String(!showStickySummary));
}, { threshold: 0 });
summaryObserver.observe(document.querySelector(".summary-grid"));
