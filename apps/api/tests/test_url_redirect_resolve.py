"""Unit tests for the pure redirect-resolution logic (admin-url-redirects task 7.1)."""

from types import SimpleNamespace

from app.services.url_redirect_service import resolve_redirect


def _rule(source, target, match_type="exact", status_code=301, is_active=True):
    return SimpleNamespace(
        source_path=source,
        target_url=target,
        match_type=match_type,
        status_code=status_code,
        is_active=is_active,
    )


def test_exact_match_redirects():
    rules = [_rule("/khoa-hoc-cu", "/khoa-hoc-moi", status_code=301)]
    assert resolve_redirect("/khoa-hoc-cu", rules) == ("/khoa-hoc-moi", 301)


def test_no_match_returns_none():
    rules = [_rule("/a", "/b")]
    assert resolve_redirect("/c", rules) is None


def test_wildcard_preserves_suffix():
    rules = [_rule("/blog/*", "/tin-tuc/*", match_type="wildcard", status_code=302)]
    assert resolve_redirect("/blog/bai-viet-1", rules) == ("/tin-tuc/bai-viet-1", 302)


def test_inactive_rule_ignored():
    rules = [_rule("/x", "/y", is_active=False)]
    assert resolve_redirect("/x", rules) is None


def test_exact_takes_precedence_over_wildcard():
    rules = [
        _rule("/shop/item", "/wildcard-target", match_type="wildcard"),  # not a real wildcard, skipped
        _rule("/shop/*", "/store/*", match_type="wildcard"),
        _rule("/shop/item", "/store/special", match_type="exact"),
    ]
    assert resolve_redirect("/shop/item", rules) == ("/store/special", 301)


def test_self_redirect_skipped():
    rules = [_rule("/loop", "/loop", match_type="exact")]
    assert resolve_redirect("/loop", rules) is None


def test_wildcard_self_redirect_skipped():
    rules = [_rule("/same/*", "/same/*", match_type="wildcard")]
    assert resolve_redirect("/same/page", rules) is None
