from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), default="active")   # active | completed | on_hold | cancelled
    deadline = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")


class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    stage = Column(String(30), default="todo")    # todo | in_progress | review | done
    priority = Column(String(20), default="normal")  # low | normal | high | urgent
    assigned_to = Column(String(255), nullable=True)
    due_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="tasks")


class HelpdeskTicket(Base):
    __tablename__ = "helpdesk_tickets"
    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    ticket_number = Column(String(20), nullable=False)
    subject = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    customer_name = Column(String(255), nullable=True)
    customer_email = Column(String(255), nullable=True)
    customer_phone = Column(String(30), nullable=True)
    priority = Column(String(20), default="normal")  # low | normal | high | urgent
    status = Column(String(20), default="open")      # open | in_progress | resolved | closed
    assigned_to = Column(String(255), nullable=True)
    resolution = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)


class Appointment(Base):
    __tablename__ = "appointments"
    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    title = Column(String(255), nullable=False)
    customer_name = Column(String(255), nullable=True)
    customer_phone = Column(String(30), nullable=True)
    customer_email = Column(String(255), nullable=True)
    start_datetime = Column(DateTime(timezone=True), nullable=False)
    end_datetime = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String(20), default="scheduled")  # scheduled | completed | cancelled | no_show
    assigned_to = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
