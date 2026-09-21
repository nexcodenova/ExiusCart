"""Removal of the old hidden platform shops."""
import logging

from sqlalchemy import bindparam, text

logger = logging.getLogger(__name__)

HIDDEN_SHOP_SLUGS = ("exiuscart-dropshipping-system", "exiuscart-website", "prodora-website", "affiliate-website")


def purge_hidden_system_shops(engine, base) -> None:
    """Delete the old hidden platform shops for good.

    The plain DELETEs in the startup migrations give up when any table still
    points at a shop, so the shop stayed behind as a leftover row. This clears
    every table that references it (children before parents), then deletes the
    shop. The catalogue rows were detached (shop_id NULL) by those migrations,
    so nothing that belongs to Prodora is touched: only rows still tagged with
    these shops are removed (or, where the column allows it, detached).
    """
    try:
        with engine.connect() as conn:
            rows = conn.execute(
                text("SELECT id FROM shops WHERE slug IN :s").bindparams(bindparam("s", expanding=True)),
                {"s": list(HIDDEN_SHOP_SLUGS)},
            )
            ids = [r[0] for r in rows]
    except Exception as exc:
        logger.warning(f"[purge] could not look up the hidden shops: {exc!r:.120}")
        return
    if not ids:
        return

    for table in reversed(base.metadata.sorted_tables):
        if table.name == "shops":
            continue
        for col in table.columns:
            if not any(fk.column.table.name == "shops" for fk in col.foreign_keys):
                continue
            if col.nullable:
                sql = f'UPDATE "{table.name}" SET "{col.name}" = NULL WHERE "{col.name}" IN :ids'
            else:
                sql = f'DELETE FROM "{table.name}" WHERE "{col.name}" IN :ids'
            try:
                with engine.connect() as conn:
                    conn.execute(text(sql).bindparams(bindparam("ids", expanding=True)), {"ids": ids})
                    conn.commit()
            except Exception as exc:
                logger.warning(f"[purge] {table.name}.{col.name}: {exc!r:.140}")

    try:
        with engine.connect() as conn:
            conn.execute(text("DELETE FROM shops WHERE id IN :ids").bindparams(bindparam("ids", expanding=True)), {"ids": ids})
            conn.commit()
        logger.info(f"[purge] removed hidden platform shops {ids}")
    except Exception as exc:
        logger.warning(f"[purge] hidden shops still referenced, kept: {exc!r:.160}")


def purge_expired_free_trials(engine) -> None:
    """Delete the old generic "free_trial" subscriptions that have already expired.

    That plan no longer exists (Launch, Growth and Scale replaced it). Only
    expired rows go, and only those with no payment or commission attached, so
    no money record is ever removed; a row that still has one is kept and
    logged. Safe to run on every start.
    """
    sql = """
        DELETE FROM subscriptions
        WHERE plan_type = 'free_trial' AND status = 'expired'
          AND id NOT IN (SELECT subscription_id FROM subscription_payments WHERE subscription_id IS NOT NULL)
          AND id NOT IN (SELECT subscription_id FROM commissions WHERE subscription_id IS NOT NULL)
    """
    try:
        with engine.connect() as conn:
            done = conn.execute(text(sql)).rowcount
            kept = conn.execute(text("SELECT COUNT(*) FROM subscriptions WHERE plan_type = 'free_trial' AND status = 'expired'")).scalar()
            conn.commit()
        if done:
            logger.info(f"[purge] removed {done} expired free_trial subscription(s)")
        if kept:
            logger.warning(f"[purge] {kept} expired free_trial subscription(s) kept: a payment or commission still points at them")
    except Exception as exc:
        logger.warning(f"[purge] free_trial cleanup skipped: {exc!r:.160}")
