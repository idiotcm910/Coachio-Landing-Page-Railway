"""Auto-provision of funnel tracking_config from global env defaults.

Covers `_default_tracking_config()` used by create_funnel: it seeds tracking
only when both a default pixel id and CAPI token are configured, and never
mutates existing funnels (creation-only behavior is enforced at the endpoint).
"""

from app.api.v1.endpoints.admin.funnels import _default_tracking_config
from app.core.config import settings


def _set_defaults(monkeypatch, pixel="", token="", test_code=""):
    monkeypatch.setattr(settings, "META_DEFAULT_PIXEL_ID", pixel)
    monkeypatch.setattr(settings, "META_DEFAULT_CAPI_TOKEN", token)
    monkeypatch.setattr(settings, "META_DEFAULT_TEST_EVENT_CODE", test_code)


def test_auto_provision_when_pixel_and_token_set(monkeypatch):
    _set_defaults(monkeypatch, pixel="123456789012345", token="EAA-secret-token", test_code="TEST123")
    config = _default_tracking_config()
    assert config == {
        "meta_pixel_id": "123456789012345",
        "meta_capi_token": "EAA-secret-token",
        "meta_test_event_code": "TEST123",
        "enabled": True,
    }


def test_test_event_code_optional(monkeypatch):
    _set_defaults(monkeypatch, pixel="123456789012345", token="EAA-secret-token", test_code="")
    config = _default_tracking_config()
    assert config["enabled"] is True
    assert config["meta_test_event_code"] is None


def test_no_provision_when_token_missing(monkeypatch):
    _set_defaults(monkeypatch, pixel="123456789012345", token="")
    assert _default_tracking_config() is None


def test_no_provision_when_pixel_missing(monkeypatch):
    _set_defaults(monkeypatch, pixel="", token="EAA-secret-token")
    assert _default_tracking_config() is None


def test_whitespace_only_defaults_treated_as_unset(monkeypatch):
    _set_defaults(monkeypatch, pixel="   ", token="  ")
    assert _default_tracking_config() is None
