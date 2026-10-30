"""Generate the public TaoWorld application attachment. No credentials or live API calls.

Requires reportlab. Example:
  python scripts/generate-taoworld-app-document.py
Output PDFs belong in ignored output/pdf/, not in Git.
"""
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/pdf/GOStore_TaoWorld_App_Design_and_Data_Flow.pdf'
W, H = A4
M = 40
CW = W - 2 * M
NAVY = colors.HexColor('#262261')
ORANGE = colors.HexColor('#F16522')
INK = colors.HexColor('#172339')
GRAY = colors.HexColor('#566379')
PALE = colors.HexColor('#F3F5F9')
LINE = colors.HexColor('#DCE2EB')
FONT_DIR = Path('C:/Windows/Fonts')
for name, filename in [('Body', 'arial.ttf'), ('Bold', 'arialbd.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(FONT_DIR / filename)))
pdfmetrics.registerFontFamily('Body', normal='Body', bold='Bold', italic='Body', boldItalic='Bold')

OUT.parent.mkdir(parents=True, exist_ok=True)
c = canvas.Canvas(str(OUT), pagesize=A4, pageCompression=1)
c.setTitle('GOStore - TaoWorld App Design and Data Flow')
c.setAuthor('GOStore')
c.setSubject('TaoWorld application category access request - proposed integration design')


def para(text, x, top, width, size=10.1, color=INK, bold=False, leading=None):
    style = ParagraphStyle('p', fontName='Bold' if bold else 'Body', fontSize=size,
                           leading=leading or size * 1.43, textColor=color,
                           alignment=TA_LEFT, spaceAfter=0)
    p = Paragraph(text, style)
    _, height = p.wrap(width, H)
    if top < H-40 and top + height > H - 42:
        raise ValueError('Text crosses footer: ' + text[:75])
    p.drawOn(c, x, H - top - height)
    return top + height


def line(x1, y1, x2, y2, color=LINE, dashed=False):
    c.saveState()
    c.setStrokeColor(color)
    c.setLineWidth(1)
    if dashed:
        c.setDash(4, 3)
    c.line(x1, H-y1, x2, H-y2)
    c.restoreState()


def arrow(x1, y1, x2, y2, dashed=False):
    import math
    line(x1, y1, x2, y2, NAVY, dashed)
    angle = math.atan2(y2-y1, x2-x1)
    for offset in [-0.5, 0.5]:
        line(x2, y2, x2-6*math.cos(angle+offset), y2-6*math.sin(angle+offset), NAVY)


def box(x, top, width, height, title, body, planned=False):
    c.saveState()
    c.setFillColor(PALE)
    c.setStrokeColor(ORANGE if planned else LINE)
    c.setLineWidth(1.1)
    if planned:
        c.setDash(4, 3)
    c.roundRect(x, H-top-height, width, height, 8, fill=1, stroke=1)
    c.restoreState()
    end = para(title, x+12, top+11, width-24, 10.3, NAVY, True)
    end = para(body, x+12, end+6, width-24, 9.1, GRAY, leading=12.5)
    if end > top+height-8:
        raise ValueError('Box overflow: ' + title)


def section(number, title, top):
    para(number, M, top, 28, 10, ORANGE, True)
    return para(title, M+30, top-2, CW-30, 13.3, NAVY, True) + 13


def bullet(title, text, top):
    c.setFillColor(ORANGE)
    c.circle(M+3, H-top-6, 2, fill=1, stroke=0)
    return para('<b>'+title+'</b> '+text, M+15, top, CW-15) + 10


def header(page, kicker, title, subtitle):
    c.setFillColor(ORANGE)
    c.rect(0, H-6, W, 6, fill=1, stroke=0)
    para('GO<span color="#F16522">Store</span>', M, 26, 170, 21, NAVY, True)
    para('gostore.mn  |  shop@gostore.mn', W-M-230, 32, 230, 8.7, GRAY)
    line(M, 64, W-M, 64)
    para(kicker.upper(), M, 82, CW, 8.6, ORANGE, True)
    y = para(title, M, 102, CW, 24, NAVY, True, 28)
    para(subtitle, M, y+9, CW, 10, GRAY)
    line(M, H-40, W-M, H-40)
    para('TaoWorld application attachment  |  v1.0  |  30 October 2026', M, H-31, CW-70, 8, GRAY)
    para(f'{page} / 3', W-M-35, H-31, 35, 8, GRAY)


header(1, 'Application overview', 'GOStore + TaoWorld',
       'Application design and data flow for developer category access.')

y = section('01', 'Application profile', 176)
rows = [
    ('Application', 'GOStore - cross-border shopping and purchasing platform'),
    ('Website / market', 'https://gostore.mn  /  customers in Mongolia'),
    ('Business contact', 'shop@gostore.mn'),
    ('Requested category', 'TaoWorld Cross-border Supply Platform'),
]
for label, value in rows:
    para(label, M, y, 130, 9.3, GRAY, True)
    end = para(escape(value), M+137, y, CW-137, 9.6)
    y = max(y+24, end+8)

y = section('02', 'Business purpose', y+13)
y = para('GOStore helps Mongolian customers browse products, select item variants, '
         'place orders and follow delivery from China to Mongolia. We request an '
         'authorized TaoWorld integration for product information and, in a later '
         'controlled phase, purchasing and shipment-status synchronization.', M, y, CW) + 18

y = section('03', 'Current system and requested extension', y)
y = bullet('Existing GOStore system.', 'Web storefront, PHP backend, private SQLite '
           'storage, supplier catalog through OT Commerce, shopping cart, QPay customer '
           'payment integration, administration and warehouse tracking.', y)
y = bullet('Phase 1 - read access.', 'Retrieve permitted product details, source item/SKU '
           'identifiers, variant attributes, images, prices and stock availability. '
           'Apply account-specific display and caching rules.', y)
y = bullet('Phase 2 - purchasing.', 'After separate permission and buyer authorization, '
           'validate an exact quote, submit an operator-approved purchase, reconcile '
           'order status and synchronize China shipment tracking.', y)

box(M, y+7, CW, 87, 'Application status',
    'The business partner application has been approved, as communicated to GOStore. '
    'Developer category access, AppKey/AppSecret, API permissions and buyer authorization '
    'are requested separately. Direct TaoWorld integration is proposed and is not yet enabled.', True)
c.showPage()

header(2, 'Architecture and flow', 'How data moves',
       'Logical target design. Dashed orange boundaries identify the proposed integration.')

# Logical architecture. No credentials enter the browser.
box(40, 184, 140, 90, 'Customer browser',
    'Product browsing<br/>Variant selection<br/>GOStore order status')
box(228, 184, 140, 90, 'GOStore backend',
    'Existing PHP service<br/>Planned TaoWorld adapter<br/>Validation and orders')
box(416, 184, 139, 90, 'TaoWorld APIs',
    'Product / SKU reads<br/>Authorized purchases<br/>Status and tracking', True)
arrow(180, 222, 228, 222)
arrow(228, 222, 180, 222)
para('HTTPS', 183, 202, 43, 7.7, GRAY)
arrow(368, 222, 416, 222, True)
arrow(416, 222, 368, 222, True)
para('Signed', 373, 193, 40, 7.5, GRAY)
para('exchange', 371, 204, 43, 7.5, GRAY)
box(228, 318, 140, 95, 'Private storage',
    'Product mapping<br/>Order references<br/>Authorization tokens<br/>Reconciliation state')
arrow(297, 274, 297, 318)
box(416, 318, 139, 95, 'Planned adapter',
    'Runs on GOStore server<br/>Signing and token refresh<br/>Permission checks<br/>Retry / query handling', True)
line(368, 254, 391, 254, ORANGE, True)
line(391, 254, 391, 365, ORANGE, True)
line(391, 365, 416, 365, ORANGE, True)
para('All TaoWorld requests originate from the server. AppSecret and buyer tokens '
     'are never returned to the customer browser.', 40, 326, 159, 9.5, NAVY)

y = section('04', 'Read and authorization flows', 443)
y = bullet('Buyer authorization.', 'An authorized GOStore operator completes the provider '
           'authorization flow. The server validates the callback and stores the resulting '
           'tokens privately. The exact HTTPS callback URL will be registered with the app.', y)
y = bullet('Catalog reads.', 'Browser request &rarr; GOStore validation &rarr; server adapter '
           '&rarr; permitted TaoWorld API &rarr; normalized, filtered result &rarr; browser. '
           'The existing OT catalog remains available during staged integration.', y)
y = bullet('Storage.', 'Keep source item/SKU mappings, cache timestamps and required '
           'order references. Apply provider caching limits; do not use browsing cache '
           'alone to authorize a purchase.', y)

y = section('05', 'Purchase and fulfillment flow', y+3)
y = para('Customer selects SKU and quantity &rarr; GOStore checks the quote and records '
         'the customer order &rarr; customer payment is verified &rarr; operator approves '
         'procurement &rarr; TaoWorld purchase is submitted and reconciled &rarr; supplier '
         'ships to the China warehouse &rarr; GOStore tracks onward delivery to Mongolia.', M, y, CW)
y = para('<b>Payment separation:</b> QPay collects the customer payment for GOStore. '
         'Supplier payment is a separate authorized operation. A customer payment or '
         'successful order submission does not by itself confirm supplier payment.', M, y+13, CW, 9.6)
c.showPage()

header(3, 'Permissions and controls', 'Access with a defined scope',
       'Request only the capabilities needed for the approved business workflow.')

y = section('06', 'Requested permissions and data use', 177)
columns = [(M, 120), (M+130, 118), (M+258, CW-258)]
for (x, width), label in zip(columns, ['Capability', 'Data involved', 'Purpose / activation']):
    para(label, x, y, width, 9, NAVY, True)
y += 24
table_rows = [
    ('Product reads', 'Item/SKU IDs, titles, attributes, images, prices and stock',
     'Phase 1: approved catalog display, variant mapping and availability checks.'),
    ('Buyer authorization', 'Authorization code, access token and refresh token',
     'Server-only access for the authorized purchasing account; scope and expiry enforced.'),
    ('Purchase operations', 'Selected items, quantities, quote, external order reference and China receiver',
     'Phase 2: operator-approved purchase submission and reconciliation, if granted.'),
    ('Order / logistics reads', 'Provider order IDs, status, tracking numbers and shipment events',
     'Phase 2: update GOStore order progress and warehouse records. Polling first; messages if supported and granted.'),
]
for row in table_rows:
    ends = [para(escape(text), x, y+8, width, 9.1, leading=12.5)
            for (x, width), text in zip(columns, row)]
    y = max(ends)+10
    line(M, y, W-M, y)

y = section('07', 'Security and transaction controls', y+23)
y = bullet('Credential handling.', 'AppSecret and buyer tokens stay in private server '
           'configuration or storage outside public access. Use HTTPS, restricted admin '
           'access and redacted diagnostics; never embed credentials in frontend code.', y)
y = bullet('Minimum necessary data.', 'Send selected product/quantity information and the '
           'required China warehouse receiver details. Keep Mongolian customer account '
           'details and local delivery addresses within GOStore unless explicitly required '
           'for an authorized service.', y)
y = bullet('Reliable purchasing.', 'Validate current SKU, price and stock before submission. '
           'Persist a stable external purchase reference; query uncertain results before '
           'retrying. Track split orders, supplier payments and customer payments separately.', y)
y = bullet('Catalog policy.', 'Screen product data and apply restricted-item controls to '
           'listing, detail and ordering paths. Retain operator review for uncertain '
           'products and procurement exceptions.', y)

y = section('08', 'Activation and validation', y+3)
para('Confirm the business channel, granted API groups, content-use rules, quotas and '
     'approved testing process with TaoWorld. Validate authorization and read-only access '
     'first. Enable a small operator-controlled purchase pilot only after permission, '
     'buyer authorization and supplier-payment arrangements are confirmed. Automated '
     'purchasing and supplier payment remain off until reconciliation is validated.', M, y, CW, 9.6)
c.showPage()
c.save()
print(OUT)
