import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

logger = logging.getLogger("pharma.database")

def create_db_engine():
    db_url = settings.DATABASE_URL
    # Ensure postgresql:// uses psycopg2 driver if no driver specified
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

    try:
        # Check if Postgres or SQLite
        if db_url.startswith("sqlite"):
            engine = create_engine(db_url, connect_args={"check_same_thread": False})
            logger.info(f"Connected to database: {db_url}")
            return engine
        else:
            # Try connecting to PostgreSQL
            engine = create_engine(
                db_url,
                pool_pre_ping=True,
                pool_size=10,
                max_overflow=20
            )
            # Test connection
            with engine.connect() as conn:
                pass
            logger.info("Successfully connected to PostgreSQL database")
            return engine
    except Exception as e:
        if settings.ENABLE_SQLITE_FALLBACK:
            logger.warning(
                f"PostgreSQL connection failed ({e}). Falling back to SQLite: {settings.SQLITE_FALLBACK_URL}"
            )
            return create_engine(
                settings.SQLITE_FALLBACK_URL, 
                connect_args={"check_same_thread": False}
            )
        else:
            raise e

engine = create_db_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
