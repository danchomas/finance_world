from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, Form
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

# Configuration - используем переменные окружения
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./finance.db")
UPLOAD_FOLDER = "uploads/product_images"

# Создаем папку для загрузок если её нет
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app = FastAPI()

# CORS - разрешаем запросы с вашего фронтенда
origins = [
    "http://localhost:3000",
    "http://localhost:8000",
    "https://ваше-приложение.pages.dev",  # Ваш домен Cloudflare
    "https://*.pages.dev"  # Все поддомены pages.dev
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Models
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
    created_at = Column(DateTime, default=func.now())

Base.metadata.create_all(bind=engine)

# Pydantic Models
class CategoryModel(BaseModel):
    id: str
    name: str
    icon: str

class ProductModel(BaseModel):
    id: Optional[str] = None
    name: str
    bank: str
    category: str
    image_url: Optional[str] = None
    description: str
    conditions: str
    url: str
    active: bool
    created_at: Optional[datetime] = None

class Token(BaseModel):
    access_token: str
    token_type: str

# Auth
pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Hardcoded admin credentials (change in production)
ADMIN_EMAIL = "admin@finance.ru"
ADMIN_PASSWORD_HASH = pwd_context.hash("your-admin-password")  # Set a strong password

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
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
    except JWTError:
        raise credentials_exception
    return email

# Endpoints
@app.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    if form_data.username != ADMIN_EMAIL or not pwd_context.verify(form_data.password, ADMIN_PASSWORD_HASH):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": form_data.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/categories", response_model=List[CategoryModel])
def get_categories(db: Session = Depends(get_db)):
    categories = db.query(Category).all()
    if not categories:
        # Create default categories if none exist
        default_categories = [
            Category(id="debit", name="Дебетовые карты", icon="💳"),
            Category(id="credit", name="Кредитные карты", icon="💰"),
            Category(id="deposits", name="Депозиты", icon="🏠"),
            Category(id="investments", name="Инвестиции", icon="📈"),
            Category(id="crypto", name="Криптовалюта", icon="₿"),
            Category(id="sim", name="SIM карты", icon="📱"),
            Category(id="buiseness", name="Регистрация бизнеса", icon="🏢"),
            Category(id="rko", name="РКО", icon="🏦"),
        ]
        db.add_all(default_categories)
        db.commit()
        categories = db.query(Category).all()
    return categories

@app.get("/products", response_model=List[ProductModel])
def get_products(db: Session = Depends(get_db)):
    return db.query(Product).order_by(Product.created_at.desc()).all()

@app.post("/products", response_model=ProductModel)
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
    product = Product(
        id=str(uuid.uuid4()),
        name=name,
        bank=bank,
        category=category,
        description=description,
        conditions=conditions,
        url=url,
        active=active
    )
    if file:
        file_path = os.path.join(UPLOAD_FOLDER, f"{product.id}.{file.filename.split('.')[-1]}")
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        product.image_url = f"/{file_path}"
    db.add(product)
    db.commit()
    db.refresh(product)
    return product

@app.put("/products/{product_id}", response_model=ProductModel)
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
    product.name = name
    product.bank = bank
    product.category = category
    product.description = description
    product.conditions = conditions
    product.url = url
    product.active = active
    if file:
        file_path = os.path.join(UPLOAD_FOLDER, f"{product.id}.{file.filename.split('.')[-1]}")
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        product.image_url = f"/{file_path}"
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
    if product.image_url:
        try:
            os.remove(product.image_url.lstrip("/"))
        except OSError:
            pass
    db.delete(product)
    db.commit()
    return {"message": "Product deleted"}

# Serve static files
app.mount("/", StaticFiles(directory=".", html=True), name="static")
app.mount("/uploads", StaticFiles(directory=UPLOAD_FOLDER), name="uploads")

# To run: uvicorn main:app --reload