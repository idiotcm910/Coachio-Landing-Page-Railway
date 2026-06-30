from fastapi import HTTPException, status
import nh3
from urllib.parse import urlparse


ALLOWED_TAGS = {
    "p",
    "br",
    "strong",
    "em",
    "u",
    "s",
    "h2",
    "h3",
    "h4",
    "blockquote",
    "ul",
    "ol",
    "li",
    "a",
    "code",
    "pre",
    "hr",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "img",
    "video",
    "iframe",
}

ALLOWED_ATTRIBUTES = {
    "a": {"href", "target"},
    "th": {"colspan", "rowspan"},
    "td": {"colspan", "rowspan"},
    "img": {"src", "alt", "title"},
    "video": {"src", "controls", "preload", "poster", "title"},
    "iframe": {"src", "title", "loading", "allow", "allowfullscreen", "referrerpolicy"},
}

ALLOWED_URL_SCHEMES = {"http", "https", "mailto"}
CLEAN_CONTENT_TAGS = {"script", "style"}
YOUTUBE_IFRAME_HOSTS = {"www.youtube.com", "youtube.com", "www.youtube-nocookie.com", "youtube-nocookie.com"}


def _course_attribute_filter(tag: str, attribute: str, value: str) -> str | None:
    if tag == "iframe" and attribute == "src":
        parsed = urlparse(value)
        if parsed.scheme != "https":
            return None
        if parsed.netloc.lower() not in YOUTUBE_IFRAME_HOSTS:
            return None
        if not parsed.path.startswith("/embed/"):
            return None
    return value


def sanitize_html(
    value: str | None,
    *,
    max_length: int = 30_000,
    field_name: str = "html",
) -> str | None:
    if value is None:
        return None

    stripped = value.strip()
    if not stripped:
        return None

    if len(stripped) > max_length:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{field_name} exceeds {max_length} characters",
        )

    return nh3.clean(
        stripped,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        clean_content_tags=CLEAN_CONTENT_TAGS,
        attribute_filter=_course_attribute_filter,
        url_schemes=ALLOWED_URL_SCHEMES,
        link_rel="noopener noreferrer",
        strip_comments=True,
    )


def sanitize_landing_html(
    value: str | None,
    *,
    max_length: int = 200_000,
    field_name: str = "landing.html",
) -> str:
    if value is None:
        return ""

    stripped = value.strip()
    if not stripped:
        return ""

    if len(stripped) > max_length:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{field_name} exceeds {max_length} characters",
        )

    return stripped
