const supabaseUrl = "https://bvqeefvruwuwsctapbko.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2cWVlZnZydXd1d3NjdGFwYmtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2MDM3NjEsImV4cCI6MjA2ODE3OTc2MX0.vu0yuQdeJ9oEx7PjneUxchVC2UBAVcMM56JqTuxrfXw"
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey)

// Application state
let products = []
let categories = []
let currentFilter = ""
let currentSearch = ""
let isAdminLoggedIn = false
let editingProductId = null
let scrollPosition = 0

// Default categories data
const defaultCategories = [
  { id: "debit", name: "Дебетовые карты", icon: "💳" },
  { id: "credit", name: "Кредитные карты", icon: "💰" },
  { id: "deposits", name: "Депозиты", icon: "🏠" },
  { id: "investments", name: "Инвестиции", icon: "📈" },
  { id: "crypto", name: "Криптовалюта", icon: "₿" },
  { id: "sim", name: "SIM карты", icon: "📱" },
  { id: "ip", name: "Для ИП", icon: "🏢" },
  { id: "rko", name: "РКО", icon: "🏦" },
]

// Функция для загрузки изображения в Supabase Storage
async function uploadProductImage(file, productId) {
  if (!file) return null

  try {
    const fileExt = file.name.split(".").pop()
    const fileName = `${productId}.${fileExt}`
    const filePath = `product_images/${fileName}`

    const { data, error } = await supabase.storage.from("product-images").upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    })

    if (error) throw error

    // Получаем публичный URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("product-images").getPublicUrl(filePath)

    return publicUrl
  } catch (error) {
    console.error("Ошибка загрузки изображения:", error)
    throw error
  }
}

// Initialize application
document.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM loaded - starting app")

  // Check auth state
  const {
    data: { session },
  } = await supabase.auth.getSession()
  isAdminLoggedIn = !!session
  console.log("Auth state. Admin logged in:", isAdminLoggedIn)

  // Listen for auth changes
  supabase.auth.onAuthStateChange((event, session) => {
    isAdminLoggedIn = !!session
    console.log("Auth state changed. Admin logged in:", isAdminLoggedIn)
  })

  // Load data and setup UI
  await loadCategories()
  await loadProducts()
  bindEvents()
})

async function loadCategories() {
  try {
    const { data, error } = await supabase.from("categories").select("*")

    if (error) throw error

    if (data && data.length > 0) {
      categories = data
      console.log(`Загружено ${categories.length} категорий`)
      renderCategories()
    } else {
      console.log("Категорий не найдено, создаем стандартные")
      await createDefaultCategories()
    }
  } catch (error) {
    console.error("Ошибка загрузки категорий:", error)
  }
}

async function createDefaultCategories() {
  try {
    const { data, error } = await supabase.from("categories").insert(defaultCategories).select()

    if (error) throw error

    categories = data
    renderCategories()
  } catch (error) {
    console.error("Ошибка создания категорий:", error)
  }
}

async function loadProducts() {
  try {
    const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false })

    if (error) throw error

    products = data || []
    console.log(`Загружено ${products.length} продуктов`)
    renderProducts()

    if (isAdminLoggedIn) {
      updateAdminStats()
      renderAdminProducts()
    }
  } catch (error) {
    console.error("Ошибка загрузки продуктов:", error)
  }
}

// Render categories
function renderCategories() {
  const grid = document.getElementById("categoriesGrid")
  if (!grid) return

  grid.innerHTML = ""

  categories.forEach((category) => {
    const categoryCard = document.createElement("div")
    categoryCard.className = `category-card bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-center ${currentFilter === category.id ? "ring-2 ring-blue-500" : ""}`
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
  if (!grid) return

  grid.innerHTML = ""

  const filteredProducts = products.filter((product) => {
    const matchesCategory = !currentFilter || product.category === currentFilter
    const matchesSearch =
      !currentSearch ||
      Object.values(product).some(
        (value) => typeof value === "string" && value.toLowerCase().includes(currentSearch.toLowerCase()),
      )
    return matchesCategory && matchesSearch && product.active !== false
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
      ${
        product.image_url
          ? `
        <div class="mb-4 h-40 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
          <img src="${product.image_url}" alt="${product.name}" class="h-full w-full object-contain">
        </div>
      `
          : `
        <div class="mb-4 h-40 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
          <svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z"></path>
          </svg>
        </div>
      `
      }
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

function showProductDetails(product) {
  const modal = document.getElementById("productModal")
  const title = document.getElementById("productModalTitle")
  const content = document.getElementById("productModalContent")

  if (!modal || !title || !content) return

  scrollPosition = window.scrollY
  document.body.classList.add("body-no-scroll")
  document.body.style.top = `-${scrollPosition}px`

  title.textContent = product.name
  content.innerHTML = `
    <div class="space-y-4" style="max-height: calc(100vh - 200px); overflow-y: auto; padding-right: 8px;">
      <div style="word-break: break-word;">
        <h4 class="font-semibold text-gray-900 mb-2">Банк</h4>
        <p class="text-gray-700">${product.bank}</p>
      </div>
      <div style="word-break: break-word;">
        <h4 class="font-semibold text-gray-900 mb-2">Категория</h4>
        <p class="text-gray-700">${getCategoryName(product.category)}</p>
      </div>
      <div style="word-break: break-word;">
        <h4 class="font-semibold text-gray-900 mb-2">Описание</h4>
        <p class="text-gray-700" style="white-space: pre-line">${product.description}</p>
      </div>
      <div style="word-break: break-word;">
        <h4 class="font-semibold text-gray-900 mb-2">Условия</h4>
        <p class="text-gray-700" style="white-space: pre-line">${product.conditions}</p>
      </div>
      <div class="pt-4 border-t" style="position: sticky; bottom: 0; background: white; padding-top: 16px;">
        <button onclick="window.open('${product.url}', '_blank')" 
                class="btn-primary w-full text-white py-3 rounded-lg font-semibold">
          Подать заявку на сайте банка
        </button>
      </div>
    </div>
  `

  modal.classList.remove("hidden")
}

function closeProductModal() {
  const modal = document.getElementById("productModal")
  if (modal) {
    modal.classList.add("hidden")
    document.body.classList.remove("body-no-scroll")
    window.scrollTo(0, scrollPosition)
    document.body.style.top = ""
  }
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
  if (!modal) return

  scrollPosition = window.scrollY
  document.body.classList.add("body-no-scroll")
  document.body.style.top = `-${scrollPosition}px`

  modal.classList.remove("hidden")

  if (isAdminLoggedIn) {
    document.getElementById("adminLogin").classList.add("hidden")
    document.getElementById("adminPanel").classList.remove("hidden")
    updateAdminStats()
    renderAdminProducts()
  } else {
    document.getElementById("adminLogin").classList.remove("hidden")
    document.getElementById("adminPanel").classList.add("hidden")

    const passwordField = document.getElementById("adminPassword")
    if (passwordField) passwordField.focus()
  }
}

async function adminLogin() {
  const password = document.getElementById("adminPassword").value
  const email = "admin@finance.ru"

  try {
    const loginBtn = document.getElementById("loginBtn")
    loginBtn.disabled = true
    loginBtn.innerHTML = "Вход..."

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    })

    if (error) throw error

    document.getElementById("adminLogin").classList.add("hidden")
    document.getElementById("adminPanel").classList.remove("hidden")
    updateAdminStats()
    renderAdminProducts()
  } catch (error) {
    console.error("Login error:", error)
    let message = "Ошибка входа"

    switch (error.message) {
      case "Invalid login credentials":
        message = "Неверный пароль"
        break
      case "Too many requests":
        message = "Слишком много попыток. Попробуйте позже"
        break
      default:
        message = error.message
    }

    alert(message)
  } finally {
    const loginBtn = document.getElementById("loginBtn")
    if (loginBtn) {
      loginBtn.disabled = false
      loginBtn.innerHTML = "Войти"
    }
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
  if (!tbody) return

  tbody.innerHTML = ""

  products.forEach((product) => {
    const row = document.createElement("tr")
    row.innerHTML = `
      <td class="px-4 py-3 text-sm text-gray-900">${product.id}</td>
      <td class="px-4 py-3 text-sm text-gray-900">${product.name}</td>
      <td class="px-4 py-3 text-sm text-gray-900">${product.bank}</td>
      <td class="px-4 py-3 text-sm text-gray-900">${getCategoryName(product.category)}</td>
      <td class="px-4 py-3">
        <span class="px-2 py-1 text-xs rounded-full ${product.active !== false ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}">
          ${product.active !== false ? "Активен" : "Неактивен"}
        </span>
      </td>
      <td class="px-4 py-3 text-sm space-x-2">
        <button onclick="editProduct('${product.id}')" class="bg-blue-500 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs">
          Редактировать
        </button>
        <button onclick="toggleProductStatus('${product.id}')" class="bg-red-500 hover:bg-red-700 text-white px-3 py-1 rounded text-xs">
          Удалить
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

  if (!modal || !title || !deleteBtn) return

  scrollPosition = window.scrollY
  document.body.classList.add("body-no-scroll")
  document.body.style.top = `-${scrollPosition}px`

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
    if (product.image_url) {
      document.getElementById("imagePreview").src = product.image_url
      document.getElementById("imagePreviewContainer").classList.remove("hidden")
    }
  } else {
    title.textContent = "Добавить продукт"
    deleteBtn.classList.add("hidden")
    document.getElementById("productForm").reset()
    document.getElementById("productActive").checked = true
    document.getElementById("imagePreviewContainer").classList.add("hidden")
    document.getElementById("productImage").value = ""
  }

  document.getElementById("productImage").addEventListener("change", (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        document.getElementById("imagePreview").src = event.target.result
        document.getElementById("imagePreviewContainer").classList.remove("hidden")
      }
      reader.readAsDataURL(file)
    }
  })

  document.getElementById("removeImageBtn").addEventListener("click", () => {
    document.getElementById("imagePreview").src = ""
    document.getElementById("imagePreviewContainer").classList.add("hidden")
    document.getElementById("productImage").value = ""
  })

  modal.classList.remove("hidden")
}

function editProduct(productId) {
  showProductForm(productId)
}

async function toggleProductStatus(productId) {
  if (!confirm("Вы уверены, что хотите удалить этот продукт?")) return

  try {
    const { error } = await supabase.from("products").delete().eq("id", productId)

    if (error) throw error

    await loadProducts()
    updateAdminStats()
    renderAdminProducts()
  } catch (error) {
    console.error("Ошибка удаления продукта:", error)
    alert("Произошла ошибка при удалении продукта")
  }
}

async function saveProductToSupabase() {
  const productData = {
    name: document.getElementById("productName").value,
    bank: document.getElementById("productBank").value,
    category: document.getElementById("productCategory").value,
    description: document.getElementById("productDescription").value,
    conditions: document.getElementById("productConditions").value,
    url: document.getElementById("productUrl").value,
    active: document.getElementById("productActive").checked,
  }

  const imageFile = document.getElementById("productImage").files[0]

  try {
    if (editingProductId) {
      // Обновление существующего продукта
      if (imageFile) {
        productData.image_url = await uploadProductImage(imageFile, editingProductId)
      }

      const { error } = await supabase.from("products").update(productData).eq("id", editingProductId)

      if (error) throw error
    } else {
      // Создание нового продукта
      const { data: newProduct, error: insertError } = await supabase
        .from("products")
        .insert([productData])
        .select()
        .single()

      if (insertError) throw insertError

      if (imageFile) {
        const imageUrl = await uploadProductImage(imageFile, newProduct.id)

        const { error: updateError } = await supabase
          .from("products")
          .update({ image_url: imageUrl })
          .eq("id", newProduct.id)

        if (updateError) throw updateError
      }
    }

    await loadProducts()
    updateAdminStats()
    renderAdminProducts()
    closeProductFormModal()
  } catch (error) {
    console.error("Ошибка сохранения продукта:", error)
    alert("Произошла ошибка при сохранении продукта")
  }
}

async function deleteProductFromSupabase() {
  if (editingProductId && confirm("Вы уверены, что хотите удалить этот продукт?")) {
    try {
      const { error } = await supabase.from("products").delete().eq("id", editingProductId)

      if (error) throw error

      await loadProducts()
      updateAdminStats()
      renderAdminProducts()
      closeProductFormModal()
    } catch (error) {
      console.error("Ошибка удаления продукта:", error)
      alert("Произошла ошибка при удалении продукта")
    }
  }
}

function closeProductFormModal() {
  const modal = document.getElementById("productFormModal")
  if (modal) {
    modal.classList.add("hidden")
    document.body.classList.remove("body-no-scroll")
    window.scrollTo(0, scrollPosition)
    document.body.style.top = ""
  }
  editingProductId = null
}

// Event bindings
function bindEvents() {
  const searchInput = document.getElementById("searchInput")
  if (searchInput) {
    searchInput.addEventListener("input", performSearch)
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") performSearch()
    })
  }

  const searchBtn = document.getElementById("searchBtn")
  if (searchBtn) searchBtn.addEventListener("click", performSearch)

  const clearFiltersBtn = document.getElementById("clearFilters")
  if (clearFiltersBtn) clearFiltersBtn.addEventListener("click", clearFilters)

  const adminBtn = document.getElementById("adminBtn")
  if (adminBtn) adminBtn.addEventListener("click", showAdminModal)

  const loginBtn = document.getElementById("loginBtn")
  if (loginBtn) loginBtn.addEventListener("click", adminLogin)

  const adminPassword = document.getElementById("adminPassword")
  if (adminPassword) {
    adminPassword.addEventListener("keypress", (e) => {
      if (e.key === "Enter") adminLogin()
    })
  }

  const closeAdminModal = document.getElementById("closeAdminModal")
  if (closeAdminModal) {
    closeAdminModal.addEventListener("click", () => {
      const modal = document.getElementById("adminModal")
      if (modal) {
        modal.classList.add("hidden")
        document.body.classList.remove("body-no-scroll")
        window.scrollTo(0, scrollPosition)
        document.body.style.top = ""
      }
    })
  }

  const closeProductModalBtn = document.getElementById("closeProductModal")
  if (closeProductModalBtn) {
    closeProductModalBtn.addEventListener("click", closeProductModal) // Теперь вызывается функция closeProductModal
  }

  const closeProductFormModalBtn = document.getElementById("closeProductFormModal")
  if (closeProductFormModalBtn) {
    closeProductFormModalBtn.addEventListener("click", closeProductFormModal)
  }

  const addProductBtn = document.getElementById("addProductBtn")
  if (addProductBtn) addProductBtn.addEventListener("click", () => showProductForm())

  const productForm = document.getElementById("productForm")
  if (productForm) {
    productForm.addEventListener("submit", (e) => {
      e.preventDefault()
      saveProductToSupabase()
    })
  }

  const cancelProductForm = document.getElementById("cancelProductForm")
  if (cancelProductForm) cancelProductForm.addEventListener("click", closeProductFormModal)

  const deleteProductBtn = document.getElementById("deleteProductBtn")
  if (deleteProductBtn) deleteProductBtn.addEventListener("click", deleteProductFromSupabase)

  const adminModal = document.getElementById("adminModal")
  if (adminModal) {
    adminModal.addEventListener("click", (e) => {
      if (e.target.id === "adminModal") {
        adminModal.classList.add("hidden")
        document.body.classList.remove("body-no-scroll")
        window.scrollTo(0, scrollPosition)
        document.body.style.top = ""
      }
    })
  }

  const productModal = document.getElementById("productModal")
  if (productModal) {
    productModal.addEventListener("click", (e) => {
      if (e.target.id === "productModal") {
        closeProductModal()
      }
    })
  }

  const productFormModal = document.getElementById("productFormModal")
  if (productFormModal) {
    productFormModal.addEventListener("click", (e) => {
      if (e.target.id === "productFormModal") {
        closeProductFormModal()
      }
    })
  }
}

// Make functions globally available for inline handlers
window.editProduct = editProduct
window.toggleProductStatus = toggleProductStatus
window.closeProductModal = closeProductModal