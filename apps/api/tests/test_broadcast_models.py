"""Phase 01 — broadcast model definitions + constraints (SQLite-backed)."""
import uuid

import pytest
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from app.models.broadcast_campaign import BroadcastCampaign
from app.models.broadcast_send_job import BroadcastSendJob

engine = create_engine("sqlite:///./test_broadcast_models.db", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
TABLES = [BroadcastCampaign.__table__, BroadcastSendJob.__table__]


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


def _campaign(**kw):
    base = dict(origin="admin", title="C", subject="S", html_body="<p>hi</p>", status="draft")
    base.update(kw)
    return BroadcastCampaign(**base)


def test_campaign_defaults(db):
    c = _campaign()
    db.add(c)
    db.commit()
    assert c.id and len(c.id) == 36
    assert c.total_recipients == 0 and c.sent_count == 0 and c.failed_count == 0
    assert c.created_at is not None


def test_send_job_defaults_and_fk(db):
    c = _campaign()
    db.add(c)
    db.commit()
    j = BroadcastSendJob(campaign_id=c.id, email="a@b.com", name="A", status="pending")
    db.add(j)
    db.commit()
    assert j.id and j.attempts == 0 and j.status == "pending"
    assert j.campaign.id == c.id


def test_unique_campaign_email(db):
    c = _campaign()
    db.add(c)
    db.commit()
    db.add(BroadcastSendJob(id=str(uuid.uuid4()), campaign_id=c.id, email="dup@b.com", status="pending"))
    db.commit()
    db.add(BroadcastSendJob(id=str(uuid.uuid4()), campaign_id=c.id, email="dup@b.com", status="pending"))
    with pytest.raises(IntegrityError):
        db.commit()
