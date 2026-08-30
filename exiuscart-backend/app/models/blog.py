from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class BlogPost(Base):
    """A seller's storefront blog post. `content` is rich HTML from the
    same RichTextEditor product descriptions use, with a higher embedded-
    image cap (see BLOG_IMAGE_LIMITS in blog.py) — sized for real articles,
    not a 4-sentence description."""
    __tablename__ = "blog_posts"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)

    title = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False)
    excerpt = Column(String(500), nullable=True)  # short teaser for list/card views
    content = Column(Text, nullable=True)          # rich HTML, embedded images included
    cover_image_url = Column(String(500), nullable=True)

    status = Column(String(20), default="draft")   # draft | published
    published_at = Column(DateTime(timezone=True), nullable=True)

    author_name = Column(String(255), nullable=True)
    tags = Column(String(500), nullable=True)       # comma-separated, same convention as Product.tags

    # Optional call-to-action — e.g. "Shop the Collection" -> /products?category=...
    cta_text = Column(String(100), nullable=True)
    cta_url = Column(String(500), nullable=True)

    view_count = Column(Integer, default=0)

    # Set once a real push succeeds — lets the dashboard show "Also on Shopify"
    # instead of a seller having to guess whether the push actually worked.
    shopify_article_id = Column(String(100), nullable=True)
    shopify_blog_id = Column(String(100), nullable=True)
    # Same role for WooCommerce — WordPress's own wp/v2/posts ID, reused on
    # republish (PUT instead of POST) so a re-push updates the existing
    # post instead of creating a duplicate.
    woocommerce_post_id = Column(String(100), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    shop = relationship("Shop")
