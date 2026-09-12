#!/usr/bin/env python3
"""
Build the His & Her Hairloft case study PDF.

Proof asset for the "does it actually work / show me proof" objection in the
upsell playbook. It is attached to WhatsApp and sent to leads.

RULES JULIAN SET FOR THIS DOCUMENT (12 Sep 2026) -- do not quietly reverse them:
  * Page 1 carries almost no words. Headline, then the CHART, then a quiet
    line of who it is and three understated numbers underneath. Image first.
  * No duration claim on the numbers. The chart carries its own dates; most of
    the rise happens in a narrower window than the selected range.
  * Every other page is a heading, at most one line of subtext, and the image.
  * Less text, BIGGER text. No explainer boxes, no "why this matters" panels,
    no closing pitch block. The salesperson does the closing, not the PDF.
  * Never a promise. Past example only. Julian asked for the disclaimer off the
    cover on 12 Sep; it lives as two quiet lines at the foot of the LAST page
    instead. It does not get deleted outright -- the claim needs it.
  * The word "GEO" never appears anywhere a client can read it.

Page 1  Cover + the Search Console numbers
Page 2  What a customer sees on Google (two real searches)
Page 3  ChatGPT
Page 4  Google AI Mode
Page 5  Gemini
Page 6  Claude

AI pages run strongest first, one assistant per page, because two per page
makes the text too small to read on a phone.

All images live in ./assets and are committed, so the PDF rebuilds anywhere.
Prepared once from Julian's screenshots in ~/Downloads:

  gsc-performance.jpg          airdropped Search Console export, whole image,
                               clipped tab row trimmed at y=706. The red
                               annotation originally read "SEO and GEO
                               Integration Started here"; repainted to
                               "Google and AI Work Started Here" because the
                               word GEO is never client-facing. Chart untouched.
  serp-best-barber-orchard.jpg 'image (95).png'  crop (55,6,805,478) @vw1500
  serp-barber-orchard.jpg      'image (94).png'  crop (55,6,805,512) @vw1500
  ai-chatgpt.jpg               'image (83).png'  crop (330,55,1075,866) @vw1400
  ai-google-ai-mode.jpg        'image (84).png'  crop (225,75,815,500)  @vw1400
  ai-gemini.jpg                'image (88).png'  crop (372,30,758,606)  @vw1100
  ai-claude.jpg                'image (87).png'  crop (340,55,1050,880) @vw1400

Every crop MUST keep the query visible together with the result.
Run:  /usr/bin/python3 build_case_study.py
"""
import os
from PIL import Image
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas as rcanvas
from reportlab.lib import colors
from reportlab.lib.utils import ImageReader

OUT    = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(OUT, 'assets')
NAMES  = ['Reputifly-Case-Study-Google-and-AI-Results.pdf',
          'hairloft-case-study.pdf']          # legacy name, links already sent

W, H  = A4
M     = 42
FULLW = W - 2 * M
PAGES = 6
FLOOR = 52                                    # nothing may sit below this

INK   = colors.HexColor('#0a0a0a')
MUTED = colors.HexColor('#6b7280')
FAINT = colors.HexColor('#9aa0a6')
LINE  = colors.HexColor('#e8eaed')
TILE  = colors.HexColor('#f6f7f9')

_dims = {}
def dims(name):
    if name not in _dims:
        im = Image.open(os.path.join(ASSETS, name))
        _dims[name] = (im.width, im.height)
    return _dims[name]

c = rcanvas.Canvas(os.path.join(OUT, NAMES[0]), pagesize=A4)

def check(y, page):
    if y < FLOOR:
        print('  !! page %d overruns the footer by %.1fpt' % (page, FLOOR - y))

def foot(n):
    c.setFont('Helvetica', 8.5); c.setFillColor(FAINT)
    c.drawString(M, 30, 'Reputifly Pte Ltd  \xb7  UEN 202531855M  \xb7  hello@reputifly.com')
    c.drawRightString(W - M, 30, 'Page %d of %d' % (n, PAGES))

def head(y, title, size=23):
    while c.stringWidth(title, 'Helvetica-Bold', size) > FULLW and size > 14:
        size -= 0.5
    c.setFont('Helvetica-Bold', size); c.setFillColor(INK)
    c.drawString(M, y - size, title)
    return y - size - 13

def sub(y, text, size=12.5, colr=MUTED):
    while c.stringWidth(text, 'Helvetica', size) > FULLW and size > 8:
        size -= 0.25
    c.setFont('Helvetica', size); c.setFillColor(colr)
    c.drawString(M, y - size, text)
    return y - size - 10

def panel(y, label, name, width, caption=None):
    iw, ih = dims(name)
    h = width * ih / float(iw)
    if label:
        c.setFont('Helvetica-Bold', 14.5); c.setFillColor(INK)
        c.drawString(M, y - 14.5, label); y -= 22
    c.setStrokeColor(LINE); c.setLineWidth(0.8)
    c.roundRect(M - 1, y - h - 1, width + 2, h + 2, 5, stroke=1, fill=0)
    c.drawImage(ImageReader(os.path.join(ASSETS, name)), M, y - h, width, h, mask=None)
    y -= h + 11
    if caption:
        c.setFont('Helvetica', 11.5); c.setFillColor(MUTED)
        c.drawString(M, y - 11.5, caption); y -= 17
    return y - 18

def statrow(y, items):
    """Three understated numbers in a row. No boxes, no shouting."""
    c.setStrokeColor(LINE); c.setLineWidth(0.8); c.line(M, y, W - M, y)
    colw = FULLW / 3.0
    for i, (big, l1, l2) in enumerate(items):
        x = M + i * colw
        c.setFont('Helvetica-Bold', 26); c.setFillColor(INK)
        c.drawString(x, y - 34, big)
        c.setFont('Helvetica', 10); c.setFillColor(MUTED)
        c.drawString(x, y - 52, l1)
        c.drawString(x, y - 65, l2)
    c.setStrokeColor(LINE); c.setLineWidth(0.8); c.line(M, y - 82, W - M, y - 82)
    return y - 82

# ---------------------------------------------------------------- page 1
y = H - M
c.setFont('Helvetica-Bold', 9.5); c.setFillColor(FAINT)
c.drawString(M, y - 10, 'R E P U T I F L Y   \xb7   C L I E N T   C A S E   S T U D Y'); y -= 52

c.setFont('Helvetica-Bold', 33); c.setFillColor(INK)
c.drawString(M, y - 31, '0 to 120 clicks a day,'); y -= 41
c.drawString(M, y - 31, 'from Google and AI.');    y -= 62

y = panel(y, None, 'gsc-performance.jpg', FULLW, 'Their own Google Search Console.')

y -= 16
c.setFont('Helvetica-Bold', 15); c.setFillColor(INK)
c.drawString(M, y - 15, 'His & Her Hairloft by Jamie'); y -= 21
y = sub(y, 'Barber & hair salon, 360 Orchard Road', size=12) - 16

y = statrow(y, [('6,250',   'clicks through to', 'their website'),
                ('405,000', 'times shown in', 'Google results'),
                ('2nd',     'on Google for', '"best barber orchard"')])
check(y, 1); foot(1); c.showPage()

# ---------------------------------------------------------------- page 2
y = H - M
y = head(y, 'This is what a customer sees.')
y = sub(y, 'Two searches people actually type when they want a barber near Orchard.')
y = panel(y, None, 'serp-best-barber-orchard.jpg', 454, 'Searched: "best barber orchard"   \xb7   2nd result')
y = panel(y, None, 'serp-barber-orchard.jpg',      454, 'Searched: "barber orchard"   \xb7   3rd result')
check(y, 2); foot(2); c.showPage()

# ---------------------------------------------------------------- page 3
y = H - M
y = head(y, 'And this is what the AI says.')
y = sub(y, 'We asked the four biggest assistants: "best barber in orchard".')
y = panel(y, 'ChatGPT', 'ai-chatgpt.jpg', FULLW)
check(y, 3); foot(3); c.showPage()

# ---------------------------------------------------------------- page 4
y = H - M
y = head(y, 'Google now answers for itself.')
y = sub(y, 'Its own AI answer sits above the blue links.')
y = panel(y, 'Google AI Mode', 'ai-google-ai-mode.jpg', FULLW,
          'The only shop Google names under "Top Barbershops in Orchard".')
check(y, 4); foot(4); c.showPage()

# ---------------------------------------------------------------- page 5
y = H - M
y = head(y, 'Asked again on Gemini.')
y -= 4
y = panel(y, 'Gemini', 'ai-gemini.jpg', 430)
check(y, 5); foot(5); c.showPage()

# ---------------------------------------------------------------- page 6
y = H - M
y = head(y, 'Four assistants. One salon named in all of them.')
y -= 4
y = panel(y, 'Claude', 'ai-claude.jpg', 440)
c.setFont('Helvetica', 8.5); c.setFillColor(FAINT)
tx = c.beginText(M, 66); tx.setLeading(11.5)
tx.textLine('One client\u2019s past result, shown as an example. It is not a prediction and not a guarantee.')
tx.textLine('What appears on Google, or in an AI answer, is decided by those platforms and not by us.')
c.drawText(tx)
check(y, 6); foot(6)

c.save()
src = os.path.join(OUT, NAMES[0])
for alt in NAMES[1:]:
    with open(src, 'rb') as a, open(os.path.join(OUT, alt), 'wb') as b:
        b.write(a.read())
print('WROTE %s  (%d KB)' % (NAMES[0], os.path.getsize(src) / 1024))
for alt in NAMES[1:]:
    print('  copy %s' % alt)
