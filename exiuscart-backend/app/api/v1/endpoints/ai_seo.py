"""AI-Powered SEO endpoints — product descriptions, meta tags, keyword research, blog ideas."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.shop import Shop
from app.models.product import Product
from app.api.v1.deps import get_current_user
import anthropic
import os
import json

router = APIRouter()
CLAUDE_MODEL = "claude-haiku-4-5-20251001"  # Fast + cheap for SEO generation


def _shop(shop_id: int, user: User, db: Session) -> Shop:
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


def _ai_client():
    key = os.getenv("ANTHROPIC_API_KEY", "")
    if not key:
        raise HTTPException(status_code=503, detail="AI service not configured. Add ANTHROPIC_API_KEY to environment.")
    return anthropic.Anthropic(api_key=key)


# ── Product Description Generator ─────────────────────────────────────────────

@router.post("/shops/{shop_id}/ai/product-description")
def generate_product_description(
    shop_id: int, body: dict,
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Generate SEO-optimised product description from product name + details."""
    _shop(shop_id, current_user, db)
    product_name = body.get("product_name", "").strip()
    category = body.get("category", "")
    key_features = body.get("key_features", "")
    target_audience = body.get("target_audience", "shoppers")
    tone = body.get("tone", "professional")  # professional, casual, luxury, technical
    language = body.get("language", "English")

    if not product_name:
        raise HTTPException(status_code=400, detail="product_name is required")

    client = _ai_client()
    prompt = f"""You are an expert e-commerce SEO copywriter. Generate a compelling, SEO-optimised product description.

Product: {product_name}
Category: {category or "General"}
Key Features: {key_features or "Not specified"}
Target Audience: {target_audience}
Tone: {tone}
Language: {language}

Generate:
1. A short SEO title (60 chars max, include main keyword naturally)
2. A meta description (155 chars max, include call-to-action)
3. A full product description (150-250 words, naturally include 3-5 SEO keywords, highlight benefits not just features, end with a call to action)
4. 5 relevant SEO keywords/tags for this product

Respond in this exact JSON format:
{{
  "seo_title": "...",
  "meta_description": "...",
  "description": "...",
  "keywords": ["...", "...", "...", "...", "..."]
}}"""

    message = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=800,
        messages=[{"role": "user", "content": prompt}]
    )
    raw = message.content[0].text.strip()
    # Extract JSON from response
    start = raw.find("{"); end = raw.rfind("}") + 1
    result = json.loads(raw[start:end]) if start != -1 else {"description": raw, "seo_title": product_name, "meta_description": "", "keywords": []}
    return result


# ── Meta Tags Generator ────────────────────────────────────────────────────────

@router.post("/shops/{shop_id}/ai/meta-tags")
def generate_meta_tags(
    shop_id: int, body: dict,
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Generate complete SEO meta tags for a page or product."""
    _shop(shop_id, current_user, db)
    page_title = body.get("page_title", "").strip()
    page_type = body.get("page_type", "product")  # product, category, homepage, blog
    content_summary = body.get("content_summary", "")
    business_name = body.get("business_name", "")

    if not page_title:
        raise HTTPException(status_code=400, detail="page_title is required")

    client = _ai_client()
    prompt = f"""Generate complete SEO meta tags for an e-commerce page.

Page Title: {page_title}
Page Type: {page_type}
Content Summary: {content_summary or "Not provided"}
Business Name: {business_name or "Online Store"}

Generate all necessary meta tags in this JSON format:
{{
  "title_tag": "...",
  "meta_description": "...",
  "og_title": "...",
  "og_description": "...",
  "twitter_title": "...",
  "twitter_description": "...",
  "focus_keyword": "...",
  "secondary_keywords": ["...", "...", "..."],
  "schema_type": "Product|WebPage|BlogPosting",
  "canonical_slug": "...",
  "seo_score_tips": ["tip1", "tip2", "tip3"]
}}"""

    message = client.messages.create(
        model=CLAUDE_MODEL, max_tokens=700,
        messages=[{"role": "user", "content": prompt}]
    )
    raw = message.content[0].text.strip()
    start = raw.find("{"); end = raw.rfind("}") + 1
    return json.loads(raw[start:end]) if start != -1 else {"raw": raw}


# ── Keyword Research ───────────────────────────────────────────────────────────

@router.post("/shops/{shop_id}/ai/keywords")
def generate_keywords(
    shop_id: int, body: dict,
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Generate keyword strategy for a product or category."""
    _shop(shop_id, current_user, db)
    topic = body.get("topic", "").strip()
    industry = body.get("industry", "e-commerce")
    target_region = body.get("target_region", "UAE")

    if not topic:
        raise HTTPException(status_code=400, detail="topic is required")

    client = _ai_client()
    prompt = f"""You are an SEO keyword research expert for e-commerce businesses.

Topic: {topic}
Industry: {industry}
Target Region: {target_region}

Generate a comprehensive keyword strategy in this JSON format:
{{
  "primary_keyword": "...",
  "secondary_keywords": ["...", "...", "...", "...", "..."],
  "long_tail_keywords": ["...", "...", "...", "...", "..."],
  "question_keywords": ["...", "...", "..."],
  "local_keywords": ["...", "...", "..."],
  "negative_keywords": ["...", "..."],
  "content_ideas": [
    {{"title": "...", "type": "blog|product-page|category-page", "target_keyword": "..."}},
    {{"title": "...", "type": "blog|product-page|category-page", "target_keyword": "..."}},
    {{"title": "...", "type": "blog|product-page|category-page", "target_keyword": "..."}}
  ]
}}"""

    message = client.messages.create(
        model=CLAUDE_MODEL, max_tokens=900,
        messages=[{"role": "user", "content": prompt}]
    )
    raw = message.content[0].text.strip()
    start = raw.find("{"); end = raw.rfind("}") + 1
    return json.loads(raw[start:end]) if start != -1 else {"raw": raw}


# ── Blog Post Generator ────────────────────────────────────────────────────────

@router.post("/shops/{shop_id}/ai/blog-post")
def generate_blog_post(
    shop_id: int, body: dict,
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Generate a full SEO blog post outline + intro."""
    _shop(shop_id, current_user, db)
    topic = body.get("topic", "").strip()
    target_keyword = body.get("target_keyword", "")
    word_count = min(int(body.get("word_count", 800)), 2000)
    business_name = body.get("business_name", "")

    if not topic:
        raise HTTPException(status_code=400, detail="topic is required")

    client = _ai_client()
    prompt = f"""You are an expert SEO content writer for e-commerce businesses. Write a full, publish-ready blog post.

Topic: {topic}
Target Keyword: {target_keyword or topic}
Target Word Count: {word_count} words
Business: {business_name or "Online Store"}

Write a complete blog post with:
- SEO-optimised H1 title (include target keyword)
- Meta description (155 chars)
- Introduction (hook the reader, include keyword in first 100 words)
- 4-6 H2 sections with content
- Conclusion with call-to-action
- Natural keyword placement throughout

Respond in JSON:
{{
  "title": "...",
  "meta_description": "...",
  "slug": "...",
  "estimated_read_time": "X min",
  "focus_keyword": "...",
  "content": "... (full markdown blog post) ...",
  "internal_link_suggestions": ["...", "..."],
  "tags": ["...", "...", "...", "..."]
}}"""

    message = client.messages.create(
        model=CLAUDE_MODEL, max_tokens=2500,
        messages=[{"role": "user", "content": prompt}]
    )
    raw = message.content[0].text.strip()
    start = raw.find("{"); end = raw.rfind("}") + 1
    return json.loads(raw[start:end]) if start != -1 else {"content": raw}


# ── Bulk Product SEO Audit ─────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/ai/seo-audit")
def seo_audit_products(
    shop_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Audit all products for SEO issues — missing descriptions, short titles, no keywords."""
    _shop(shop_id, current_user, db)
    products = db.query(Product).filter(Product.shop_id == shop_id).all()

    issues = []
    score_total = 0
    for p in products:
        product_issues = []
        score = 100
        name = p.name or ""
        desc = getattr(p, "description", "") or ""
        sku = p.sku or ""

        if len(name) < 20:
            product_issues.append("Title too short (< 20 chars) — add more descriptive keywords")
            score -= 20
        if len(name) > 70:
            product_issues.append("Title too long (> 70 chars) — may be truncated in search results")
            score -= 10
        if not desc:
            product_issues.append("No product description — add 100-250 word SEO description")
            score -= 30
        elif len(desc) < 100:
            product_issues.append("Description too short (< 100 chars) — expand with features and benefits")
            score -= 20
        if not sku:
            product_issues.append("No SKU — add unique identifier for inventory tracking")
            score -= 10
        if not getattr(p, "image", None):
            product_issues.append("No product image — images increase click-through rates by 30%+")
            score -= 10

        score = max(0, score)
        score_total += score
        issues.append({
            "product_id": p.id,
            "product_name": p.name,
            "seo_score": score,
            "issues": product_issues,
            "status": "good" if score >= 80 else "needs_work" if score >= 50 else "poor"
        })

    avg_score = round(score_total / len(products)) if products else 0
    return {
        "total_products": len(products),
        "average_seo_score": avg_score,
        "products_good": sum(1 for i in issues if i["status"] == "good"),
        "products_needs_work": sum(1 for i in issues if i["status"] == "needs_work"),
        "products_poor": sum(1 for i in issues if i["status"] == "poor"),
        "products": sorted(issues, key=lambda x: x["seo_score"]),
    }


# ── AI Product Title Optimizer ─────────────────────────────────────────────────

@router.post("/shops/{shop_id}/ai/optimize-titles")
def optimize_product_titles(
    shop_id: int, body: dict,
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Batch optimize product titles for SEO."""
    _shop(shop_id, current_user, db)
    titles = body.get("titles", [])  # List of {"id": x, "title": "..."}
    if not titles:
        raise HTTPException(status_code=400, detail="titles array required")
    titles = titles[:20]  # Limit to 20 at a time

    client = _ai_client()
    titles_text = "\n".join([f"{i+1}. {t['title']}" for i, t in enumerate(titles)])
    prompt = f"""Optimize these e-commerce product titles for SEO. Make each title:
- 40-60 characters
- Include the main product keyword naturally
- Mention key differentiators (size, color, material, brand if applicable)
- Avoid keyword stuffing
- Be specific and descriptive

Original titles:
{titles_text}

Respond in JSON array format:
[
  {{"original": "...", "optimized": "...", "reason": "..."}},
  ...
]"""

    message = client.messages.create(
        model=CLAUDE_MODEL, max_tokens=800,
        messages=[{"role": "user", "content": prompt}]
    )
    raw = message.content[0].text.strip()
    start = raw.find("["); end = raw.rfind("]") + 1
    suggestions = json.loads(raw[start:end]) if start != -1 else []
    return {"suggestions": suggestions}
