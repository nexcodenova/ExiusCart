from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Numeric, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class ShopLead(Base):
    __tablename__ = "shop_leads"
    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(30), nullable=True)
    company = Column(String(255), nullable=True)
    source = Column(String(50), default="manual")  # manual | website | meta_ads | whatsapp | referral
    status = Column(String(30), default="new")     # new | contacted | qualified | converted | lost
    notes = Column(Text, nullable=True)
    value = Column(Numeric(12, 2), nullable=True)
    assigned_to = Column(String(255), nullable=True)
    last_contacted_at = Column(DateTime(timezone=True), nullable=True)
    score = Column(Integer, default=0, nullable=False)
    score_breakdown = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class DripFlow(Base):
    __tablename__ = "drip_flows"
    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    trigger_type = Column(String(50), nullable=False)
    # lead_created | status_changed | score_above | no_activity_days
    trigger_config = Column(JSON, nullable=True)
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    steps = relationship("DripFlowStep", back_populates="flow", cascade="all, delete-orphan",
                         order_by="DripFlowStep.sort_order")
    enrollments = relationship("DripFlowEnrollment", back_populates="flow", cascade="all, delete-orphan")


class DripFlowStep(Base):
    __tablename__ = "drip_flow_steps"
    id = Column(Integer, primary_key=True, index=True)
    flow_id = Column(Integer, ForeignKey("drip_flows.id", ondelete="CASCADE"), nullable=False)
    sort_order = Column(Integer, default=0)
    step_type = Column(String(30), nullable=False)
    # wait | send_email | send_whatsapp | update_status
    config = Column(JSON, nullable=False, default=dict)
    # wait:          {"hours": 24}
    # send_email:    {"subject": "...", "body_html": "..."}
    # send_whatsapp: {"message": "Hi {name}, ..."}
    # update_status: {"status": "contacted"}
    flow = relationship("DripFlow", back_populates="steps")


class DripFlowEnrollment(Base):
    __tablename__ = "drip_flow_enrollments"
    id = Column(Integer, primary_key=True, index=True)
    flow_id = Column(Integer, ForeignKey("drip_flows.id", ondelete="CASCADE"), nullable=False)
    lead_id = Column(Integer, ForeignKey("shop_leads.id", ondelete="CASCADE"), nullable=False)
    shop_id = Column(Integer, nullable=False)
    current_step_order = Column(Integer, default=0)
    status = Column(String(20), default="active")  # active | completed | paused | failed
    next_run_at = Column(DateTime(timezone=True), nullable=True)
    enrolled_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    steps_completed = Column(Integer, default=0)
    emails_sent = Column(Integer, default=0)
    flow = relationship("DripFlow", back_populates="enrollments")
    lead = relationship("ShopLead")


class EmailCampaign(Base):
    __tablename__ = "email_campaigns"
    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    name = Column(String(255), nullable=False)
    subject = Column(String(500), nullable=False)
    body_html = Column(Text, nullable=True)
    # The builder's own field values (heading, colors, font, etc.) — kept
    # alongside body_html so re-opening a saved campaign can restore the
    # editable fields instead of just a rendered HTML blob.
    builder_fields = Column(JSON, nullable=True)
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
