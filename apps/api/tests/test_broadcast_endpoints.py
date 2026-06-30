"""Phase 06 — _broadcast_common shared endpoint logic (SQLite in-memory)."""
import pytest
from unittest.mock import patch, MagicMock
from fastapi import HTTPException
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.api.v1.endpoints.admin import _broadcast_common as common
from app.models.broadcast_campaign import BroadcastCampaign
from app.models.broadcast_send_job import BroadcastSendJob
from app.models.funnel import Funnel
from app.models.lead import Lead
from app.models.product import Product
from app.schemas.broadcast import (
    AudienceConfig,
    AudienceFilters,
    BroadcastCampaignCreate,
    BroadcastCampaignUpdate,
)

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


def _funnel(db, n=2):
    p = Product(name="P", slug="p", base_price=100, type="course", created_by="admin")
    db.add(p)
    db.flush()
    f = Funnel(product_id=p.id, title="F", slug="f", status="published", created_by="admin")
    db.add(f)
    db.flush()
    for i in range(n):
        db.add(Lead(email=f"u{i}@x.com", name=f"U{i}", source_funnel_id=f.id))
    db.commit()
    return f


# ── Happy path tests ──────────────────────────────────────────────────────────

def test_create_admin_and_preview(db):
    f = _funnel(db, n=2)
    c = common.create(
        db, origin="admin", funnel_id=None, created_by=None,
        payload=BroadcastCampaignCreate(
            title="T", subject="S", html_body="<p>x</p>",
            audience_config=AudienceConfig(funnel_ids=[f.id]),
        ),
    )
    assert c.origin == "admin" and c.funnel_id is None
    p = common.preview(db, origin="admin", funnel_id=None, campaign_id=c.id)
    assert p.count == 2


def test_create_funnel_forces_audience(db):
    f = _funnel(db, n=3)
    c = common.create(
        db, origin="funnel", funnel_id=f.id, created_by=None,
        payload=BroadcastCampaignCreate(
            title="T", subject="S", html_body="<p>x</p>",
            audience_config=AudienceConfig(funnel_ids=["WRONG"], filters=AudienceFilters()),
        ),
    )
    assert c.audience_config["funnel_ids"] == [f.id]  # forced to own funnel
    assert common.preview(db, origin="funnel", funnel_id=f.id, campaign_id=c.id).count == 3


def test_get_404_wrong_origin(db):
    f = _funnel(db)
    c = common.create(
        db, origin="admin", funnel_id=None, created_by=None,
        payload=BroadcastCampaignCreate(
            title="T", subject="S", html_body="<p>x</p>",
            audience_config=AudienceConfig(funnel_ids=[f.id]),
        ),
    )
    with pytest.raises(HTTPException) as exc_info:
        common.get_or_404(db, origin="funnel", funnel_id=f.id, campaign_id=c.id)
    assert exc_info.value.status_code == 404


def test_send_immediate_sets_sending(db):
    f = _funnel(db)
    c = common.create(
        db, origin="admin", funnel_id=None, created_by=None,
        payload=BroadcastCampaignCreate(
            title="T", subject="S", html_body="<p>x</p>",
            audience_config=AudienceConfig(funnel_ids=[f.id]),
        ),
    )
    out = common.send(db, origin="admin", funnel_id=None, campaign_id=c.id, scheduled_at=None)
    assert out.status == "sending" and out.started_at is not None


def test_update_draft_ok(db):
    f = _funnel(db)
    c = common.create(
        db, origin="admin", funnel_id=None, created_by=None,
        payload=BroadcastCampaignCreate(
            title="T", subject="S", html_body="<p>x</p>",
            audience_config=AudienceConfig(funnel_ids=[f.id]),
        ),
    )
    updated = common.update(
        db, origin="admin", funnel_id=None, campaign_id=c.id,
        payload=BroadcastCampaignUpdate(title="Updated"),
    )
    assert updated.title == "Updated"


def test_delete_draft_ok(db):
    f = _funnel(db)
    c = common.create(
        db, origin="admin", funnel_id=None, created_by=None,
        payload=BroadcastCampaignCreate(
            title="T", subject="S", html_body="<p>x</p>",
            audience_config=AudienceConfig(funnel_ids=[f.id]),
        ),
    )
    cid = c.id
    common.delete(db, origin="admin", funnel_id=None, campaign_id=cid)
    with pytest.raises(HTTPException) as exc_info:
        common.get_or_404(db, origin="admin", funnel_id=None, campaign_id=cid)
    assert exc_info.value.status_code == 404


def test_stats_returns_counts(db):
    f = _funnel(db)
    c = common.create(
        db, origin="admin", funnel_id=None, created_by=None,
        payload=BroadcastCampaignCreate(
            title="T", subject="S", html_body="<p>x</p>",
            audience_config=AudienceConfig(funnel_ids=[f.id]),
        ),
    )
    stats = common.stats_(db, origin="admin", funnel_id=None, campaign_id=c.id,
                          failed_page=1, failed_size=50)
    assert stats.total == 0  # no jobs yet
    assert stats.failed_jobs == []


# ── Status-guard rejection tests ──────────────────────────────────────────────

def test_send_on_sending_raises_409(db):
    f = _funnel(db)
    c = common.create(
        db, origin="admin", funnel_id=None, created_by=None,
        payload=BroadcastCampaignCreate(
            title="T", subject="S", html_body="<p>x</p>",
            audience_config=AudienceConfig(funnel_ids=[f.id]),
        ),
    )
    common.send(db, origin="admin", funnel_id=None, campaign_id=c.id, scheduled_at=None)
    with pytest.raises(HTTPException) as exc_info:
        common.send(db, origin="admin", funnel_id=None, campaign_id=c.id, scheduled_at=None)
    assert exc_info.value.status_code == 409


def test_cancel_on_draft_raises_409(db):
    f = _funnel(db)
    c = common.create(
        db, origin="admin", funnel_id=None, created_by=None,
        payload=BroadcastCampaignCreate(
            title="T", subject="S", html_body="<p>x</p>",
            audience_config=AudienceConfig(funnel_ids=[f.id]),
        ),
    )
    with pytest.raises(HTTPException) as exc_info:
        common.cancel_(db, origin="admin", funnel_id=None, campaign_id=c.id)
    assert exc_info.value.status_code == 409


def test_update_non_draft_raises_409(db):
    f = _funnel(db)
    c = common.create(
        db, origin="admin", funnel_id=None, created_by=None,
        payload=BroadcastCampaignCreate(
            title="T", subject="S", html_body="<p>x</p>",
            audience_config=AudienceConfig(funnel_ids=[f.id]),
        ),
    )
    common.send(db, origin="admin", funnel_id=None, campaign_id=c.id, scheduled_at=None)
    with pytest.raises(HTTPException) as exc_info:
        common.update(
            db, origin="admin", funnel_id=None, campaign_id=c.id,
            payload=BroadcastCampaignUpdate(title="Bad"),
        )
    assert exc_info.value.status_code == 409


def test_update_scheduled_ok(db):
    """A scheduled campaign (no jobs materialized yet) is still editable."""
    from datetime import datetime, timedelta, timezone

    f = _funnel(db)
    c = common.create(
        db, origin="admin", funnel_id=None, created_by=None,
        payload=BroadcastCampaignCreate(
            title="T", subject="S", html_body="<p>x</p>",
            audience_config=AudienceConfig(funnel_ids=[f.id]),
        ),
    )
    future = datetime.now(timezone.utc) + timedelta(days=1)
    common.send(db, origin="admin", funnel_id=None, campaign_id=c.id, scheduled_at=future)
    assert c.status == "scheduled"
    updated = common.update(
        db, origin="admin", funnel_id=None, campaign_id=c.id,
        payload=BroadcastCampaignUpdate(title="Edited while scheduled"),
    )
    assert updated.title == "Edited while scheduled"
    assert updated.status == "scheduled"


def test_delete_non_draft_raises_409(db):
    f = _funnel(db)
    c = common.create(
        db, origin="admin", funnel_id=None, created_by=None,
        payload=BroadcastCampaignCreate(
            title="T", subject="S", html_body="<p>x</p>",
            audience_config=AudienceConfig(funnel_ids=[f.id]),
        ),
    )
    common.send(db, origin="admin", funnel_id=None, campaign_id=c.id, scheduled_at=None)
    with pytest.raises(HTTPException) as exc_info:
        common.delete(db, origin="admin", funnel_id=None, campaign_id=c.id)
    assert exc_info.value.status_code == 409


def test_retry_with_no_failed_jobs_raises_409(db):
    f = _funnel(db)
    c = common.create(
        db, origin="admin", funnel_id=None, created_by=None,
        payload=BroadcastCampaignCreate(
            title="T", subject="S", html_body="<p>x</p>",
            audience_config=AudienceConfig(funnel_ids=[f.id]),
        ),
    )
    with pytest.raises(HTTPException) as exc_info:
        common.retry(db, origin="admin", funnel_id=None, campaign_id=c.id)
    assert exc_info.value.status_code == 409


def test_cancel_sending_ok(db):
    f = _funnel(db)
    c = common.create(
        db, origin="admin", funnel_id=None, created_by=None,
        payload=BroadcastCampaignCreate(
            title="T", subject="S", html_body="<p>x</p>",
            audience_config=AudienceConfig(funnel_ids=[f.id]),
        ),
    )
    common.send(db, origin="admin", funnel_id=None, campaign_id=c.id, scheduled_at=None)
    result = common.cancel_(db, origin="admin", funnel_id=None, campaign_id=c.id)
    assert result.status == "cancelled"


def test_test_send_calls_resend_once_with_resolved_tokens(db):
    """test_send calls resend.Emails.send exactly once; tokens resolved, no <script>."""
    f = _funnel(db, n=1)
    c = common.create(
        db, origin="admin", funnel_id=None, created_by=None,
        payload=BroadcastCampaignCreate(
            title="T", subject="Hi {{name}}",
            html_body="<p>Hello {{name}}</p><script>alert(1)</script>",
            audience_config=AudienceConfig(funnel_ids=[f.id]),
        ),
    )
    mock_send = MagicMock(return_value={"id": "resend-test-id"})
    with patch("resend.Emails.send", mock_send):
        common.test_send(db, origin="admin", funnel_id=None, campaign_id=c.id, email="admin@example.com")
    mock_send.assert_called_once()
    call_payload = mock_send.call_args[0][0]
    assert call_payload["to"] == "admin@example.com"
    assert "Test" in call_payload["subject"]       # {{name}} resolved to "Test"
    assert "Test" in call_payload["html"]          # {{name}} in body resolved
    assert "<script>" not in call_payload["html"]  # sanitized
