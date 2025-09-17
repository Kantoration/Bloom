"""Database connection and session management"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool
from typing import Generator

from app.core.config import settings


# Create engine with connection pooling
engine = create_engine(
    str(settings.DATABASE_URL),
    pool_pre_ping=True,  # Verify connections before using them
    echo=settings.DEBUG,  # Log SQL queries in debug mode
    poolclass=NullPool if settings.DEBUG else None,  # Disable pooling in debug
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """
    Dependency to get database session.
    Use as FastAPI dependency:
    
    @app.get("/")
    def read_root(db: Session = Depends(get_db)):
        ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Initialize database tables"""
    from app.models.database import Base
    Base.metadata.create_all(bind=engine)


def drop_db() -> None:
    """Drop all database tables (use with caution!)"""
    from app.models.database import Base
    Base.metadata.drop_all(bind=engine)

