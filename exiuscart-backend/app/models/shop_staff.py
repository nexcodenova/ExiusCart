from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class ShopRole(Base):
    """A role the STORE OWNER creates and names themselves ("Warehouse",
    "Support desk", "Junior manager"...) by ticking which permissions it
    carries. Nothing about roles is hardcoded in the app - the only fixed
    thing is the catalog of permissions a role can be built from (see
    app/core/shop_access.py PERMISSION_AREAS).

    permissions is a list of "<area>.<level>" strings, e.g.
    ["orders.view", "orders.manage", "customers.view"]. "manage" implies
    "view" for the same area, so a role that has only "orders.manage" can
    still read orders."""
    __tablename__ = "shop_roles"
    __table_args__ = (UniqueConstraint("shop_id", "name", name="uq_shop_roles_shop_name"),)

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(60), nullable=False)
    description = Column(String(200), nullable=True)
    permissions = Column(JSONB, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    members = relationship("ShopStaff", back_populates="role")


class ShopStaff(Base):
    """A person the store owner has invited to help run one shop. The
    owner is NOT a row here - ownership stays Shop.owner_id, and always
    means every permission.

    status: invited (email sent, not accepted yet - user_id is NULL until
    then) | active | suspended (kept on the team but locked out until the
    owner reactivates them). Removing someone deletes the row."""
    __tablename__ = "shop_staff"
    __table_args__ = (UniqueConstraint("shop_id", "email", name="uq_shop_staff_shop_email"),)

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    email = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    # No ON DELETE action (Postgres "NO ACTION"): a role that still has people on
    # it can't be deleted out from under them (the API also checks and returns a
    # readable error), but - unlike RESTRICT, which is checked immediately - it's
    # only enforced at the end of the statement, so deleting a whole store can
    # still cascade through its roles and its team in whatever order it likes.
    role_id = Column(Integer, ForeignKey("shop_roles.id"), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="invited")
    invited_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    invited_at = Column(DateTime(timezone=True), server_default=func.now())
    joined_at = Column(DateTime(timezone=True), nullable=True)

    role = relationship("ShopRole", back_populates="members")
