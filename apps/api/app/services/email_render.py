"""Render + lọc HTML cho email template tùy biến của course.

Nguyên tắc bảo mật:
- KHÔNG dùng jinja2 trên HTML do admin nhập (tránh SSTI). Chỉ thay placeholder
  whitelist ``{{key}}`` bằng giá trị trong context; token lạ giữ nguyên.
- HTML email do admin dán được làm sạch bằng ``nh3`` (Rust/ammonia, robust) với
  allowlist tuned cho EMAIL: GIỮ inline ``style=``, table, bgcolor... (chuẩn email
  dùng inline style); strip ``<script>``/``on*`` handler/``javascript:`` URI.
  ``<style>`` block bị bỏ (giống Gmail) — email nên dùng inline style. Preview vẫn
  render trong iframe sandbox (lớp cô lập chính, giống landing builder).
"""
import re

import nh3

# Allowlist tag/attribute cho HTML email (cho phép inline style + table layout).
_EMAIL_TAGS = {
    "a", "b", "blockquote", "br", "center", "div", "em", "font", "h1", "h2", "h3",
    "h4", "h5", "h6", "hr", "i", "img", "li", "ol", "p", "span", "strong", "sub",
    "sup", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul",
}
_EMAIL_ATTRS = {
    "*": {"style", "class", "align", "valign", "width", "height", "bgcolor", "dir", "title"},
    "a": {"href", "style", "target", "title"},
    "img": {"src", "alt", "width", "height", "style"},
    "table": {"style", "width", "cellpadding", "cellspacing", "border", "bgcolor", "align"},
    "td": {"style", "width", "height", "colspan", "rowspan", "bgcolor", "align", "valign"},
    "th": {"style", "width", "height", "colspan", "rowspan", "bgcolor", "align", "valign"},
    "font": {"color", "face", "size"},
}

# --- Biến cho phép theo từng loại email (key -> nhãn tiếng Việt) ---
COMMON_VARS = {
    "brand_name": "Tên thương hiệu",
    "support_email": "Email hỗ trợ",
    "current_year": "Năm hiện tại",
}

ALLOWED_VARS = {
    "verify": {
        "full_name": "Tên học viên",
        "email": "Email người nhận",
        "course_title": "Tên khóa học",
        "verify_link": "Link xác thực",
        "expires_in": "Thời hạn link",
    },
    "credentials": {
        "full_name": "Tên học viên",
        "email": "Email đăng nhập",
        "password": "Mật khẩu tạm",
        "phone": "Số điện thoại",
        "login_url": "Link đăng nhập",
        "course_title": "Tên khóa học",
    },
    "receipt": {
        "buyer_name": "Tên người mua",
        "course_title": "Tên khóa học",
        "amount": "Số tiền",
        "order_code": "Mã đơn hàng",
        "paid_at": "Thời gian thanh toán",
        "support_email": "Email hỗ trợ",
    },
}

EMAIL_TYPE_LABELS = {
    "verify": "Xác thực Email",
    "credentials": "Thông tin tài khoản",
    "receipt": "Thanh toán thành công",
}

EMAIL_TYPES = tuple(EMAIL_TYPE_LABELS.keys())

_TOKEN_RE = re.compile(r"{{\s*(\w+)\s*}}")


def allowed_keys(email_type: str) -> set[str]:
    return set(ALLOWED_VARS.get(email_type, {})) | set(COMMON_VARS)


def variable_metadata(email_type: str) -> list[dict]:
    """Danh sách biến (key + label + group) cho FE variable palette."""
    items = [{"key": k, "label": v, "group": "context"} for k, v in ALLOWED_VARS.get(email_type, {}).items()]
    items += [{"key": k, "label": v, "group": "common"} for k, v in COMMON_VARS.items()]
    return items


def render_whitelist(text: str | None, ctx: dict, email_type: str) -> str:
    """Thay ``{{key}}`` bằng ctx[key] nếu key thuộc whitelist của email_type.

    Token không hợp lệ / thiếu dữ liệu → giữ nguyên (dễ debug, không lộ rỗng bất ngờ).
    """
    if not text:
        return text or ""
    allowed = allowed_keys(email_type)

    def _repl(match: "re.Match") -> str:
        key = match.group(1)
        if key in allowed and ctx.get(key) is not None:
            return str(ctx[key])
        return match.group(0)

    return _TOKEN_RE.sub(_repl, text)


def sanitize_email_html(html: str | None) -> str:
    """Làm sạch HTML email bằng nh3 — GIỮ inline style + table, strip script/on*/js: URI.

    ``clean_content_tags={script, style}`` → bỏ hẳn nội dung script/style (không leak CSS
    ra text). ``<style>`` block bị bỏ; email nên dùng inline style (chuẩn, Gmail cũng strip).
    """
    if not html:
        return html or ""
    return nh3.clean(
        html,
        tags=_EMAIL_TAGS,
        attributes=_EMAIL_ATTRS,
        clean_content_tags={"script", "style"},
    )
