import os

# main.py creates tables and runs the hand-maintained migration list against
# `engine` the moment it's imported — so DATABASE_URL must point at the
# disposable test database BEFORE anything under `app` gets imported below,
# never the real dev/production database.
os.environ["DATABASE_URL"] = os.getenv(
    "TEST_DATABASE_URL", "postgresql://postgres:test@localhost:5433/exiuscart_test"
)
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-not-for-production")

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
import app.models  # noqa: F401 — registers every model on Base.metadata

engine = create_engine(os.environ["DATABASE_URL"])


@pytest.fixture(scope="session", autouse=True)
def _schema():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db():
    """A real Postgres session scoped to one test — rolled back afterward so
    tests never leak data into each other."""
    connection = engine.connect()
    transaction = connection.begin()
    session = sessionmaker(bind=connection)()
    yield session
    session.close()
    if transaction.is_active:
        transaction.rollback()
    connection.close()


@pytest.fixture(autouse=True)
def _no_real_emails(monkeypatch):
    """Every send_* email function becomes a no-op during tests — a test
    exercising real business logic should never trigger a real email."""
    import app.core.email as email_module
    for name in dir(email_module):
        if name.startswith("send_"):
            monkeypatch.setattr(email_module, name, lambda *a, **k: None)
