/**
 * Self-contained HTML strings for each thank-you template kind.
 * Rendered inside an isolated srcdoc iframe (LandingSectionFrame) — NOT sanitized,
 * so <style>/<link>/<svg> and animations are allowed. No <script>.
 * Tokens: {{primary_color}} (also used as 8-digit hex alpha e.g. {{primary_color}}1a),
 * kind-specific vars, {{zalo_link}}.
 *
 * All 5 share the same premium design language (Inter font, radial-gradient bg,
 * white card with brand border-top, animated green check, badge pill, box rows,
 * pill buttons, Zalo section, enote footer, responsive 600px breakpoint).
 *
 * Per-kind distinction is in the "what's next" module:
 *   WORKSHOP  — event details module (date chip + detail rows)
 *   EBOOK     — prominent file-card with SVG file glyph + format badge + download CTA
 *   COURSE    — vertical numbered 3-step onboarding list + access callout
 *   COACHING  — booking highlight card (calendar SVG, left-accent border) + reassurance line
 *   WEBINAR   — date-emphasis hero (large event_date + broadcast SVG) + replay/community buttons
 */

// ---------------------------------------------------------------------------
// Workshop — event details module: date chip + 3 detail rows
// Tokens: primary_color, funnel_title, product_name, event_name,
//         event_date, event_time, location, join_link, zalo_link
// ---------------------------------------------------------------------------

export const WORKSHOP_HTML = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Đăng ký thành công</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
  :root{
    --brand:{{primary_color}};
    --brand-a06:{{primary_color}}0f;
    --brand-a08:{{primary_color}}14;
    --brand-a10:{{primary_color}}1a;
    --brand-a25:{{primary_color}}40;
    --ink:#0f172a; --muted:#64748b; --line:#e9edf3; --zalo:#0068FF; --green:#16a34a;
  }
  html,body{margin:0;padding:0;}
  #ty-wrap{
    all:initial; font-family:'Inter',sans-serif !important;
    background:
      radial-gradient(120% 80% at 0% 0%, var(--brand-a08) 0%, transparent 42%),
      radial-gradient(120% 80% at 100% 100%, rgba(0,104,255,0.07) 0%, transparent 42%),
      #f5f7fb;
    color:var(--ink); display:flex; align-items:center; justify-content:center;
    width:100%; min-height:100vh; box-sizing:border-box; position:relative; padding:40px 24px;
  }
  #ty-wrap *{box-sizing:border-box; font-family:'Inter',sans-serif !important;}
  #ty-wrap strong{font-weight:700; color:var(--ink);}
  #ty-wrap a{text-decoration:none;}
  .ty-card{
    position:relative; z-index:2; width:100%; max-width:580px; background:#fff;
    border:1px solid var(--line); border-top:4px solid var(--brand); border-radius:24px;
    padding:48px 44px; text-align:center; box-shadow:0 30px 70px rgba(15,23,42,0.08);
  }
  .ty-ic{
    width:92px; height:92px; margin:0 auto 26px; border-radius:50%;
    background:radial-gradient(circle at center, rgba(22,163,74,0.14), rgba(22,163,74,0.05));
    border:2px solid rgba(22,163,74,0.35); display:grid; place-items:center;
    box-shadow:0 0 0 8px rgba(22,163,74,0.06); animation:pop .6s cubic-bezier(.175,.885,.32,1.275);
  }
  .ty-ic svg{width:46px; height:46px; color:var(--green);}
  @keyframes pop{0%{transform:scale(0);opacity:0}100%{transform:scale(1);opacity:1}}
  .ty-badge{
    display:inline-flex; align-items:center; gap:8px; background:rgba(22,163,74,0.08);
    border:1px solid rgba(22,163,74,0.25); color:var(--green); font-size:12px; font-weight:800;
    letter-spacing:1px; text-transform:uppercase; padding:7px 18px; border-radius:100px; margin-bottom:20px;
  }
  .ty-badge .pip{width:7px; height:7px; background:var(--green); border-radius:50%; box-shadow:0 0 8px rgba(22,163,74,0.6);}
  .ty-title{font-size:32px; line-height:1.18; font-weight:900; letter-spacing:-0.8px; margin:0 0 12px;}
  .ty-desc{font-size:16px; line-height:1.7; color:var(--muted); margin:0 0 30px;}
  .box{background:#f8fafc; border:1px solid var(--line); border-radius:16px; padding:8px 20px; margin-bottom:24px; text-align:left;}
  .row{display:flex; align-items:center; gap:14px; padding:14px 0;}
  .row:not(:last-child){border-bottom:1px solid var(--line);}
  .row-ic{flex-shrink:0; width:40px; height:40px; border-radius:11px; background:var(--brand-a10); border:1px solid var(--brand-a25); display:grid; place-items:center;}
  .row-ic svg{width:18px; height:18px; color:var(--brand);}
  .row-tx{display:flex; flex-direction:column;}
  .row-tx .k{font-size:11.5px; color:var(--muted); font-weight:700; text-transform:uppercase; letter-spacing:.5px;}
  .row-tx .v{font-size:15px; color:var(--ink); font-weight:700; margin-top:3px;}
  .btn-join{display:flex; align-items:center; justify-content:center; gap:8px; width:100%; background:var(--brand); color:#fff !important; font-size:16px; font-weight:800; padding:16px 20px; border-radius:100px; margin-bottom:18px; box-shadow:0 10px 26px var(--brand-a25); transition:transform .3s cubic-bezier(.175,.885,.32,1.275);}
  .btn-join:hover{transform:translateY(-3px) scale(1.01);}
  .btn-join svg{width:20px; height:20px;}
  .zalo{background:linear-gradient(135deg, rgba(0,104,255,0.07) 0%, rgba(0,104,255,0.02) 100%); border:1px solid rgba(0,104,255,0.22); border-radius:18px; padding:24px; margin-bottom:22px;}
  .zalo-t{font-size:17px; font-weight:800; color:var(--ink); margin:0 0 8px; display:flex; align-items:center; justify-content:center; gap:8px;}
  .zalo-t .step{display:inline-grid; place-items:center; width:22px; height:22px; border-radius:50%; background:var(--brand); color:#fff; font-size:13px; font-weight:900;}
  .zalo-d{font-size:14px; line-height:1.6; color:var(--muted); margin:0 0 20px;}
  .btn-zalo{display:flex; align-items:center; justify-content:center; gap:10px; width:100%; background:linear-gradient(92deg,#0068FF 0%,#0095ff 100%); color:#fff !important; font-size:17px; font-weight:800; padding:17px 20px; border-radius:100px; box-shadow:0 10px 26px rgba(0,104,255,0.32); transition:transform .35s cubic-bezier(.175,.885,.32,1.275);}
  .btn-zalo:hover{transform:translateY(-3px) scale(1.01);}
  .btn-zalo svg{width:22px; height:22px;}
  .btn-home{display:inline-flex; align-items:center; gap:8px; color:var(--muted); font-size:14px; font-weight:700; transition:color .25s;}
  .btn-home:hover{color:var(--brand);}
  .btn-home svg{width:16px; height:16px;}
  .enote{margin-top:22px; font-size:13px; color:var(--muted); line-height:1.6; display:flex; align-items:center; justify-content:center; gap:8px;}
  .enote svg{width:16px; height:16px; color:var(--muted); flex-shrink:0;}
  @media (max-width:600px){
    #ty-wrap{padding:24px 16px;}
    .ty-card{padding:36px 22px; border-radius:20px;}
    .ty-title{font-size:26px;} .ty-desc{font-size:15px;}
    .ty-ic{width:82px; height:82px;} .ty-ic svg{width:40px; height:40px;}
  }
</style>
</head>
<body>
<div id="ty-wrap">
  <div class="ty-card">

    <div class="ty-ic">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
    </div>

    <span class="ty-badge"><span class="pip"></span> Đăng ký thành công</span>

    <h1 class="ty-title">Cảm ơn bạn đã giữ chỗ!</h1>
    <p class="ty-desc">Chỗ tham gia <strong>{{event_name}}</strong> của bạn đã được xác nhận. Hẹn gặp bạn vào <strong>{{event_time}}, {{event_date}}</strong> nhé!</p>

    <div class="box">
      <div class="row">
        <span class="row-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg></span>
        <span class="row-tx"><span class="k">Thời gian diễn ra</span><span class="v">{{event_time}} &#183; {{event_date}}</span></span>
      </div>
      <div class="row">
        <span class="row-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></span>
        <span class="row-tx"><span class="k">Địa điểm</span><span class="v">{{location}}</span></span>
      </div>
      <div class="row">
        <span class="row-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></span>
        <span class="row-tx"><span class="k">Trạng thái đơn hàng</span><span class="v">Đã thanh toán &amp; xác nhận</span></span>
      </div>
    </div>

    <a href="{{join_link}}" class="btn-join" target="_blank" rel="noopener noreferrer">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
      Tham gia sự kiện
    </a>

    <div class="zalo">
      <p class="zalo-t"><span class="step">!</span> Bước cuối cùng để nhận tài liệu</p>
      <p class="zalo-d">Tham gia nhóm Zalo chính thức để nhận <strong>link tham dự, tài liệu, template</strong> và các thông báo quan trọng trước buổi học.</p>
      <a href="{{zalo_link}}" class="btn-zalo" target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 5.94 2 10.8c0 2.77 1.46 5.24 3.75 6.86-.1.86-.5 2.2-1.45 3.34-.18.22-.02.55.27.5 1.9-.3 3.3-1.05 4.16-1.65.4.13 1.45.35 3.02.35 5.52 0 10-3.94 10-8.8S17.52 2 12 2z"></path></svg>
        Tham gia nhóm Zalo ngay
      </a>
    </div>

    <div class="enote">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
      Thông tin chi tiết cũng đã được gửi tới email của bạn.
    </div>

  </div>
</div>
</body>
</html>`;

// ---------------------------------------------------------------------------
// Ebook — download motif: file-card (SVG file glyph + product name + format badge)
// + prominent download CTA + read guide note row + Zalo secondary
// Tokens: primary_color, product_name, file_format, read_guide,
//         download_url, zalo_link
// ---------------------------------------------------------------------------

export const EBOOK_HTML = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Tải xuống sẵn sàng</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
  :root{
    --brand:{{primary_color}};
    --brand-a06:{{primary_color}}0f;
    --brand-a08:{{primary_color}}14;
    --brand-a10:{{primary_color}}1a;
    --brand-a25:{{primary_color}}40;
    --ink:#0f172a; --muted:#64748b; --line:#e9edf3; --zalo:#0068FF; --green:#16a34a;
  }
  html,body{margin:0;padding:0;}
  #ty-wrap{
    all:initial; font-family:'Inter',sans-serif !important;
    background:
      radial-gradient(120% 80% at 0% 0%, var(--brand-a08) 0%, transparent 42%),
      radial-gradient(120% 80% at 100% 100%, rgba(0,104,255,0.07) 0%, transparent 42%),
      #f5f7fb;
    color:var(--ink); display:flex; align-items:center; justify-content:center;
    width:100%; min-height:100vh; box-sizing:border-box; position:relative; padding:40px 24px;
  }
  #ty-wrap *{box-sizing:border-box; font-family:'Inter',sans-serif !important;}
  #ty-wrap strong{font-weight:700; color:var(--ink);}
  #ty-wrap a{text-decoration:none;}
  .ty-card{
    position:relative; z-index:2; width:100%; max-width:580px; background:#fff;
    border:1px solid var(--line); border-top:4px solid var(--brand); border-radius:24px;
    padding:48px 44px; text-align:center; box-shadow:0 30px 70px rgba(15,23,42,0.08);
  }
  .ty-ic{
    width:92px; height:92px; margin:0 auto 26px; border-radius:50%;
    background:radial-gradient(circle at center, rgba(22,163,74,0.14), rgba(22,163,74,0.05));
    border:2px solid rgba(22,163,74,0.35); display:grid; place-items:center;
    box-shadow:0 0 0 8px rgba(22,163,74,0.06); animation:pop .6s cubic-bezier(.175,.885,.32,1.275);
  }
  .ty-ic svg{width:46px; height:46px; color:var(--green);}
  @keyframes pop{0%{transform:scale(0);opacity:0}100%{transform:scale(1);opacity:1}}
  .ty-badge{
    display:inline-flex; align-items:center; gap:8px; background:rgba(22,163,74,0.08);
    border:1px solid rgba(22,163,74,0.25); color:var(--green); font-size:12px; font-weight:800;
    letter-spacing:1px; text-transform:uppercase; padding:7px 18px; border-radius:100px; margin-bottom:20px;
  }
  .ty-badge .pip{width:7px; height:7px; background:var(--green); border-radius:50%; box-shadow:0 0 8px rgba(22,163,74,0.6);}
  .ty-title{font-size:32px; line-height:1.18; font-weight:900; letter-spacing:-0.8px; margin:0 0 12px;}
  .ty-desc{font-size:16px; line-height:1.7; color:var(--muted); margin:0 0 30px;}
  /* File card */
  .file-card{
    background:var(--brand-a06); border:1px solid var(--brand-a25); border-radius:20px;
    padding:28px 24px 20px; margin-bottom:24px; display:flex; align-items:center; gap:20px; text-align:left;
  }
  .file-glyph{
    flex-shrink:0; width:68px; height:80px; position:relative;
    background:#fff; border-radius:10px; border:1.5px solid var(--brand-a25);
    box-shadow:0 4px 16px var(--brand-a10); display:flex; align-items:center; justify-content:center;
  }
  .file-glyph svg{width:32px; height:32px; color:var(--brand);}
  .file-corner{
    position:absolute; top:0; right:0; width:18px; height:18px;
    background:var(--brand); border-radius:0 8px 0 8px; opacity:0.85;
  }
  .file-info{flex:1; min-width:0;}
  .file-name{font-size:16px; font-weight:800; color:var(--ink); line-height:1.3; margin-bottom:8px;}
  .file-badge{
    display:inline-block; background:var(--brand); color:#fff; font-size:10px; font-weight:800;
    letter-spacing:1px; text-transform:uppercase; padding:3px 10px; border-radius:6px;
  }
  /* Read guide row */
  .read-row{
    display:flex; align-items:flex-start; gap:10px; background:#f8fafc;
    border:1px solid var(--line); border-radius:12px; padding:14px 16px; margin-bottom:28px; text-align:left;
  }
  .read-row svg{width:16px; height:16px; color:var(--muted); flex-shrink:0; margin-top:1px;}
  .read-row-text{font-size:13.5px; color:var(--muted); line-height:1.55;}
  .read-row-text strong{color:var(--ink); font-weight:700;}
  /* Buttons */
  .btn-primary{
    display:flex; align-items:center; justify-content:center; gap:8px; width:100%;
    background:var(--brand); color:#fff !important; font-size:16px; font-weight:800;
    padding:16px 20px; border-radius:100px; margin-bottom:18px;
    box-shadow:0 10px 26px var(--brand-a25); transition:transform .3s cubic-bezier(.175,.885,.32,1.275);
  }
  .btn-primary:hover{transform:translateY(-3px) scale(1.01);}
  .btn-primary svg{width:20px; height:20px;}
  .zalo{
    background:linear-gradient(135deg, rgba(0,104,255,0.07) 0%, rgba(0,104,255,0.02) 100%);
    border:1px solid rgba(0,104,255,0.22); border-radius:18px; padding:24px; margin-bottom:22px;
  }
  .zalo-t{font-size:17px; font-weight:800; color:var(--ink); margin:0 0 8px; display:flex; align-items:center; justify-content:center; gap:8px;}
  .zalo-t .step{display:inline-grid; place-items:center; width:22px; height:22px; border-radius:50%; background:var(--brand); color:#fff; font-size:13px; font-weight:900;}
  .zalo-d{font-size:14px; line-height:1.6; color:var(--muted); margin:0 0 20px;}
  .btn-zalo{
    display:flex; align-items:center; justify-content:center; gap:10px; width:100%;
    background:linear-gradient(92deg,#0068FF 0%,#0095ff 100%); color:#fff !important;
    font-size:17px; font-weight:800; padding:17px 20px; border-radius:100px;
    box-shadow:0 10px 26px rgba(0,104,255,0.32); transition:transform .35s cubic-bezier(.175,.885,.32,1.275);
  }
  .btn-zalo:hover{transform:translateY(-3px) scale(1.01);}
  .btn-zalo svg{width:22px; height:22px;}
  .enote{margin-top:22px; font-size:13px; color:var(--muted); line-height:1.6; display:flex; align-items:center; justify-content:center; gap:8px;}
  .enote svg{width:16px; height:16px; color:var(--muted); flex-shrink:0;}
  @media (max-width:600px){
    #ty-wrap{padding:24px 16px;}
    .ty-card{padding:36px 22px; border-radius:20px;}
    .ty-title{font-size:26px;} .ty-desc{font-size:15px;}
    .ty-ic{width:82px; height:82px;} .ty-ic svg{width:40px; height:40px;}
    .file-card{flex-direction:column; align-items:center; text-align:center;}
    .file-info{text-align:center;}
  }
</style>
</head>
<body>
<div id="ty-wrap">
  <div class="ty-card">

    <div class="ty-ic">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
    </div>

    <span class="ty-badge"><span class="pip"></span> Tải xuống sẵn sàng</span>

    <h1 class="ty-title">Ebook của bạn đã sẵn sàng!</h1>
    <p class="ty-desc">Cảm ơn bạn đã tin tưởng. Nhấn nút bên dưới để tải <strong>{{product_name}}</strong> về máy ngay.</p>

    <!-- File card -->
    <div class="file-card">
      <div class="file-glyph">
        <div class="file-corner"></div>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      </div>
      <div class="file-info">
        <div class="file-name">{{product_name}}</div>
        <span class="file-badge">{{file_format}}</span>
      </div>
    </div>

    <!-- Read guide note -->
    <div class="read-row">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
      <span class="read-row-text"><strong>Hướng dẫn đọc:</strong> {{read_guide}}</span>
    </div>

    <a href="{{download_url}}" class="btn-primary" target="_blank" rel="noopener noreferrer">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
      Tải ebook ngay
    </a>

    <div class="zalo">
      <p class="zalo-t"><span class="step">!</span> Tham gia cộng đồng đọc sách</p>
      <p class="zalo-d">Vào nhóm Zalo để nhận <strong>tóm tắt, ghi chú, tài liệu bổ sung</strong> và trao đổi cùng tác giả.</p>
      <a href="{{zalo_link}}" class="btn-zalo" target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 5.94 2 10.8c0 2.77 1.46 5.24 3.75 6.86-.1.86-.5 2.2-1.45 3.34-.18.22-.02.55.27.5 1.9-.3 3.3-1.05 4.16-1.65.4.13 1.45.35 3.02.35 5.52 0 10-3.94 10-8.8S17.52 2 12 2z"></path></svg>
        Tham gia nhóm Zalo ngay
      </a>
    </div>

    <div class="enote">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
      Link tải cũng đã được gửi tới email của bạn. Hiệu lực trong 48 giờ.
    </div>

  </div>
</div>
</body>
</html>`;

// ---------------------------------------------------------------------------
// Course — onboarding "3 bước" motif: access callout + vertical numbered steps
// Tokens: primary_color, product_name, access_note,
//         login_url, course_url, zalo_link
// ---------------------------------------------------------------------------

export const COURSE_HTML = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Đăng ký thành công</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
  :root{
    --brand:{{primary_color}};
    --brand-a06:{{primary_color}}0f;
    --brand-a08:{{primary_color}}14;
    --brand-a10:{{primary_color}}1a;
    --brand-a25:{{primary_color}}40;
    --ink:#0f172a; --muted:#64748b; --line:#e9edf3; --zalo:#0068FF; --green:#16a34a;
  }
  html,body{margin:0;padding:0;}
  #ty-wrap{
    all:initial; font-family:'Inter',sans-serif !important;
    background:
      radial-gradient(120% 80% at 0% 0%, var(--brand-a08) 0%, transparent 42%),
      radial-gradient(120% 80% at 100% 100%, rgba(0,104,255,0.07) 0%, transparent 42%),
      #f5f7fb;
    color:var(--ink); display:flex; align-items:center; justify-content:center;
    width:100%; min-height:100vh; box-sizing:border-box; position:relative; padding:40px 24px;
  }
  #ty-wrap *{box-sizing:border-box; font-family:'Inter',sans-serif !important;}
  #ty-wrap strong{font-weight:700; color:var(--ink);}
  #ty-wrap a{text-decoration:none;}
  .ty-card{
    position:relative; z-index:2; width:100%; max-width:580px; background:#fff;
    border:1px solid var(--line); border-top:4px solid var(--brand); border-radius:24px;
    padding:48px 44px; text-align:center; box-shadow:0 30px 70px rgba(15,23,42,0.08);
  }
  .ty-ic{
    width:92px; height:92px; margin:0 auto 26px; border-radius:50%;
    background:radial-gradient(circle at center, rgba(22,163,74,0.14), rgba(22,163,74,0.05));
    border:2px solid rgba(22,163,74,0.35); display:grid; place-items:center;
    box-shadow:0 0 0 8px rgba(22,163,74,0.06); animation:pop .6s cubic-bezier(.175,.885,.32,1.275);
  }
  .ty-ic svg{width:46px; height:46px; color:var(--green);}
  @keyframes pop{0%{transform:scale(0);opacity:0}100%{transform:scale(1);opacity:1}}
  .ty-badge{
    display:inline-flex; align-items:center; gap:8px; background:rgba(22,163,74,0.08);
    border:1px solid rgba(22,163,74,0.25); color:var(--green); font-size:12px; font-weight:800;
    letter-spacing:1px; text-transform:uppercase; padding:7px 18px; border-radius:100px; margin-bottom:20px;
  }
  .ty-badge .pip{width:7px; height:7px; background:var(--green); border-radius:50%; box-shadow:0 0 8px rgba(22,163,74,0.6);}
  .ty-title{font-size:32px; line-height:1.18; font-weight:900; letter-spacing:-0.8px; margin:0 0 12px;}
  .ty-desc{font-size:16px; line-height:1.7; color:var(--muted); margin:0 0 24px;}
  /* Access callout */
  .access-callout{
    background:var(--brand-a06); border:1px solid var(--brand-a25); border-left:4px solid var(--brand);
    border-radius:0 14px 14px 0; padding:16px 20px; margin-bottom:28px; text-align:left;
    display:flex; align-items:flex-start; gap:12px;
  }
  .access-callout svg{width:18px; height:18px; color:var(--brand); flex-shrink:0; margin-top:1px;}
  .access-callout p{margin:0; font-size:14px; line-height:1.65; color:var(--ink);}
  /* Steps */
  .steps-label{font-size:11.5px; font-weight:800; text-transform:uppercase; letter-spacing:.9px; color:var(--muted); margin:0 0 16px; text-align:left;}
  .step-list{list-style:none; margin:0 0 28px; padding:0; display:flex; flex-direction:column; gap:0;}
  .step-item{display:flex; align-items:flex-start; gap:16px; padding:14px 0; border-bottom:1px solid var(--line); text-align:left;}
  .step-item:last-child{border-bottom:none;}
  .step-num{
    flex-shrink:0; width:36px; height:36px; border-radius:50%; background:var(--brand);
    color:#fff; font-size:14px; font-weight:900; display:grid; place-items:center;
    box-shadow:0 4px 12px var(--brand-a25);
  }
  .step-body{flex:1;}
  .step-title{font-size:15px; font-weight:700; color:var(--ink); margin-bottom:3px;}
  .step-sub{font-size:13px; color:var(--muted); line-height:1.55;}
  /* Buttons */
  .btn-primary{
    display:flex; align-items:center; justify-content:center; gap:8px; width:100%;
    background:var(--brand); color:#fff !important; font-size:16px; font-weight:800;
    padding:16px 20px; border-radius:100px; margin-bottom:12px;
    box-shadow:0 10px 26px var(--brand-a25); transition:transform .3s cubic-bezier(.175,.885,.32,1.275);
  }
  .btn-primary:hover{transform:translateY(-3px) scale(1.01);}
  .btn-primary svg{width:20px; height:20px;}
  .btn-outline{
    display:flex; align-items:center; justify-content:center; gap:8px; width:100%;
    background:#fff; color:var(--brand) !important; border:2px solid var(--brand-a25);
    font-size:15px; font-weight:700; padding:14px 20px; border-radius:100px; margin-bottom:18px;
    transition:border-color .25s, color .25s;
  }
  .btn-outline:hover{border-color:var(--brand);}
  .btn-outline svg{width:18px; height:18px;}
  .zalo{
    background:linear-gradient(135deg, rgba(0,104,255,0.07) 0%, rgba(0,104,255,0.02) 100%);
    border:1px solid rgba(0,104,255,0.22); border-radius:18px; padding:24px; margin-bottom:22px;
  }
  .zalo-t{font-size:17px; font-weight:800; color:var(--ink); margin:0 0 8px; display:flex; align-items:center; justify-content:center; gap:8px;}
  .zalo-t .step{display:inline-grid; place-items:center; width:22px; height:22px; border-radius:50%; background:var(--brand); color:#fff; font-size:13px; font-weight:900;}
  .zalo-d{font-size:14px; line-height:1.6; color:var(--muted); margin:0 0 20px;}
  .btn-zalo{
    display:flex; align-items:center; justify-content:center; gap:10px; width:100%;
    background:linear-gradient(92deg,#0068FF 0%,#0095ff 100%); color:#fff !important;
    font-size:17px; font-weight:800; padding:17px 20px; border-radius:100px;
    box-shadow:0 10px 26px rgba(0,104,255,0.32); transition:transform .35s cubic-bezier(.175,.885,.32,1.275);
  }
  .btn-zalo:hover{transform:translateY(-3px) scale(1.01);}
  .btn-zalo svg{width:22px; height:22px;}
  .enote{margin-top:22px; font-size:13px; color:var(--muted); line-height:1.6; display:flex; align-items:center; justify-content:center; gap:8px;}
  .enote svg{width:16px; height:16px; color:var(--muted); flex-shrink:0;}
  @media (max-width:600px){
    #ty-wrap{padding:24px 16px;}
    .ty-card{padding:36px 22px; border-radius:20px;}
    .ty-title{font-size:26px;} .ty-desc{font-size:15px;}
    .ty-ic{width:82px; height:82px;} .ty-ic svg{width:40px; height:40px;}
  }
</style>
</head>
<body>
<div id="ty-wrap">
  <div class="ty-card">

    <div class="ty-ic">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
    </div>

    <span class="ty-badge"><span class="pip"></span> Đăng ký thành công</span>

    <h1 class="ty-title">Chào mừng bạn đến khóa học!</h1>
    <p class="ty-desc">Bạn đã được cấp quyền truy cập <strong>{{product_name}}</strong>. Bắt đầu hành trình học ngay hôm nay.</p>

    <!-- Access callout -->
    <div class="access-callout">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
      <p>{{access_note}}</p>
    </div>

    <!-- 3 steps -->
    <p class="steps-label">Bắt đầu trong 3 bước</p>
    <ul class="step-list">
      <li class="step-item">
        <span class="step-num">1</span>
        <div class="step-body">
          <div class="step-title">Đăng nhập tài khoản</div>
          <div class="step-sub">Dùng email đã đăng ký để truy cập nền tảng học.</div>
        </div>
      </li>
      <li class="step-item">
        <span class="step-num">2</span>
        <div class="step-body">
          <div class="step-title">Vào khóa học của tôi</div>
          <div class="step-sub">Tìm <strong>{{product_name}}</strong> trong danh sách khóa học đã mua.</div>
        </div>
      </li>
      <li class="step-item">
        <span class="step-num">3</span>
        <div class="step-body">
          <div class="step-title">Bắt đầu bài đầu tiên</div>
          <div class="step-sub">Nhấn vào bài học và học theo tiến độ của bạn.</div>
        </div>
      </li>
    </ul>

    <a href="{{login_url}}" class="btn-primary" target="_blank" rel="noopener noreferrer">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
      Vào học ngay
    </a>

    <a href="{{course_url}}" class="btn-outline" target="_blank" rel="noopener noreferrer">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
      Trang khóa học
    </a>

    <div class="zalo">
      <p class="zalo-t"><span class="step">!</span> Cộng đồng học viên</p>
      <p class="zalo-d">Tham gia nhóm Zalo để nhận <strong>tài liệu bổ trợ, hỗ trợ từ giảng viên</strong> và kết nối với học viên khác.</p>
      <a href="{{zalo_link}}" class="btn-zalo" target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 5.94 2 10.8c0 2.77 1.46 5.24 3.75 6.86-.1.86-.5 2.2-1.45 3.34-.18.22-.02.55.27.5 1.9-.3 3.3-1.05 4.16-1.65.4.13 1.45.35 3.02.35 5.52 0 10-3.94 10-8.8S17.52 2 12 2z"></path></svg>
        Tham gia nhóm Zalo ngay
      </a>
    </div>

    <div class="enote">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
      Thông tin truy cập đã được gửi tới email của bạn.
    </div>

  </div>
</div>
</body>
</html>`;

// ---------------------------------------------------------------------------
// Coaching — personal booking motif: booking highlight card (calendar SVG,
// accent left-border) + slot_note + contact row + reassurance line
// Tokens: primary_color, product_name, slot_note, contact,
//         booking_url, zalo_link
// ---------------------------------------------------------------------------

export const COACHING_HTML = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Đặt chỗ thành công</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
  :root{
    --brand:{{primary_color}};
    --brand-a06:{{primary_color}}0f;
    --brand-a08:{{primary_color}}14;
    --brand-a10:{{primary_color}}1a;
    --brand-a25:{{primary_color}}40;
    --ink:#0f172a; --muted:#64748b; --line:#e9edf3; --zalo:#0068FF; --green:#16a34a;
  }
  html,body{margin:0;padding:0;}
  #ty-wrap{
    all:initial; font-family:'Inter',sans-serif !important;
    background:
      radial-gradient(120% 80% at 0% 0%, var(--brand-a08) 0%, transparent 42%),
      radial-gradient(120% 80% at 100% 100%, rgba(0,104,255,0.07) 0%, transparent 42%),
      #f5f7fb;
    color:var(--ink); display:flex; align-items:center; justify-content:center;
    width:100%; min-height:100vh; box-sizing:border-box; position:relative; padding:40px 24px;
  }
  #ty-wrap *{box-sizing:border-box; font-family:'Inter',sans-serif !important;}
  #ty-wrap strong{font-weight:700; color:var(--ink);}
  #ty-wrap a{text-decoration:none;}
  .ty-card{
    position:relative; z-index:2; width:100%; max-width:580px; background:#fff;
    border:1px solid var(--line); border-top:4px solid var(--brand); border-radius:24px;
    padding:48px 44px; text-align:center; box-shadow:0 30px 70px rgba(15,23,42,0.08);
  }
  .ty-ic{
    width:92px; height:92px; margin:0 auto 26px; border-radius:50%;
    background:radial-gradient(circle at center, rgba(22,163,74,0.14), rgba(22,163,74,0.05));
    border:2px solid rgba(22,163,74,0.35); display:grid; place-items:center;
    box-shadow:0 0 0 8px rgba(22,163,74,0.06); animation:pop .6s cubic-bezier(.175,.885,.32,1.275);
  }
  .ty-ic svg{width:46px; height:46px; color:var(--green);}
  @keyframes pop{0%{transform:scale(0);opacity:0}100%{transform:scale(1);opacity:1}}
  .ty-badge{
    display:inline-flex; align-items:center; gap:8px; background:rgba(22,163,74,0.08);
    border:1px solid rgba(22,163,74,0.25); color:var(--green); font-size:12px; font-weight:800;
    letter-spacing:1px; text-transform:uppercase; padding:7px 18px; border-radius:100px; margin-bottom:20px;
  }
  .ty-badge .pip{width:7px; height:7px; background:var(--green); border-radius:50%; box-shadow:0 0 8px rgba(22,163,74,0.6);}
  .ty-title{font-size:32px; line-height:1.18; font-weight:900; letter-spacing:-0.8px; margin:0 0 12px;}
  .ty-desc{font-size:16px; line-height:1.7; color:var(--muted); margin:0 0 28px;}
  /* Booking highlight card */
  .booking-card{
    background:var(--brand-a06); border:1px solid var(--brand-a25); border-left:4px solid var(--brand);
    border-radius:0 18px 18px 0; padding:24px 22px; margin-bottom:22px; text-align:left;
  }
  .booking-header{display:flex; align-items:center; gap:14px; margin-bottom:16px;}
  .booking-cal{
    flex-shrink:0; width:48px; height:48px; border-radius:13px;
    background:var(--brand-a10); border:1px solid var(--brand-a25); display:grid; place-items:center;
  }
  .booking-cal svg{width:22px; height:22px; color:var(--brand);}
  .booking-label{font-size:11.5px; font-weight:800; text-transform:uppercase; letter-spacing:.8px; color:var(--muted); margin-bottom:3px;}
  .booking-title{font-size:16px; font-weight:800; color:var(--ink);}
  .booking-body{font-size:14px; line-height:1.65; color:var(--ink); margin-bottom:14px;}
  .booking-contact{
    display:flex; align-items:center; gap:10px; background:#fff; border:1px solid var(--line);
    border-radius:10px; padding:12px 14px;
  }
  .booking-contact svg{width:16px; height:16px; color:var(--brand); flex-shrink:0;}
  .booking-contact-text{font-size:13px; color:var(--muted);}
  .booking-contact-text strong{color:var(--ink); font-weight:700;}
  /* Reassurance */
  .reassurance{
    display:flex; align-items:center; gap:10px; background:#f8fafc;
    border:1px solid var(--line); border-radius:12px; padding:14px 16px; margin-bottom:28px; text-align:left;
  }
  .reassurance svg{width:18px; height:18px; color:var(--green); flex-shrink:0;}
  .reassurance p{margin:0; font-size:13.5px; color:var(--muted); line-height:1.55;}
  /* Buttons */
  .btn-primary{
    display:flex; align-items:center; justify-content:center; gap:8px; width:100%;
    background:var(--brand); color:#fff !important; font-size:16px; font-weight:800;
    padding:16px 20px; border-radius:100px; margin-bottom:18px;
    box-shadow:0 10px 26px var(--brand-a25); transition:transform .3s cubic-bezier(.175,.885,.32,1.275);
  }
  .btn-primary:hover{transform:translateY(-3px) scale(1.01);}
  .btn-primary svg{width:20px; height:20px;}
  .zalo{
    background:linear-gradient(135deg, rgba(0,104,255,0.07) 0%, rgba(0,104,255,0.02) 100%);
    border:1px solid rgba(0,104,255,0.22); border-radius:18px; padding:24px; margin-bottom:22px;
  }
  .zalo-t{font-size:17px; font-weight:800; color:var(--ink); margin:0 0 8px; display:flex; align-items:center; justify-content:center; gap:8px;}
  .zalo-t .step{display:inline-grid; place-items:center; width:22px; height:22px; border-radius:50%; background:var(--brand); color:#fff; font-size:13px; font-weight:900;}
  .zalo-d{font-size:14px; line-height:1.6; color:var(--muted); margin:0 0 20px;}
  .btn-zalo{
    display:flex; align-items:center; justify-content:center; gap:10px; width:100%;
    background:linear-gradient(92deg,#0068FF 0%,#0095ff 100%); color:#fff !important;
    font-size:17px; font-weight:800; padding:17px 20px; border-radius:100px;
    box-shadow:0 10px 26px rgba(0,104,255,0.32); transition:transform .35s cubic-bezier(.175,.885,.32,1.275);
  }
  .btn-zalo:hover{transform:translateY(-3px) scale(1.01);}
  .btn-zalo svg{width:22px; height:22px;}
  .enote{margin-top:22px; font-size:13px; color:var(--muted); line-height:1.6; display:flex; align-items:center; justify-content:center; gap:8px;}
  .enote svg{width:16px; height:16px; color:var(--muted); flex-shrink:0;}
  @media (max-width:600px){
    #ty-wrap{padding:24px 16px;}
    .ty-card{padding:36px 22px; border-radius:20px;}
    .ty-title{font-size:26px;} .ty-desc{font-size:15px;}
    .ty-ic{width:82px; height:82px;} .ty-ic svg{width:40px; height:40px;}
  }
</style>
</head>
<body>
<div id="ty-wrap">
  <div class="ty-card">

    <div class="ty-ic">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
    </div>

    <span class="ty-badge"><span class="pip"></span> Đặt chỗ thành công</span>

    <h1 class="ty-title">Cảm ơn bạn đã tin tưởng!</h1>
    <p class="ty-desc">Gói <strong>{{product_name}}</strong> của bạn đã được xác nhận. Chúng tôi rất vui được đồng hành cùng bạn.</p>

    <!-- Booking highlight card -->
    <div class="booking-card">
      <div class="booking-header">
        <div class="booking-cal">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
        </div>
        <div>
          <div class="booking-label">Lịch hẹn coaching</div>
          <div class="booking-title">{{product_name}}</div>
        </div>
      </div>
      <p class="booking-body">{{slot_note}}</p>
      <div class="booking-contact">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.49 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.06a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.72 15.5z"></path></svg>
        <div class="booking-contact-text">Liên hệ: <strong>{{contact}}</strong></div>
      </div>
    </div>

    <!-- Reassurance -->
    <div class="reassurance">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
      <p>Chúng tôi sẽ xác nhận lịch hẹn trong vòng <strong>24 giờ</strong>. Kiểm tra email để nhận thông tin chi tiết.</p>
    </div>

    <a href="{{booking_url}}" class="btn-primary" target="_blank" rel="noopener noreferrer">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
      Đặt lịch hẹn
    </a>

    <div class="zalo">
      <p class="zalo-t"><span class="step">!</span> Kết nối trực tiếp với coach</p>
      <p class="zalo-d">Tham gia nhóm Zalo để <strong>nhắn tin, hỏi đáp</strong> và nhận cập nhật lịch hẹn nhanh nhất.</p>
      <a href="{{zalo_link}}" class="btn-zalo" target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 5.94 2 10.8c0 2.77 1.46 5.24 3.75 6.86-.1.86-.5 2.2-1.45 3.34-.18.22-.02.55.27.5 1.9-.3 3.3-1.05 4.16-1.65.4.13 1.45.35 3.02.35 5.52 0 10-3.94 10-8.8S17.52 2 12 2z"></path></svg>
        Nhắn tin qua Zalo ngay
      </a>
    </div>

    <div class="enote">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
      Thông tin xác nhận đã được gửi tới email của bạn.
    </div>

  </div>
</div>
</body>
</html>`;

// ---------------------------------------------------------------------------
// Webinar — live-event motif: date-emphasis hero (large event_date + broadcast SVG)
// + primary join button + secondary replay/community outline buttons + Zalo
// Tokens: primary_color, product_name, event_date, join_link,
//         replay_url, group_link, zalo_link
// ---------------------------------------------------------------------------

export const WEBINAR_HTML = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Đăng ký thành công</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
  :root{
    --brand:{{primary_color}};
    --brand-a06:{{primary_color}}0f;
    --brand-a08:{{primary_color}}14;
    --brand-a10:{{primary_color}}1a;
    --brand-a25:{{primary_color}}40;
    --ink:#0f172a; --muted:#64748b; --line:#e9edf3; --zalo:#0068FF; --green:#16a34a;
  }
  html,body{margin:0;padding:0;}
  #ty-wrap{
    all:initial; font-family:'Inter',sans-serif !important;
    background:
      radial-gradient(120% 80% at 0% 0%, var(--brand-a08) 0%, transparent 42%),
      radial-gradient(120% 80% at 100% 100%, rgba(0,104,255,0.07) 0%, transparent 42%),
      #f5f7fb;
    color:var(--ink); display:flex; align-items:center; justify-content:center;
    width:100%; min-height:100vh; box-sizing:border-box; position:relative; padding:40px 24px;
  }
  #ty-wrap *{box-sizing:border-box; font-family:'Inter',sans-serif !important;}
  #ty-wrap strong{font-weight:700; color:var(--ink);}
  #ty-wrap a{text-decoration:none;}
  .ty-card{
    position:relative; z-index:2; width:100%; max-width:580px; background:#fff;
    border:1px solid var(--line); border-top:4px solid var(--brand); border-radius:24px;
    padding:48px 44px; text-align:center; box-shadow:0 30px 70px rgba(15,23,42,0.08);
  }
  .ty-ic{
    width:92px; height:92px; margin:0 auto 26px; border-radius:50%;
    background:radial-gradient(circle at center, rgba(22,163,74,0.14), rgba(22,163,74,0.05));
    border:2px solid rgba(22,163,74,0.35); display:grid; place-items:center;
    box-shadow:0 0 0 8px rgba(22,163,74,0.06); animation:pop .6s cubic-bezier(.175,.885,.32,1.275);
  }
  .ty-ic svg{width:46px; height:46px; color:var(--green);}
  @keyframes pop{0%{transform:scale(0);opacity:0}100%{transform:scale(1);opacity:1}}
  .ty-badge{
    display:inline-flex; align-items:center; gap:8px; background:rgba(22,163,74,0.08);
    border:1px solid rgba(22,163,74,0.25); color:var(--green); font-size:12px; font-weight:800;
    letter-spacing:1px; text-transform:uppercase; padding:7px 18px; border-radius:100px; margin-bottom:20px;
  }
  .ty-badge .pip{width:7px; height:7px; background:var(--green); border-radius:50%; box-shadow:0 0 8px rgba(22,163,74,0.6);}
  .ty-title{font-size:32px; line-height:1.18; font-weight:900; letter-spacing:-0.8px; margin:0 0 12px;}
  .ty-desc{font-size:16px; line-height:1.7; color:var(--muted); margin:0 0 28px;}
  /* Date hero */
  .date-hero{
    background:var(--brand-a06); border:1px solid var(--brand-a25); border-radius:22px;
    padding:32px 24px 28px; margin-bottom:28px; position:relative; overflow:hidden;
  }
  .date-hero::before{
    content:''; position:absolute; top:-30px; right:-30px; width:120px; height:120px;
    border-radius:50%; background:var(--brand-a06); pointer-events:none;
  }
  .date-hero-top{display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:12px;}
  .date-hero-icon{
    width:40px; height:40px; border-radius:11px; background:var(--brand-a10);
    border:1px solid var(--brand-a25); display:grid; place-items:center; flex-shrink:0;
  }
  .date-hero-icon svg{width:20px; height:20px; color:var(--brand);}
  .date-hero-label{font-size:11.5px; font-weight:800; text-transform:uppercase; letter-spacing:.9px; color:var(--brand);}
  .date-hero-date{font-size:36px; font-weight:900; letter-spacing:-1px; color:var(--ink); line-height:1.1; margin-bottom:10px;}
  .date-hero-note{font-size:13.5px; color:var(--muted); display:flex; align-items:center; justify-content:center; gap:6px;}
  .date-hero-note svg{width:15px; height:15px; color:var(--muted);}
  /* Buttons */
  .btn-primary{
    display:flex; align-items:center; justify-content:center; gap:8px; width:100%;
    background:var(--brand); color:#fff !important; font-size:16px; font-weight:800;
    padding:16px 20px; border-radius:100px; margin-bottom:12px;
    box-shadow:0 10px 26px var(--brand-a25); transition:transform .3s cubic-bezier(.175,.885,.32,1.275);
  }
  .btn-primary:hover{transform:translateY(-3px) scale(1.01);}
  .btn-primary svg{width:20px; height:20px;}
  .btn-outline{
    display:flex; align-items:center; justify-content:center; gap:8px; width:100%;
    background:#fff; color:var(--muted) !important; border:1.5px solid var(--line);
    font-size:14px; font-weight:700; padding:13px 20px; border-radius:100px; margin-bottom:10px;
    transition:border-color .25s, color .25s;
  }
  .btn-outline:hover{border-color:var(--brand-a25); color:var(--ink) !important;}
  .btn-outline svg{width:17px; height:17px;}
  .zalo{
    background:linear-gradient(135deg, rgba(0,104,255,0.07) 0%, rgba(0,104,255,0.02) 100%);
    border:1px solid rgba(0,104,255,0.22); border-radius:18px; padding:24px; margin-bottom:22px; margin-top:8px;
  }
  .zalo-t{font-size:17px; font-weight:800; color:var(--ink); margin:0 0 8px; display:flex; align-items:center; justify-content:center; gap:8px;}
  .zalo-t .step{display:inline-grid; place-items:center; width:22px; height:22px; border-radius:50%; background:var(--brand); color:#fff; font-size:13px; font-weight:900;}
  .zalo-d{font-size:14px; line-height:1.6; color:var(--muted); margin:0 0 20px;}
  .btn-zalo{
    display:flex; align-items:center; justify-content:center; gap:10px; width:100%;
    background:linear-gradient(92deg,#0068FF 0%,#0095ff 100%); color:#fff !important;
    font-size:17px; font-weight:800; padding:17px 20px; border-radius:100px;
    box-shadow:0 10px 26px rgba(0,104,255,0.32); transition:transform .35s cubic-bezier(.175,.885,.32,1.275);
  }
  .btn-zalo:hover{transform:translateY(-3px) scale(1.01);}
  .btn-zalo svg{width:22px; height:22px;}
  .enote{margin-top:22px; font-size:13px; color:var(--muted); line-height:1.6; display:flex; align-items:center; justify-content:center; gap:8px;}
  .enote svg{width:16px; height:16px; color:var(--muted); flex-shrink:0;}
  @media (max-width:600px){
    #ty-wrap{padding:24px 16px;}
    .ty-card{padding:36px 22px; border-radius:20px;}
    .ty-title{font-size:26px;} .ty-desc{font-size:15px;}
    .ty-ic{width:82px; height:82px;} .ty-ic svg{width:40px; height:40px;}
    .date-hero-date{font-size:28px;}
  }
</style>
</head>
<body>
<div id="ty-wrap">
  <div class="ty-card">

    <div class="ty-ic">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
    </div>

    <span class="ty-badge"><span class="pip"></span> Đăng ký thành công</span>

    <h1 class="ty-title">Bạn đã giữ chỗ thành công!</h1>
    <p class="ty-desc">Suất tham dự <strong>{{product_name}}</strong> của bạn đã được xác nhận. Đừng bỏ lỡ!</p>

    <!-- Date hero -->
    <div class="date-hero">
      <div class="date-hero-top">
        <div class="date-hero-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
        </div>
        <span class="date-hero-label">Ngày phát sóng trực tiếp</span>
      </div>
      <div class="date-hero-date">{{event_date}}</div>
      <p class="date-hero-note">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        Lưu lại ngày này &mdash; đừng bỏ lỡ buổi phát sóng!
      </p>
    </div>

    <a href="{{join_link}}" class="btn-primary" target="_blank" rel="noopener noreferrer">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
      Tham gia Webinar
    </a>

    <a href="{{replay_url}}" class="btn-outline" target="_blank" rel="noopener noreferrer">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
      Xem lại (Replay)
    </a>

    <a href="{{group_link}}" class="btn-outline" target="_blank" rel="noopener noreferrer">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
      Cộng đồng
    </a>

    <div class="zalo">
      <p class="zalo-t"><span class="step">!</span> Nhận nhắc nhở trước giờ phát sóng</p>
      <p class="zalo-d">Tham gia nhóm Zalo để nhận <strong>thông báo nhắc nhở, tài liệu, và Q&amp;A</strong> cùng diễn giả.</p>
      <a href="{{zalo_link}}" class="btn-zalo" target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 5.94 2 10.8c0 2.77 1.46 5.24 3.75 6.86-.1.86-.5 2.2-1.45 3.34-.18.22-.02.55.27.5 1.9-.3 3.3-1.05 4.16-1.65.4.13 1.45.35 3.02.35 5.52 0 10-3.94 10-8.8S17.52 2 12 2z"></path></svg>
        Tham gia nhóm Zalo ngay
      </a>
    </div>

    <div class="enote">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
      Link tham gia sẽ kích hoạt khi webinar bắt đầu. Kiểm tra email để nhận thông báo.
    </div>

  </div>
</div>
</body>
</html>`;
