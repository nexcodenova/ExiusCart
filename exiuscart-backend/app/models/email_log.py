from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.core.database import Base


class EmailLog(Base):
    __tablename__ = "email_logs"
    id = Column(Integer, primary_key=True, index=True)
    recipient = Column(String(200), nullable=True)
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
