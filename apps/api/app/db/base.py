from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def repr_record(record):
    """Create a readable string representation of a SQLAlchemy model instance."""
    fields = {column.name: getattr(record, column.name) for column in record.__table__.columns}
    fields_str = ", ".join(f"{key}={value!r}" for key, value in fields.items())
    return f"<{record.__class__.__name__}({fields_str})>"


def _base_repr(self):
    return repr_record(self)


Base.__repr__ = _base_repr


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
