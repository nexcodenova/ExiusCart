from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class JobPosition(Base):
    __tablename__ = "job_positions"
    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    title = Column(String(255), nullable=False)
    department = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    requirements = Column(Text, nullable=True)
    employment_type = Column(String(30), default="full_time")
    location = Column(String(255), nullable=True)
    is_remote = Column(Boolean, default=False)
    status = Column(String(20), default="open")  # open | closed | on_hold
    applicant_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    applicants = relationship("Applicant", back_populates="job_position", cascade="all, delete-orphan")


class Applicant(Base):
    __tablename__ = "applicants"
    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    job_position_id = Column(Integer, ForeignKey("job_positions.id"), nullable=False)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(30), nullable=True)
    stage = Column(String(30), default="new")  # new | screening | interview | offer | hired | rejected
    resume_url = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)
    applied_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    job_position = relationship("JobPosition", back_populates="applicants")
