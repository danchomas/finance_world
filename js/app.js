// Application state
let products = []
const categories = [
  { id: "debit", name: "Дебетовые карты", icon: "💳" },
  { id: "credit", name: "Кредитные карты", icon: "💰" },
  { id: "deposits", name: "Депозиты", icon: "🏠" },
  { id: "investments", name: "Инвестиции", icon: "📈" },
  { id: "crypto", name: "Криптовалюта", icon: "₿" },
  { id: "sim", name: "SIM карты", icon: "📱" },
  { id: "ip", name: "Для ИП", icon: "🏢" },
  { id: "rko", name: "РКО", icon: "🏦" },
]

let currentFilter = ""
let currentSearch = ""
let isAdminLoggedIn = false
let editingProductId = null

// Default products data
const defaultProducts = [
  {
    id: 1,
    name: "Дебетовая карта Classic",
    bank: "Сбербанк",
    category: "debit",
    description: "Классическая дебетовая карта с базовым набором услуг",
    conditions: "Обслуживание: 0₽/мес, Снятие наличных: до 3 раз бесплатно",
    url: "https://www.sberbank.ru",
    active: true,
  },
  {
    id: 2,
    name: "Кредитная карта Gold",
    bank: "ВТБ",
    category: "credit",
    description: "Премиальная кредитная карта с льготным периодом",
    conditions: "Лимит: до 1 000 000₽, Льготный период: 50 дней",
    url: "https://www.vtb.ru",
    active: true,
  },
  {
    id: 3,
    name: "Накопительный счёт",
    bank: "Тинькофф",
    category: "deposits",
    description: "Высокодоходный накопительный счёт",
    conditions: "Ставка: до 8% годовых, Пополнение от 1₽",
    url: "https://www.tinkoff.ru",
    active: true,
  },
  {
    id: 4,
    name: "Инвестиционный счёт",
    bank: "Альфа-Банк",
    category: "investments",
    description: "ИИС с льготным налогообложением",
    conditions: "Налоговый вычет: до 52 000₽ в год",
    url: "https://www.alfabank.ru",
    active: true,
  },
  {
    id: 5,
    name: "Криптообменник",
    bank: "Binance",
    category: "crypto",
    description: "Торговля криптовалютами с низкими комиссиями",
    conditions: "Комиссия: от 0.1%, Поддержка 350+ криптовалют",
    url: "https://www.binance.com",
    active: true,
  },
  {
    id: 6,
    name: "Безлимитный тариф",
    bank: "МТС",
    category: "sim",
    description: "Безлимитный интернет и звонки",
    conditions: "Цена: 500₽/мес, Безлимитный интернет",
    url: "https://www.mts.ru",
    active: true,
  },
  {
    id: 7,
    name: "Расчётный счёт для ИП",
    bank: "Модульбанк",
    category: "ip",
    description: "Удобный РС для индивидуальных предпринимателей",
    conditions: "Обслуживание: 0₽ первые 3 месяца",
    url: "https://www.modulbank.ru",
    active: true,
  },
  {
    id: 8,
    name: "Корпоративный счёт",
    bank: "Райффайзенбанк",
    category: "rko",
    description: "Расчётно-кассовое обслуживание для юридических лиц",
    conditions: "Обслуживание: от 990₽/мес",
    url: "https://www.raiffeisen.ru",
    active: true,
  },
]

// Initialize application
document.addEventListener("DOMContentLoaded", () => {
  loadProducts()
  renderCategories()
  renderProducts()
  bindEvents()
})

// Load products from localStorage or use defaults
function loadProducts() {
  const savedProducts = localStorage.getItem("finance_products")
  if (savedProducts) {
    products = JSON.parse(savedProducts)
  } else {
    products = defaultProducts
    saveProducts()
  }
}

// Save products to localStorage
function saveProducts() {
  localStorage.setItem("finance_products", JSON.stringify(products))
}

// Render categories
function renderCategories() {
  const grid = document.getElementById("categoriesGrid")
  grid.innerHTML = ""

  categories.forEach((category) => {
    const categoryCard = document.createElement("div")
    categoryCard.className = `category-card bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-center ${currentFilter === category.id ? "active" : ""}`
    categoryCard.innerHTML = `
            <div class="category-icon text-4xl mb-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                ${getCategoryIcon(category.id)}
            </div>
            <h4 class="font-semibold text-gray-900">${category.name}</h4>
        `
    categoryCard.addEventListener("click", () => filterByCategory(category.id))
    grid.appendChild(categoryCard)
  })
}

// Get category icon
function getCategoryIcon(categoryId) {
  const icons = {
    debit: "💳",
    credit: "💰",
    deposits: "🏠",
    investments: "📈",
    crypto: "₿",
    sim: "📱",
    ip: "🏢",
    rko: "🏦",
  }
  return icons[categoryId] || "📋"
}

// Filter products by category
function filterByCategory(categoryId) {
  currentFilter = currentFilter === categoryId ? "" : categoryId
  renderCategories()
  renderProducts()
}

// Clear all filters
function clearFilters() {
  currentFilter = ""
  currentSearch = ""
  document.getElementById("searchInput").value = ""
  renderCategories()
  renderProducts()
}

// Render products
function renderProducts() {
  const grid = document.getElementById("productsGrid")
  grid.innerHTML = ""

  const filteredProducts = products.filter((product) => {
    const matchesCategory = !currentFilter || product.category === currentFilter
    const matchesSearch =
      !currentSearch ||
      product.name.toLowerCase().includes(currentSearch.toLowerCase()) ||
      product.bank.toLowerCase().includes(currentSearch.toLowerCase()) ||
      product.description.toLowerCase().includes(currentSearch.toLowerCase()) ||
      product.conditions.toLowerCase().includes(currentSearch.toLowerCase())
    const isActive = product.active !== false

    return matchesCategory && matchesSearch && isActive
  })

  if (filteredProducts.length === 0) {
    grid.innerHTML = `
            <div class="col-span-full text-center py-12">
                <div class="text-gray-400 text-6xl mb-4">🔍</div>
                <h3 class="text-xl font-semibold text-gray-600 mb-2">Продукты не найдены</h3>
                <p class="text-gray-500">Попробуйте изменить критерии поиска</p>
            </div>
        `
    return
  }

  filteredProducts.forEach((product) => {
    const productCard = document.createElement("div")
    productCard.className = "product-card bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
    productCard.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h4 class="font-bold text-lg text-gray-900 mb-1">${product.name}</h4>
                    <p class="text-purple-600 font-semibold">${product.bank}</p>
                </div>
                <span class="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                    ${getCategoryName(product.category)}
                </span>
            </div>
            <p class="text-gray-600 mb-4 line-clamp-3">${product.description}</p>
            <div class="bg-gray-50 p-3 rounded-lg mb-4">
                <p class="text-sm text-gray-700 font-medium">${product.conditions}</p>
            </div>
            <button class="apply-btn btn-primary w-full text-white py-3 rounded-lg font-semibold hover:transform hover:scale-105 transition-all duration-300">
                Подать заявку
            </button>
        `

    productCard.addEventListener("click", (e) => {
      if (e.target.classList.contains("apply-btn")) {
        window.open(product.url, "_blank")
      } else {
        showProductDetails(product)
      }
    })

    grid.appendChild(productCard)
  })
}

// Get category name by ID
function getCategoryName(categoryId) {
  const category = categories.find((cat) => cat.id === categoryId)
  return category ? category.name : "Неизвестно"
}

// Show product details modal
function showProductDetails(product) {
  const modal = document.getElementById("productModal")
  const title = document.getElementById("productModalTitle")
  const content = document.getElementById("productModalContent")

  title.textContent = product.name
  content.innerHTML = `
        <div class="space-y-4">
            <div>
                <h4 class="font-semibold text-gray-900 mb-2">Банк</h4>
                <p class="text-gray-700">${product.bank}</p>
            </div>
            <div>
                <h4 class="font-semibold text-gray-900 mb-2">Категория</h4>
                <p class="text-gray-700">${getCategoryName(product.category)}</p>
            </div>
            <div>
                <h4 class="font-semibold text-gray-900 mb-2">Описание</h4>
                <p class="text-gray-700">${product.description}</p>
            </div>
            <div>
                <h4 class="font-semibold text-gray-900 mb-2">Условия</h4>
                <p class="text-gray-700">${product.conditions}</p>
            </div>
            <div class="pt-4 border-t">
                <button onclick="window.open('${product.url}', '_blank')" 
                        class="btn-primary w-full text-white py-3 rounded-lg font-semibold">
                    Подать заявку на сайте банка
                </button>
            </div>
        </div>
    `

  modal.classList.remove("hidden")
  modal.querySelector(".bg-white").classList.add("modal-enter")
}

// Search functionality
function performSearch() {
  const searchInput = document.getElementById("searchInput")
  currentSearch = searchInput.value.trim()
  renderProducts()
}

// Admin functionality
function showAdminModal() {
  const modal = document.getElementById("adminModal")
  modal.classList.remove("hidden")

  if (isAdminLoggedIn) {
    document.getElementById("adminLogin").classList.add("hidden")
    document.getElementById("adminPanel").classList.remove("hidden")
    updateAdminStats()
    renderAdminProducts()
  } else {
    document.getElementById("adminLogin").classList.remove("hidden")
    document.getElementById("adminPanel").classList.add("hidden")
  }
}

function adminLogin() {
  const password = document.getElementById("adminPassword").value
  if (password === "naumovwww_worker") {
    isAdminLoggedIn = true
    document.getElementById("adminLogin").classList.add("hidden")
    document.getElementById("adminPanel").classList.remove("hidden")
    updateAdminStats()
    renderAdminProducts()
  } else {
    alert("Неверный пароль!")
  }
}

function updateAdminStats() {
  const total = products.length
  const active = products.filter((p) => p.active !== false).length
  const inactive = total - active

  document.getElementById("totalProducts").textContent = total
  document.getElementById("activeProducts").textContent = active
  document.getElementById("inactiveProducts").textContent = inactive
}

function renderAdminProducts() {
  const tbody = document.getElementById("adminProductsList")
  tbody.innerHTML = ""

  products.forEach((product) => {
    const row = document.createElement("tr")
    row.innerHTML = `
            <td class="px-4 py-3 text-sm text-gray-900">${product.id}</td>
            <td class="px-4 py-3 text-sm text-gray-900">${product.name}</td>
            <td class="px-4 py-3 text-sm text-gray-900">${product.bank}</td>
            <td class="px-4 py-3 text-sm text-gray-900">${getCategoryName(product.category)}</td>
            <td class="px-4 py-3">
                <span class="px-2 py-1 text-xs rounded-full ${product.active !== false ? "status-active" : "status-inactive"}">
                    ${product.active !== false ? "Активен" : "Неактивен"}
                </span>
            </td>
            <td class="px-4 py-3 text-sm space-x-2">
                <button onclick="editProduct(${product.id})" class="bg-blue-500 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs">
                    Редактировать
                </button>
                <button onclick="toggleProductStatus(${product.id})" class="bg-yellow-500 hover:bg-yellow-700 text-white px-3 py-1 rounded text-xs">
                    ${product.active !== false ? "Отключить" : "Включить"}
                </button>
            </td>
        `
    tbody.appendChild(row)
  })
}

function showProductForm(productId = null) {
  const modal = document.getElementById("productFormModal")
  const title = document.getElementById("productFormTitle")
  const deleteBtn = document.getElementById("deleteProductBtn")

  editingProductId = productId

  if (productId) {
    const product = products.find((p) => p.id === productId)
    title.textContent = "Редактировать продукт"
    deleteBtn.classList.remove("hidden")

    document.getElementById("productName").value = product.name
    document.getElementById("productBank").value = product.bank
    document.getElementById("productCategory").value = product.category
    document.getElementById("productDescription").value = product.description
    document.getElementById("productConditions").value = product.conditions
    document.getElementById("productUrl").value = product.url
    document.getElementById("productActive").checked = product.active !== false
  } else {
    title.textContent = "Добавить продукт"
    deleteBtn.classList.add("hidden")
    document.getElementById("productForm").reset()
    document.getElementById("productActive").checked = true
  }

  modal.classList.remove("hidden")
}

function editProduct(productId) {
  showProductForm(productId)
}

function toggleProductStatus(productId) {
  const product = products.find((p) => p.id === productId)
  if (product) {
    product.active = !product.active
    saveProducts()
    updateAdminStats()
    renderAdminProducts()
    renderProducts()
  }
}

function saveProduct() {
  const form = document.getElementById("productForm")
  const formData = new FormData(form)

  const productData = {
    name: document.getElementById("productName").value,
    bank: document.getElementById("productBank").value,
    category: document.getElementById("productCategory").value,
    description: document.getElementById("productDescription").value,
    conditions: document.getElementById("productConditions").value,
    url: document.getElementById("productUrl").value,
    active: document.getElementById("productActive").checked,
  }

  if (editingProductId) {
    const product = products.find((p) => p.id === editingProductId)
    Object.assign(product, productData)
  } else {
    const newId = Math.max(...products.map((p) => p.id)) + 1
    products.push({ ...productData, id: newId })
  }

  saveProducts()
  updateAdminStats()
  renderAdminProducts()
  renderProducts()
  closeProductFormModal()
}

function deleteProduct() {
  if (editingProductId && confirm("Вы уверены, что хотите удалить этот продукт?")) {
    products = products.filter((p) => p.id !== editingProductId)
    saveProducts()
    updateAdminStats()
    renderAdminProducts()
    renderProducts()
    closeProductFormModal()
  }
}

function closeProductFormModal() {
  document.getElementById("productFormModal").classList.add("hidden")
  editingProductId = null
}

// Event bindings
function bindEvents() {
  // Search
  document.getElementById("searchInput").addEventListener("input", performSearch)
  document.getElementById("searchBtn").addEventListener("click", performSearch)
  document.getElementById("searchInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") performSearch()
  })

  // Clear filters
  document.getElementById("clearFilters").addEventListener("click", clearFilters)

  // Admin panel
  document.getElementById("adminBtn").addEventListener("click", showAdminModal)
  document.getElementById("loginBtn").addEventListener("click", adminLogin)
  document.getElementById("adminPassword").addEventListener("keypress", (e) => {
    if (e.key === "Enter") adminLogin()
  })

  // Modal close buttons
  document.getElementById("closeAdminModal").addEventListener("click", () => {
    document.getElementById("adminModal").classList.add("hidden")
  })

  document.getElementById("closeProductModal").addEventListener("click", () => {
    document.getElementById("productModal").classList.add("hidden")
  })

  document.getElementById("closeProductFormModal").addEventListener("click", closeProductFormModal)

  // Product form
  document.getElementById("addProductBtn").addEventListener("click", () => showProductForm())
  document.getElementById("productForm").addEventListener("submit", (e) => {
    e.preventDefault()
    saveProduct()
  })
  document.getElementById("cancelProductForm").addEventListener("click", closeProductFormModal)
  document.getElementById("deleteProductBtn").addEventListener("click", deleteProduct)

  // Close modals on backdrop click
  document.getElementById("adminModal").addEventListener("click", (e) => {
    if (e.target.id === "adminModal") {
      document.getElementById("adminModal").classList.add("hidden")
    }
  })

  document.getElementById("productModal").addEventListener("click", (e) => {
    if (e.target.id === "productModal") {
      document.getElementById("productModal").classList.add("hidden")
    }
  })

  document.getElementById("productFormModal").addEventListener("click", (e) => {
    if (e.target.id === "productFormModal") {
      closeProductFormModal()
    }
  })
}
