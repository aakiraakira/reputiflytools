#!/usr/bin/env python3
"""
Build the His & Her Hairloft case study PDF (proof for the "does it actually
work" objection in the upsell playbook).

Page 1  ChatGPT            (full content width)
Page 2  Google AI Mode  +  Gemini (when a screenshot exists)
Page 3  Claude (model visible)  +  Google Search Console

To add Gemini: drop the screenshot in ~/Downloads, set GEMINI below to
    ('<filename>.png', 1400, (x0, y0, x1, y1))
using coordinates measured on a 1400px-wide view of that screenshot, then
re-run:  /usr/bin/python3 build_case_study.py
"""
import os
from PIL import Image
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas as rcanvas
from reportlab.lib import colors
from reportlab.lib.utils import ImageReader

DL  = os.path.expanduser('~/Downloads')
OUT = os.path.dirname(os.path.abspath(__file__))
PDF = os.path.join(OUT, 'hairloft-case-study.pdf')

# (source file, view width the box was measured on, (x0, y0, x1, y1))
# Every crop MUST keep the query visible together with the result.
CHATGPT = ('image (83).png', 1400, (300,  45, 1090, 730))   # measured: full 2nd bullet, gap before next
GOOGLE  = ('image (84).png', 1400, (225,  75,  815, 500))
GEMINI  = ('image (88).png', 1100, (355,  30,  765, 612))   # includes "Flash-Lite"
CLAUDE  = ('image (87).png', 1400, (340,  55, 1050, 880))   # includes "Sonnet 5"
GSC     = ('geo-blog-proof.jpeg', None, None)               # use whole image

W, H  = A4
M     = 42
FULLW = W - 2 * M
INK   = colors.HexColor('#0a0a0a')
MUTED = colors.HexColor('#6b7280')
LINE  = colors.HexColor('#e8eaed')

_cache = {}
def load(spec):
    """spec -> (path, w, h); crops on demand, caches the cut file."""
    name, vw, box = spec
    if box is None:
        p = os.path.join(DL, name)
        im = Image.open(p)
        return p, im.width, im.height
    key = (name, box)
    if key not in _cache:
        im = Image.open(os.path.join(DL, name)).convert('RGB')
        s = im.width / float(vw)
        c = im.crop((int(box[0]*s), int(box[1]*s), int(box[2]*s), int(box[3]*s)))
        p = os.path.join(OUT, '.cs_%s.png' % abs(hash(key)))
        c.save(p)
        _cache[key] = (p, c.width, c.height)
    return _cache[key]

c = rcanvas.Canvas(PDF, pagesize=A4)
PAGES = 3

def foot(n):
    c.setFont('Helvetica', 8.5); c.setFillColor(MUTED)
    c.drawString(M, 30, 'Reputifly Pte Ltd  ·  UEN 202531855M  ·  hello@reputifly.com')
    c.drawRightString(W - M, 30, 'Page %d of %d' % (n, PAGES))

def panel(y, label, spec, width):
    """Everything flush-left at the text margin — labels and images share one
    left edge with the headers, nothing floats centered."""
    path, iw, ih = load(spec)
    h = width * ih / float(iw)
    x = M
    c.setFont('Helvetica-Bold', 15); c.setFillColor(INK)
    c.drawString(x, y - 15, label)
    y -= 25
    c.setStrokeColor(LINE); c.setLineWidth(0.8)
    c.roundRect(x - 1, y - h - 1, width + 2, h + 2, 6, stroke=1, fill=0)
    c.drawImage(ImageReader(path), x, y - h, width, h, mask=None)
    return y - h - 26

# ---------------------------------------------------------------- page 1
y = H - M
c.setFont('Helvetica-Bold', 10); c.setFillColor(MUTED)
c.drawString(M, y - 10, 'REPUTIFLY  ·  CLIENT CASE STUDY'); y -= 36
c.setFont('Helvetica-Bold', 24); c.setFillColor(INK)
c.drawString(M, y - 23, 'His & Her Hairloft by Jamie'); y -= 32
c.setFont('Helvetica', 13); c.setFillColor(MUTED)
c.drawString(M, y - 13, 'Barber & hair salon, 360 Orchard Road'); y -= 26
c.setStrokeColor(LINE); c.setLineWidth(1); c.line(M, y, W - M, y); y -= 26
c.setFont('Helvetica-Bold', 14); c.setFillColor(INK)
c.drawString(M, y - 14, 'We asked the AI what a customer asks: "best barber in orchard"'); y -= 26
c.setFont('Helvetica', 9.5); c.setFillColor(MUTED)
tx = c.beginText(M, y - 10); tx.setLeading(13.5)
for ln in ['This is one client’s result, shown as a past example. It is not a prediction and not a guarantee — what',
           'appears in an AI answer, or in Google, is decided by those platforms and not by us. Every screenshot',
           'below was taken from a fresh session with no prior history.']:
    tx.textLine(ln)
c.drawText(tx); y -= 56

y = panel(y, 'ChatGPT', CHATGPT, FULLW)
foot(1); c.showPage()

# ---------------------------------------------------------------- page 2
y = H - M - 6
if GEMINI:
    y = panel(y, 'Google AI Mode', GOOGLE, 300)
    y = panel(y, 'Gemini',         GEMINI, 300)
else:
    y = panel(y, 'Google AI Mode', GOOGLE, FULLW)
foot(2); c.showPage()

# ---------------------------------------------------------------- page 3
y = H - M - 6
y = panel(y, 'Claude', CLAUDE, 360)
y = panel(y, 'Their Google traffic, from Google Search Console', GSC, 360)
foot(3)

c.save()
for p in {v[0] for v in _cache.values()}:
    try: os.remove(p)
    except OSError: pass
print('WROTE %s  (%d KB)' % (PDF, os.path.getsize(PDF) / 1024))
