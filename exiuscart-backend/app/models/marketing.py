from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Numeric, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class EmailCampaign(Base):
    __tablename__ = "email_campaigns"
    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    name = Column(String(255), nullable=False)
    subject = Column(String(500), nullable=False)
    body_html = Column(Text, nullable=True)
    status = Column(String(20), default="draft")  # draft | sent | scheduled
    recipients_count = Column(Integer, default=0)
    opened_count = Column(Integer, default=0)
    clicked_count = Column(Integer, default=0)
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SMSCampaign(Base):
    __tablename__ = "sms_campaigns"
    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    name = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String(20), default="draft")  # draft | sent | scheduled
    recipients_count = Column(Integer, default=0)
    delivered_count = Column(Integer, default=0)
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    location = Column(String(500), nullable=True)
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=True)
    capacity = Column(Integer, nullable=True)
    registration_count = Column(Integer, default=0)
    is_online = Column(Boolean, default=False)
    meeting_url = Column(String(500), nullable=True)
    status = Column(String(20), default="upcoming")  # upcoming | ongoing | completed | cancelled
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Survey(Base):
    __tablename__ = "surveys"
    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), default="draft")  # draft | active | closed
    response_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    questions = relationship("SurveyQuestion", back_populates="survey", cascade="all, delete-orphan")


class SurveyQuestion(Base):
    __tablename__ = "survey_questions"
    id = Column(Integer, primary_key=True, index=True)
    survey_id = Column(Integer, ForeignKey("surveys.id"), nullable=False)
    question_text = Column(Text, nullable=False)
    question_type = Column(String(30), default="text")  # text | multiple_choice | rating | yes_no
    options = Column(JSON, nullable=True)  # list of strings for multiple_choice
    is_required = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)

    survey = relationship("Survey", back_populates="questions")
