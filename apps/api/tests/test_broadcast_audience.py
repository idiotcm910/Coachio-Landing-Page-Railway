"""Phase 02 — multi-funnel audience query + email dedup + count."""
import pytest
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.models.broadcast_campaign import BroadcastCampaign
from app.models.broadcast_send_job import BroadcastSendJob
from app.models.funnel import Funnel
from app.models.funnel_order import FunnelOrder
from app.models.lead import Lead
from app.models.product import Product
from app.schemas.broadcast import AudienceConfig, AudienceFilters
from app.services.broadcast_audience_service import count_audience, iter_audience

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

TABLES = [
    Product.__table__,
    Funnel.__table__,
    Lead.__table__,
    FunnelOrder.__table__,
    BroadcastCampaign.__table__,
    BroadcastSendJob.__table__,
]


@pytest.fixture()
def db():
    for t in reversed(TABLES):
        t.drop(bind=engine, checkfirst=True)
    for t in TABLES:
        t.create(bind=engine, checkfirst=True)
    s = TestingSessionLocal()
    try:
        yield s
    finally:
        s.close()


def _seed_two_funnels(db):
    p = Product(name="P", slug="p", base_price=100, type="course", created_by="admin")
    db.add(p)
    db.flush()
    f1 = Funnel(product_id=p.id, title="F1", slug="f1", status="published", created_by="admin")
    f2 = Funnel(product_id=p.id, title="F2", slug="f2", status="published", created_by="admin")
    db.add_all([f1, f2])
    db.flush()
    # same email present in BOTH funnels -> must dedup to 1
    db.add_all([
        Lead(email="dup@x.com", name="Dup1", source_funnel_id=f1.id),
        Lead(email="dup@x.com", name="Dup2", source_funnel_id=f2.id),
        Lead(email="solo@x.com", name="Solo", source_funnel_id=f1.id),
    ])
    db.commit()
    return f1, f2


def test_count_dedups_across_funnels(db):
    f1, f2 = _seed_two_funnels(db)
    cfg = AudienceConfig(funnel_ids=[f1.id, f2.id], filters=AudienceFilters())
    assert count_audience(db, cfg) == 2  # dup@x.com counted once


def test_iter_audience_yields_unique_emails(db):
    f1, f2 = _seed_two_funnels(db)
    cfg = AudienceConfig(funnel_ids=[f1.id, f2.id])
    emails = [row[0] for chunk in iter_audience(db, cfg, chunk_size=10) for row in chunk]
    assert sorted(emails) == ["dup@x.com", "solo@x.com"]


def test_empty_funnel_ids_is_zero(db):
    cfg = AudienceConfig(funnel_ids=[])
    assert count_audience(db, cfg) == 0
    assert list(iter_audience(db, cfg)) == []


def test_status_subscribed_filter(db):
    """Broadcast audience filters by stored 'subscribed' status (form opt-in, no purchase)."""
    f1, _ = _seed_two_funnels(db)
    db.add_all([
        Lead(email="sub@x.com", name="Sub", source_funnel_id=f1.id, status="subscribed"),
        Lead(email="checkout@x.com", name="Chk", source_funnel_id=f1.id, status="lead"),
    ])
    db.commit()
    cfg = AudienceConfig(funnel_ids=[f1.id], filters=AudienceFilters(status="subscribed"))
    emails = [row[0] for chunk in iter_audience(db, cfg, chunk_size=10) for row in chunk]
    assert emails == ["sub@x.com"]
