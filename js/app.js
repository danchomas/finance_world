// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAZRPamomVZQJDW_gpbN44CPFKlX_YOWmc",
    authDomain: "finance-world-56ebd.firebaseapp.com",
    databaseURL: "https://finance-world-56ebd-default-rtdb.firebaseio.com",
    projectId: "finance-world-56ebd",
    storageBucket: "finance-world-56ebd.firebasestorage.app",
    messagingSenderId: "628131674914",
    appId: "1:628131674914:web:1b8dc2db33ad9a57b2437b"
    };

// Initialize Firebase only once
try {
  if (firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase initialized successfully");
  }
} catch (error) {
  console.error("Firebase initialization error:", error);
}

// Get Firebase services
const auth = firebase.auth();
const db = firebase.database();

// Create database references
const productsRef = db.ref('products');
const categoriesRef = db.ref('categories');

// Application state
let products = [];
let categories = [];
let currentFilter = "";
let currentSearch = "";
let isAdminLoggedIn = false;
let editingProductId = null;

// Default products data
const defaultProducts = [
];

// Default categories data
const defaultCategories = [
  { id: "debit", name: "Дебетовые карты", icon: "💳" },
  { id: "credit", name: "Кредитные карты", icon: "💰" },
  { id: "deposits", name: "Депозиты", icon: "🏠" },
  { id: "investments", name: "Инвестиции", icon: "📈" },
  { id: "crypto", name: "Криптовалюта", icon: "₿" },
  { id: "sim", name: "SIM карты", icon: "📱" },
  { id: "ip", name: "Для ИП", icon: "🏢" },
  { id: "rko", name: "РКО", icon: "🏦" }
];

// Initialize application
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded - starting app");
  
  // Set up auth state listener
  auth.onAuthStateChanged(user => {
    isAdminLoggedIn = !!user;
    console.log("Auth state changed. Admin logged in:", isAdminLoggedIn);
    
    // Load data and setup UI
    loadCategories();
    loadProducts();
    bindEvents();
  });
});

function loadCategories() {
  // Убираем on('value') и используем once() для однократного получения данных
  categoriesRef.once('value').then((snapshot) => {
    const data = snapshot.val();
    if (data) {
      categories = Object.keys(data).map(key => ({ id: key, ...data[key] }));
      console.log(`Загружено ${categories.length} категорий`);
      renderCategories();
    } else {
      console.log("Категорий не найдено, создаем стандартные");
      defaultCategories.forEach(cat => categoriesRef.push(cat));
    }
  }).catch(error => {
    console.error("Ошибка загрузки категорий:", error);
  });
}

// Load products from Firebase (однократная загрузка)
function loadProducts() {
  // Убираем on('value') и используем once() для однократного получения данных
  productsRef.once('value').then((snapshot) => {
    const data = snapshot.val();
    if (data) {
      products = Object.keys(data).map(key => ({ id: key, ...data[key] }));
      console.log(`Загружено ${products.length} продуктов`);
      renderProducts();
      
      if (isAdminLoggedIn) {
        updateAdminStats();
        renderAdminProducts();
      }
    } else {
      console.log("Продуктов не найдено, создаем стандартные");
      defaultProducts.forEach(product => productsRef.push(product));
    }
  }).catch(error => {
    console.error("Ошибка загрузки продуктов:", error);
  });
}

// Render categories
function renderCategories() {
  const grid = document.getElementById("categoriesGrid");
  if (!grid) return;
  
  grid.innerHTML = "";
  
  categories.forEach(category => {
    const categoryCard = document.createElement("div");
    categoryCard.className = `category-card bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-center ${currentFilter === category.id ? "ring-2 ring-blue-500" : ""}`;
    categoryCard.innerHTML = `
      <div class="category-icon text-4xl mb-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto">
        ${getCategoryIcon(category.id)}
      </div>
      <h4 class="font-semibold text-gray-900">${category.name}</h4>
    `;
    categoryCard.addEventListener("click", () => filterByCategory(category.id));
    grid.appendChild(categoryCard);
  });
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
  };
  return icons[categoryId] || "📋";
}

// Filter products by category
function filterByCategory(categoryId) {
  currentFilter = currentFilter === categoryId ? "" : categoryId;
  renderCategories();
  renderProducts();
}

// Clear all filters
function clearFilters() {
  currentFilter = "";
  currentSearch = "";
  document.getElementById("searchInput").value = "";
  renderCategories();
  renderProducts();
}

// Render products
function renderProducts() {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;
  
  grid.innerHTML = "";

  const filteredProducts = products.filter(product => {
    const matchesCategory = !currentFilter || product.category === currentFilter;
    const matchesSearch = !currentSearch || 
      Object.values(product).some(value => 
        typeof value === "string" && 
        value.toLowerCase().includes(currentSearch.toLowerCase())
      );
    return matchesCategory && matchesSearch;
  });

  if (filteredProducts.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-12">
        <div class="text-gray-400 text-6xl mb-4">🔍</div>
        <h3 class="text-xl font-semibold text-gray-600 mb-2">Продукты не найдены</h3>
        <p class="text-gray-500">Попробуйте изменить критерии поиска</p>
      </div>
    `;
    return;
  }

  filteredProducts.forEach(product => {
    const productCard = document.createElement("div");
    productCard.className = "product-card bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300";
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
    `;

    productCard.addEventListener("click", (e) => {
      if (e.target.classList.contains("apply-btn")) {
        window.open(product.url, "_blank");
      } else {
        showProductDetails(product);
      }
    });

    grid.appendChild(productCard);
  });
}

// Get category name by ID
function getCategoryName(categoryId) {
  const category = categories.find(cat => cat.id === categoryId);
  return category ? category.name : "Неизвестно";
}

// Show product details modal
function showProductDetails(product) {
  const modal = document.getElementById("productModal");
  const title = document.getElementById("productModalTitle");
  const content = document.getElementById("productModalContent");
  
  if (!modal || !title || !content) return;

  title.textContent = product.name;
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
  `;

  modal.classList.remove("hidden");
}

// Search functionality
function performSearch() {
  const searchInput = document.getElementById("searchInput");
  currentSearch = searchInput.value.trim();
  renderProducts();
}

// Admin functionality
function showAdminModal() {
  const modal = document.getElementById("adminModal");
  if (!modal) return;
  
  modal.classList.remove("hidden");

  if (isAdminLoggedIn) {
    document.getElementById("adminLogin").classList.add("hidden");
    document.getElementById("adminPanel").classList.remove("hidden");
    updateAdminStats();
    renderAdminProducts();
  } else {
    document.getElementById("adminLogin").classList.remove("hidden");
    document.getElementById("adminPanel").classList.add("hidden");
    
    // Focus on password field
    const passwordField = document.getElementById("adminPassword");
    if (passwordField) passwordField.focus();
  }
}

async function adminLogin() {
  const password = document.getElementById("adminPassword").value;
  const email = "admin@finance.ru"; // Fixed email
  
  try {
    // Show loading state
    const loginBtn = document.getElementById("loginBtn");
    loginBtn.disabled = true;
    loginBtn.innerHTML = "Вход...";
    
    await auth.signInWithEmailAndPassword(email, password);
    
    // Hide login form, show admin panel
    document.getElementById("adminLogin").classList.add("hidden");
    document.getElementById("adminPanel").classList.remove("hidden");
    updateAdminStats();
    renderAdminProducts();
    
  } catch (error) {
    console.error("Login error:", error);
    let message = "Ошибка входа";
    
    switch(error.code) {
      case "auth/user-not-found":
        message = "Пользователь не найден";
        break;
      case "auth/wrong-password":
        message = "Неверный пароль";
        break;
      case "auth/too-many-requests":
        message = "Слишком много попыток. Попробуйте позже";
        break;
      default:
        message = error.message;
    }
    
    alert(message);
  } finally {
    // Restore login button
    const loginBtn = document.getElementById("loginBtn");
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.innerHTML = "Войти";
    }
  }
}

function updateAdminStats() {
  const total = products.length;
  const active = products.filter(p => p.active !== false).length;
  const inactive = total - active;

  document.getElementById("totalProducts").textContent = total;
  document.getElementById("activeProducts").textContent = active;
  document.getElementById("inactiveProducts").textContent = inactive;
}

function renderAdminProducts() {
  const tbody = document.getElementById("adminProductsList");
  if (!tbody) return;
  
  tbody.innerHTML = "";

  products.forEach(product => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="px-4 py-3 text-sm text-gray-900">${product.id}</td>
      <td class="px-4 py-3 text-sm text-gray-900">${product.name}</td>
      <td class="px-4 py-3 text-sm text-gray-900">${product.bank}</td>
      <td class="px-4 py-3 text-sm text-gray-900">${getCategoryName(product.category)}</td>
      <td class="px-4 py-3">
        <span class="px-2 py-1 text-xs rounded-full ${product.active !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
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
    `;
    tbody.appendChild(row);
  });
}

function showProductForm(productId = null) {
  const modal = document.getElementById("productFormModal");
  const title = document.getElementById("productFormTitle");
  const deleteBtn = document.getElementById("deleteProductBtn");
  
  if (!modal || !title || !deleteBtn) return;

  editingProductId = productId;

  if (productId) {
    const product = products.find(p => p.id === productId);
    title.textContent = "Редактировать продукт";
    deleteBtn.classList.remove("hidden");

    document.getElementById("productName").value = product.name;
    document.getElementById("productBank").value = product.bank;
    document.getElementById("productCategory").value = product.category;
    document.getElementById("productDescription").value = product.description;
    document.getElementById("productConditions").value = product.conditions;
    document.getElementById("productUrl").value = product.url;
    document.getElementById("productActive").checked = product.active !== false;
  } else {
    title.textContent = "Добавить продукт";
    deleteBtn.classList.add("hidden");
    document.getElementById("productForm").reset();
    document.getElementById("productActive").checked = true;
  }

  modal.classList.remove("hidden");
}

function editProduct(productId) {
  showProductForm(productId);
}

function toggleProductStatus(productId) {
  if (!confirm("Вы уверены, что хотите удалить этот продукт?")) return;
  
  productsRef.child(productId).remove();
}

function saveProductToFirebase() {
  const productData = {
    name: document.getElementById("productName").value,
    bank: document.getElementById("productBank").value,
    category: document.getElementById("productCategory").value,
    description: document.getElementById("productDescription").value,
    conditions: document.getElementById("productConditions").value,
    url: document.getElementById("productUrl").value,
    active: document.getElementById("productActive").checked,
  };

  if (editingProductId) {
    productsRef.child(editingProductId).update(productData);
  } else {
    productsRef.push(productData);
  }

  closeProductFormModal();
}

function deleteProductFromFirebase() {
  if (editingProductId && confirm("Вы уверены, что хотите удалить этот продукт?")) {
    productsRef.child(editingProductId).remove();
    closeProductFormModal();
  }
}

function closeProductFormModal() {
  const modal = document.getElementById("productFormModal");
  if (modal) modal.classList.add("hidden");
  editingProductId = null;
}

// Event bindings
function bindEvents() {
  // Search
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", performSearch);
    searchInput.addEventListener("keypress", e => {
      if (e.key === "Enter") performSearch();
    });
  }
  
  const searchBtn = document.getElementById("searchBtn");
  if (searchBtn) searchBtn.addEventListener("click", performSearch);
  
  // Clear filters
  const clearFiltersBtn = document.getElementById("clearFilters");
  if (clearFiltersBtn) clearFiltersBtn.addEventListener("click", clearFilters);

  // Admin panel
  const adminBtn = document.getElementById("adminBtn");
  if (adminBtn) adminBtn.addEventListener("click", showAdminModal);
  
  const loginBtn = document.getElementById("loginBtn");
  if (loginBtn) loginBtn.addEventListener("click", adminLogin);
  
  const adminPassword = document.getElementById("adminPassword");
  if (adminPassword) {
    adminPassword.addEventListener("keypress", e => {
      if (e.key === "Enter") adminLogin();
    });
  }

  // Modal close buttons
  const closeAdminModal = document.getElementById("closeAdminModal");
  if (closeAdminModal) {
    closeAdminModal.addEventListener("click", () => {
      const modal = document.getElementById("adminModal");
      if (modal) modal.classList.add("hidden");
    });
  }

  const closeProductModal = document.getElementById("closeProductModal");
  if (closeProductModal) {
    closeProductModal.addEventListener("click", () => {
      const modal = document.getElementById("productModal");
      if (modal) modal.classList.add("hidden");
    });
  }

  const closeProductFormModal = document.getElementById("closeProductFormModal");
  if (closeProductFormModal) {
    closeProductFormModal.addEventListener("click", closeProductFormModal);
  }

  // Product form
  const addProductBtn = document.getElementById("addProductBtn");
  if (addProductBtn) addProductBtn.addEventListener("click", () => showProductForm());
  
  const productForm = document.getElementById("productForm");
  if (productForm) {
    productForm.addEventListener("submit", e => {
      e.preventDefault();
      saveProductToFirebase();
    });
  }
  
  const cancelProductForm = document.getElementById("cancelProductForm");
  if (cancelProductForm) cancelProductForm.addEventListener("click", closeProductFormModal);
  
  const deleteProductBtn = document.getElementById("deleteProductBtn");
  if (deleteProductBtn) deleteProductBtn.addEventListener("click", deleteProductFromFirebase);

  // Close modals on backdrop click
  const adminModal = document.getElementById("adminModal");
  if (adminModal) {
    adminModal.addEventListener("click", e => {
      if (e.target.id === "adminModal") {
        adminModal.classList.add("hidden");
      }
    });
  }

  const productModal = document.getElementById("productModal");
  if (productModal) {
    productModal.addEventListener("click", e => {
      if (e.target.id === "productModal") {
        productModal.classList.add("hidden");
      }
    });
  }

  const productFormModal = document.getElementById("productFormModal");
  if (productFormModal) {
    productFormModal.addEventListener("click", e => {
      if (e.target.id === "productFormModal") {
        closeProductFormModal();
      }
    });
  }
}

// Make functions globally available for inline handlers
window.editProduct = editProduct;
window.toggleProductStatus = toggleProductStatus;