#!/usr/bin/env python3
"""Render a Markdown doc into a styled PDF.

Used to produce the environment-design PDF from docs/ENVIRONMENTS.md, but works
on any doc using the supported subset: # / ## headings, tables, fenced code
blocks, ordered / unordered lists, *italic* intro lines, and inline
**bold** / *italic* / `code` (rendered as plain text).

    pip install fpdf2
    python scripts/make-docs-pdf.py docs/ENVIRONMENTS.md eva-env-design.pdf

Falls back to a sensible output name when the second arg is omitted.
"""
import re
import sys
from pathlib import Path

from fpdf import FPDF

if len(sys.argv) < 2:
    sys.exit("usage: make-docs-pdf.py <input.md> [output.pdf]")
SRC = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else str(Path(SRC).with_suffix(".pdf").name)

F = "/usr/share/fonts/truetype/dejavu"
INK, ACCENT, MUTED = (30, 30, 40), (95, 60, 160), (110, 110, 125)

pdf = FPDF(format="A4")
pdf.add_font("sans", "", f"{F}/DejaVuSans.ttf")
pdf.add_font("sans", "B", f"{F}/DejaVuSans-Bold.ttf")
pdf.add_font("sans", "I", f"{F}/DejaVuSans.ttf")
pdf.add_font("mono", "", f"{F}/DejaVuSansMono.ttf")
pdf.set_auto_page_break(True, margin=18)
pdf.set_margins(16, 16, 16)
pdf.add_page()
W = pdf.w - 32


def plain(s):  # strip inline md
    s = re.sub(r"\*\*(.+?)\*\*", r"\1", s)
    s = re.sub(r"\*(.+?)\*", r"\1", s)
    return re.sub(r"`(.+?)`", r"\1", s)


def table(rows):
    cols = len(rows[0])
    cw = [W / cols] * cols
    if cols >= 4:  # widen the last column for prose
        cw = [W * x for x in ([0.16, 0.20, 0.14, 0.20, 0.30][:cols] if cols == 5 else [0.18, 0.20, 0.22, 0.40])]
    for i, row in enumerate(rows):
        pdf.set_font("sans", "B" if i == 0 else "", 8.3)
        if i == 0:
            pdf.set_fill_color(238, 233, 248)
        h = 4.6
        # measure tallest cell
        maxlines = max(len(pdf.multi_cell(w, h, plain(c), dry_run=True, output="LINES")) for w, c in zip(cw, row))
        if pdf.get_y() + maxlines * h > pdf.h - 18:
            pdf.add_page()
        y0, x = pdf.get_y(), pdf.l_margin
        for w, c in zip(cw, row):
            pdf.set_xy(x, y0)
            pdf.multi_cell(w, h, plain(c), border="B", fill=(i == 0), new_x="RIGHT", new_y="TOP")
            x += w
        pdf.set_y(y0 + maxlines * h)
    pdf.ln(2.5)


lines = open(SRC).read().splitlines()
i = 0
while i < len(lines):
    ln = lines[i]
    pdf.set_x(pdf.l_margin)
    if ln.startswith("```"):
        block = []
        i += 1
        while i < len(lines) and not lines[i].startswith("```"):
            block.append(lines[i]); i += 1
        pdf.set_fill_color(245, 243, 250)
        pdf.set_font("mono", "", 8.2)
        pdf.set_text_color(*INK)
        pdf.multi_cell(W, 4.4, "\n".join(block) or " ", fill=True, border=0)
        pdf.ln(2)
    elif ln.startswith("| ") and "---" not in ln:
        rows = []
        while i < len(lines) and lines[i].startswith("|"):
            if "---" not in lines[i]:
                rows.append([c.strip() for c in lines[i].strip("|").split("|")])
            i += 1
        i -= 1
        table(rows)
    elif ln.startswith("# "):
        pdf.set_font("sans", "B", 17); pdf.set_text_color(*ACCENT)
        pdf.multi_cell(W, 8, plain(ln[2:])); pdf.ln(1)
    elif ln.startswith("## "):
        pdf.ln(2); pdf.set_font("sans", "B", 12.5); pdf.set_text_color(*ACCENT)
        pdf.multi_cell(W, 6.5, plain(ln[3:]))
        pdf.set_draw_color(*ACCENT); pdf.set_line_width(0.5)
        pdf.line(16, pdf.get_y() + .5, 16 + W, pdf.get_y() + .5); pdf.ln(2.5)
    elif ln.startswith("*") and ln.endswith("*") and not ln.startswith("**") and len(ln) > 2 and not ln.startswith("* "):
        pdf.set_font("sans", "I", 10); pdf.set_text_color(*MUTED)
        pdf.multi_cell(W, 5.4, plain(ln.strip("*"))); pdf.ln(1.5)
    elif re.match(r"^\d+\. |^- ", ln):
        pdf.set_font("sans", "", 9.6); pdf.set_text_color(*INK)
        bullet = "  •  " if ln.startswith("- ") else f"  {ln.split('.')[0]}.  "
        body = re.sub(r"^(\d+\. |- )", "", ln)
        while i + 1 < len(lines) and lines[i + 1].startswith("  ") and lines[i + 1].strip():
            body += " " + lines[i + 1].strip(); i += 1
        pdf.multi_cell(W, 5.2, bullet + plain(body), new_x="LMARGIN", new_y="NEXT")
    elif ln.strip():
        para = ln
        while i + 1 < len(lines) and lines[i + 1].strip() and not re.match(r"^(#|\||```|- |\d+\. |\*)", lines[i + 1]):
            para += " " + lines[i + 1].strip(); i += 1
        pdf.set_font("sans", "", 9.6); pdf.set_text_color(*INK)
        pdf.multi_cell(W, 5.2, plain(para), new_x="LMARGIN", new_y="NEXT"); pdf.ln(1.5)
    i += 1

pdf.set_auto_page_break(False)
pdf.set_y(-14)
pdf.set_font("sans", "I", 7.5); pdf.set_text_color(*MUTED)
pdf.cell(W, 5, f"eva-consciousness · {SRC}", align="C")
pdf.output(OUT)
print("wrote", OUT)
