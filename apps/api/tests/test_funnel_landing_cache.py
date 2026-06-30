"""Tests for the funnel landing write-through cache (task 8.8, D16).

Covers: read-from-cache, miss→repopulate, write-through refresh, default-discount
write-through, unpublish/slug-change eviction, cache-miss graceful fallback.

Ported to coachio-landing-page: User removed; admin represented as a fixed string id.
"""
import json

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core import landing_cache
from app.models.discount import Discount, DiscountDefaultActivation, DiscountScope, OrderDiscount
from app.models.funnel import Funnel, FunnelLandingPage, FunnelSection
from app.models.funnel_order import FunnelOrder
from app.models.lead import Lead
from app.models.product import Product
from app.services import funnel_landing_service as fls

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_funnel_landing_cache.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

TABLES = [
    Product.__table__,
    Funnel.__table__,
    FunnelLandingPage.__table__,
    FunnelSection.__table__,
    Discount.__table__,
    DiscountDefaultActivation.__table__,
    DiscountScope.__table__,
    Lead.__table__,
    FunnelOrder.__table__,
    OrderDiscount.__table__,
]


class FakeBackend:
    """Minimal CacheBackend-compatible in-process store for tests.

    Interface matches CacheBackend (get/setex/delete/incr) so tests can
    monkeypatch landing_cache.get_backend with this object.
    """

    def __init__(self):
        # Flat dict: key → raw string value (no TTL tracking needed in tests)
        self.store: dict = {}

    def get(self, key: str):
        return self.store.get(key)

    def setex(self, key: str, ttl: int, value: str) -> None:
        self.store[key] = value

    def delete(self, key: str) -> None:
        self.store.pop(key, None)

    def incr(self, key: str, ttl: int) -> int:
        count = int(self.store.get(key, 0)) + 1
        self.store[key] = str(count)
        return count


def create_tables():
    for table in TABLES:
        table.create(bind=engine, checkfirst=True)


def drop_tables():
    for table in reversed(TABLES):
        table.drop(bind=engine, checkfirst=True)


@pytest.fixture()
def db():
    drop_tables()
    create_tables()
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        drop_tables()


@pytest.fixture()
def fake_redis(monkeypatch):
    fake = FakeBackend()
    monkeypatch.setattr(landing_cache, "get_backend", lambda: fake)
    return fake


def create_published_funnel(db):
    # Use fixed string as admin id — no User model needed (SQLite no-FK)
    admin_id = "admin-test"
    product = Product(name="Workshop AI", slug="workshop-ai", base_price=1_000_000, type="course", created_by=admin_id)
    db.add(product)
    db.flush()
    funnel = Funnel(product_id=product.id, title="F", slug="f-slug", status="published",
                    created_by=admin_id)
    db.add(funnel)
    db.flush()
    landing = FunnelLandingPage(funnel_id=funnel.id, seo_title="SEO F")
    db.add(landing)
    db.flush()
    db.add(FunnelSection(landing_page_id=landing.id, name="Hero", html="<h1>{{funnel_title}}</h1>", sort_order=0))
    db.commit()
    db.refresh(funnel)
    return funnel, admin_id


def cache_key(slug):
    return fls.funnel_landing_key(slug)


def test_miss_computes_and_populates_then_serves_from_cache(db, fake_redis):
    funnel, _ = create_published_funnel(db)

    payload = fls.get_public_landing(db, funnel)

    assert payload["sections"][0]["html"] == "<h1>F</h1>"  # variables resolved
    assert cache_key("f-slug") in fake_redis.store  # populated on miss

    # poison the DB; cached copy must be served (no recompute)
    funnel.title = "Changed-but-not-written-through"
    db.commit()
    cached = fls.get_public_landing(db, funnel)
    assert cached["title"] == "F"


def test_write_through_refresh_makes_next_read_fresh(db, fake_redis):
    funnel, _ = create_published_funnel(db)
    fls.get_public_landing(db, funnel)  # warm

    funnel.title = "Updated"
    db.commit()
    fls.refresh_funnel_landing_cache(db, funnel)  # write-through (same request)

    assert fls.get_public_landing(db, funnel)["title"] == "Updated"


def test_default_discount_change_writes_through_price(db, fake_redis):
    funnel, admin_id = create_published_funnel(db)
    fls.get_public_landing(db, funnel)
    assert fls.get_public_landing(db, funnel)["final_price"] == 1_000_000

    discount = Discount(code="DEF30", discount_type="percent",
                        discount_value=30, created_by=admin_id)
    db.add(discount)
    db.flush()
    db.add(DiscountDefaultActivation(discount_id=discount.id, owner_type="funnel", owner_id=funnel.id))
    db.commit()
    fls.refresh_funnel_landing_cache(db, funnel)

    assert fls.get_public_landing(db, funnel)["final_price"] == 700_000


def test_unpublish_evicts(db, fake_redis):
    funnel, _ = create_published_funnel(db)
    fls.get_public_landing(db, funnel)
    assert cache_key("f-slug") in fake_redis.store

    funnel.status = "draft"
    db.commit()
    fls.refresh_funnel_landing_cache(db, funnel)  # refresh on draft degrades to evict

    assert cache_key("f-slug") not in fake_redis.store


def test_slug_change_evicts_old_key(db, fake_redis):
    funnel, _ = create_published_funnel(db)
    fls.get_public_landing(db, funnel)

    old_slug = funnel.slug
    funnel.slug = "new-slug"
    db.commit()
    fls.evict_funnel_landing_cache(old_slug)
    fls.refresh_funnel_landing_cache(db, funnel)

    assert cache_key("f-slug") not in fake_redis.store
    assert cache_key("new-slug") in fake_redis.store


def test_cache_miss_falls_back_to_compute(db, monkeypatch):
    """Service must compute from DB when cache returns no data (miss/disabled)."""
    from app.core.cache_backend import InMemoryBackend

    # Fresh backend → all reads are misses → service falls back to DB each time
    monkeypatch.setattr(landing_cache, "get_backend", lambda: InMemoryBackend())
    funnel, _ = create_published_funnel(db)

    payload = fls.get_public_landing(db, funnel)  # must not raise

    assert payload["title"] == "F"
    assert payload["sections"][0]["html"] == "<h1>F</h1>"


def test_cached_value_is_json_serializable(db, fake_redis):
    funnel, _ = create_published_funnel(db)
    fls.get_public_landing(db, funnel)

    raw = fake_redis.store[cache_key("f-slug")]
    assert json.loads(raw)["slug"] == "f-slug"
