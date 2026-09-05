from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from sqlalchemy.sql import func
from app.core.database import Base


class Testimonial(Base):
    """A customer testimonial shown on exiuscart.com's homepage — either
    added directly by admin (is_approved=True immediately, source='admin')
    or submitted through the public /review form (is_approved=False until
    an admin reviews it, source='public'). Only approved rows are ever
    returned by the public API; the homepage never sees pending ones."""
    __tablename__ = "testimonials"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(200), nullable=False)
    # e.g. "Sri Lankan Fashion Marketplace · Sri Lanka" — shown under the name
    subtitle = Column(String(300), nullable=True)
    quote_text = Column(Text, nullable=False)
    rating = Column(Integer, nullable=False, default=5)
    # Optional real person name — falls back to company_name's initials for
    # the avatar circle if left blank (matches the existing card design).
    reviewer_name = Column(String(200), nullable=True)
    # Only collected on public submissions, for admin to follow up — never
    # shown on the public site.
    submitter_email = Column(String(255), nullable=True)
    is_approved = Column(Boolean, default=False, nullable=False)
    source = Column(String(20), default="admin", nullable=False)  # "admin" | "public"
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
