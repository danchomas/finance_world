from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, Form, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Boolean, Text, DateTime, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
import uuid
import os
import shutil
from typing import List, Optional
from dotenv import load_dotenv

# Загрузка переменных окружения
load_dotenv()

# Конфигурация
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Настройка базы данных для Railway
DATABASE_URL = os.getenv("DATABASE_URL")

# Для Railway
if not DATABASE_URL:
    # Если нет DATABASE_URL, используем локальный PostgreSQL для разработки
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_NAME = os.getenv("DB_NAME", "finance_world")
    DB_USER = os.getenv("DB_USER", "postgres")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
    
    DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# PostgreSQL требует postgresql:// вместо postgres://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

print(f"📊 DATABASE_URL настроен")

# Папка для загрузок (временная, для Railway лучше использовать S3)
UPLOAD_FOLDER = "/tmp/uploads/product_images"  # Используем /tmp для Railway
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app = FastAPI(title="Finance World API", version="1.0.0")

# РАСШИРЕННЫЕ CORS настройки для Cloudflare Pages
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "*",  # Для начала разрешим все, потом настроим конкретные домены
        "http://localhost:3000",
        "http://localhost:5500",
        "http://localhost:8080",
        "https://*.pages.dev",  # Cloudflare Pages
        "https://*.finance-world.online",  # Ваш домен
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Middleware для добавления CORS заголовков
@app.middleware("http")
async def add_cors_headers(request: Request, call_next):
    response = await call_next(request)
    
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Expose-Headers"] = "*"
    
    return response

# База данных
engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=300)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Модели базы данных
class Category(Base):
    __tablename__ = "categories"
    
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    icon = Column(String, nullable=False)

class Product(Base):
    __tablename__ = "products"
    
    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    bank = Column(String, nullable=False)
    category = Column(String, nullable=False)
    image_url = Column(String, nullable=True)
    description = Column(Text, nullable=False)
    conditions = Column(Text, nullable=False)
    url = Column(String, nullable=False)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

# Создание таблиц при старте
@app.on_event("startup")
def startup_event():
    try:
        print("🔄 Создание таблиц в базе данных...")
        Base.metadata.create_all(bind=engine)
        print("✅ Таблицы созданы успешно")
        
        # Создаем дефолтные категории если их нет
        db = SessionLocal()
        try:
            if db.query(Category).count() == 0:
                print("📋 Добавление дефолтных категорий...")
                default_categories = [
                    Category(id="debit", name="Дебетовые карты", icon="💳"),
                    Category(id="credit", name="Кредитные карты", icon="💰"),
                    Category(id="sim", name="SIM карты", icon="📱"),
                    Category(id="ip", name="ИП", icon="👨‍💼"),
                    Category(id="rko", name="РКО", icon="🏦"),
                ]
                db.add_all(default_categories)
                db.commit()
                print(f"✅ Добавлено {len(default_categories)} категорий")
                
            # Проверяем, есть ли админ в базе
            print(f"📊 Всего категорий в базе: {db.query(Category).count()}")
            print(f"📊 Всего продуктов в базе: {db.query(Product).count()}")
        except Exception as e:
            print(f"⚠️  Ошибка при добавлении категорий: {e}")
            db.rollback()
        finally:
            db.close()
    except Exception as e:
        print(f"❌ Ошибка при создании таблиц: {e}")

# Pydantic модели
class CategoryCreate(BaseModel):
    id: str
    name: str
    icon: str

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None

class CategoryResponse(BaseModel):
    id: str
    name: str
    icon: str
    
    class Config:
        from_attributes = True

class ProductCreate(BaseModel):
    name: str
    bank: str
    category: str
    description: str
    conditions: str
    url: str
    active: bool = True

class ProductResponse(BaseModel):
    id: str
    name: str
    bank: str
    category: str
    image_url: Optional[str] = None
    description: str
    conditions: str
    url: str
    active: bool
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# Аутентификация
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Админские учетные данные
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@finance.ru")
ADMIN_PASSWORD_HASH = pwd_context.hash(os.getenv("ADMIN_PASSWORD", "admin123"))

# Зависимости
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def authenticate_admin(email: str, password: str):
    if email != ADMIN_EMAIL:
        return False
    if not verify_password(password, ADMIN_PASSWORD_HASH):
        return False
    return True

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        return email
    except JWTError:
        raise credentials_exception

# Эндпоинты
@app.get("/")
async def root():
    return {
        "message": "Finance World API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }

@app.get("/health")
async def health_check(db: Session = Depends(get_db)):
    try:
        # Проверка подключения к базе
        db.execute("SELECT 1")
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"
    
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "database": db_status,
        "total_categories": db.query(Category).count(),
        "total_products": db.query(Product).count()
    }

@app.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    if not authenticate_admin(form_data.username, form_data.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": form_data.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

# Категории - CRUD операции
@app.get("/categories", response_model=List[CategoryResponse])
def get_categories(db: Session = Depends(get_db)):
    categories = db.query(Category).all()
    if not categories:
        # Если по какой-то причине категорий нет, создаем дефолтные
        default_categories = [
            {"id": "debit", "name": "Дебетовые карты", "icon": "💳"},
            {"id": "credit", "name": "Кредитные карты", "icon": "💰"},
            {"id": "sim", "name": "SIM карты", "icon": "📱"},
            {"id": "ip", "name": "ИП", "icon": "👨‍💼"},
            {"id": "rko", "name": "РКО", "icon": "🏦"},
        ]
        
        for cat_data in default_categories:
            category = Category(**cat_data)
            db.add(category)
        
        db.commit()
        categories = db.query(Category).all()
    
    return categories

@app.get("/categories/{category_id}", response_model=CategoryResponse)
def get_category(category_id: str, db: Session = Depends(get_db)):
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category

@app.post("/categories", response_model=CategoryResponse)
def create_category(
    category: CategoryCreate,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Проверяем, существует ли уже категория с таким ID
    existing_category = db.query(Category).filter(Category.id == category.id).first()
    if existing_category:
        raise HTTPException(status_code=400, detail="Category with this ID already exists")
    
    db_category = Category(**category.dict())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    
    return db_category

@app.put("/categories/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: str,
    category_update: CategoryUpdate,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Обновляем только указанные поля
    update_data = category_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(category, field, value)
    
    db.commit()
    db.refresh(category)
    
    return category

@app.delete("/categories/{category_id}")
def delete_category(
    category_id: str,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Проверяем, есть ли продукты в этой категории
    products_count = db.query(Product).filter(Product.category == category_id).count()
    if products_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete category. There are {products_count} products in this category."
        )
    
    db.delete(category)
    db.commit()
    
    return {"message": "Category deleted successfully"}

# Продукты - CRUD операции
@app.get("/products", response_model=List[ProductResponse])
def get_products(db: Session = Depends(get_db)):
    return db.query(Product).order_by(Product.created_at.desc()).all()

@app.get("/products/{product_id}", response_model=ProductResponse)
def get_product(product_id: str, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@app.post("/products", response_model=ProductResponse)
async def create_product(
    name: str = Form(...),
    bank: str = Form(...),
    category: str = Form(...),
    description: str = Form(...),
    conditions: str = Form(...),
    url: str = Form(...),
    active: bool = Form(True),
    file: Optional[UploadFile] = File(None),
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Проверяем, существует ли категория
    category_exists = db.query(Category).filter(Category.id == category).first()
    if not category_exists:
        raise HTTPException(status_code=400, detail=f"Category '{category}' does not exist")
    
    product_id = str(uuid.uuid4())
    product = Product(
        id=product_id,
        name=name,
        bank=bank,
        category=category,
        description=description,
        conditions=conditions,
        url=url,
        active=active
    )
    
    if file and file.filename:
        # Генерируем уникальное имя файла
        file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
        filename = f"{product_id}.{file_extension}"
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        
        # Сохраняем файл
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Сохраняем URL файла
        product.image_url = f"/uploads/product_images/{filename}"
    
    db.add(product)
    db.commit()
    db.refresh(product)
    
    return product

@app.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: str,
    name: str = Form(...),
    bank: str = Form(...),
    category: str = Form(...),
    description: str = Form(...),
    conditions: str = Form(...),
    url: str = Form(...),
    active: bool = Form(...),
    file: Optional[UploadFile] = File(None),
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Проверяем, существует ли новая категория
    category_exists = db.query(Category).filter(Category.id == category).first()
    if not category_exists:
        raise HTTPException(status_code=400, detail=f"Category '{category}' does not exist")
    
    product.name = name
    product.bank = bank
    product.category = category
    product.description = description
    product.conditions = conditions
    product.url = url
    product.active = active
    
    if file and file.filename:
        # Удаляем старое изображение, если есть
        if product.image_url:
            old_file_path = product.image_url.lstrip("/")
            if os.path.exists(old_file_path):
                os.remove(old_file_path)
        
        # Генерируем уникальное имя файла
        file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
        filename = f"{product_id}.{file_extension}"
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        
        # Сохраняем файл
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Сохраняем URL файла
        product.image_url = f"/uploads/product_images/{filename}"
    
    db.commit()
    db.refresh(product)
    
    return product

@app.delete("/products/{product_id}")
async def delete_product(
    product_id: str,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Удаляем файл изображения, если есть
    if product.image_url:
        file_path = product.image_url.lstrip("/")
        if os.path.exists(file_path):
            os.remove(file_path)
    
    db.delete(product)
    db.commit()
    
    return {"message": "Product deleted successfully"}

@app.get("/stats")
async def get_stats(db: Session = Depends(get_db)):
    total_products = db.query(func.count(Product.id)).scalar()
    active_products = db.query(func.count(Product.id)).filter(Product.active == True).scalar()
    total_categories = db.query(func.count(Category.id)).scalar()
    
    # Количество продуктов по категориям
    categories_stats = db.query(
        Category.id, 
        Category.name, 
        func.count(Product.id).label("product_count")
    ).join(Product, Category.id == Product.category, isouter=True)\
     .group_by(Category.id, Category.name).all()
    
    return {
        "total_products": total_products,
        "active_products": active_products,
        "inactive_products": total_products - active_products,
        "total_categories": total_categories,
        "categories": [
            {"id": cat.id, "name": cat.name, "product_count": cat.product_count} 
            for cat in categories_stats
        ]
    }

# Static files для загруженных изображений
from fastapi.staticfiles import StaticFiles
app.mount("/uploads", StaticFiles(directory=UPLOAD_FOLDER), name="uploads")

# Для локального запуска
if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 8000))
    print(f"🚀 Запуск Finance World API на порту {port}")
    print(f"📚 Документация: http://localhost:{port}/docs")
    print(f"🔧 CORS настроены для всех доменов")
    print(f"🌐 Health check: http://localhost:{port}/health")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True
    )