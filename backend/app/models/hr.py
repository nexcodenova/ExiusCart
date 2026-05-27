from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Numeric, Text, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(255), nullable=False)
    position = Column(String(100), nullable=True)
    department = Column(String(100), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(30), nullable=True)
    national_id = Column(String(50), nullable=True)
    join_date = Column(Date, nullable=True)
    basic_salary = Column(Numeric(10, 2), default=0)
    allowances = Column(Numeric(10, 2), default=0)   # housing, transport, etc.
    currency = Column(String(10), default="AED")
    employment_type = Column(String(20), default="full_time")  # full_time | part_time | contract
    status = Column(String(20), default="active")  # active | inactive | terminated
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # FK
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)

    # Relationships
    payroll_records = relationship("PayrollRecord", back_populates="employee")
    leave_requests  = relationship("LeaveRequest",  back_populates="employee")


class PayrollRecord(Base):
    __tablename__ = "payroll_records"

    id = Column(Integer, primary_key=True, index=True)
    month = Column(String(7), nullable=False)   # YYYY-MM
    basic_salary = Column(Numeric(10, 2), nullable=False)
    allowances = Column(Numeric(10, 2), default=0)
    deductions = Column(Numeric(10, 2), default=0)
    bonus = Column(Numeric(10, 2), default=0)
    net_salary = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(10), default="AED")
    status = Column(String(20), default="draft")   # draft | paid
    paid_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # FKs
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)

    employee = relationship("Employee", back_populates="payroll_records")


class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id = Column(Integer, primary_key=True, index=True)
    leave_type = Column(String(30), default="annual")  # annual | sick | unpaid | emergency
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    days = Column(Integer, default=1)
    reason = Column(Text, nullable=True)
    status = Column(String(20), default="pending")  # pending | approved | rejected
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # FKs
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)

    employee = relationship("Employee", back_populates="leave_requests")
