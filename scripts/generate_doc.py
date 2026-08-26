"""
Run:  python scripts/generate_doc.py
Output: ReservistGO_Overview.docx
Requires: pip install python-docx
"""

from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import datetime

DARK   = RGBColor(0x1A, 0x20, 0x35)
ACCENT = RGBColor(0x2F, 0x5F, 0xD0)
MID    = RGBColor(0x55, 0x5F, 0x7A)
LIGHT  = RGBColor(0x9A, 0xA3, 0xB2)
WHITE  = RGBColor(0xFF, 0xFF, 0xFF)
RULE   = 'DEE2EA'
FONT   = 'Calibri'


# ── XML helpers ────────────────────────────────────────────────────────────────

def set_cell_bg(cell, hex_color):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    for old in tcPr.findall(qn('w:shd')):
        tcPr.remove(old)
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'),   'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'),  hex_color)
    tcPr.append(shd)

def cell_border(cell, side, val, sz, color):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcBorders = tcPr.find(qn('w:tcBorders'))
    if tcBorders is None:
        tcBorders = OxmlElement('w:tcBorders')
        tcPr.append(tcBorders)
    el = OxmlElement(f'w:{side}')
    el.set(qn('w:val'),   val)
    el.set(qn('w:sz'),    str(sz))
    el.set(qn('w:space'), '0')
    el.set(qn('w:color'), color)
    tcBorders.append(el)

def clear_cell_borders(cell):
    for side in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        cell_border(cell, side, 'none', 0, 'auto')

def remove_table_borders(table):
    tbl  = table._tbl
    tblPr = tbl.find(qn('w:tblPr'))
    if tblPr is None:
        tblPr = OxmlElement('w:tblPr')
        tbl.insert(0, tblPr)
    for old in tblPr.findall(qn('w:tblBorders')):
        tblPr.remove(old)
    tblBorders = OxmlElement('w:tblBorders')
    for side in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        el = OxmlElement(f'w:{side}')
        el.set(qn('w:val'), 'none')
        tblBorders.append(el)
    tblPr.append(tblBorders)

def set_table_full_width(table):
    tbl  = table._tbl
    tblPr = tbl.find(qn('w:tblPr'))
    if tblPr is None:
        tblPr = OxmlElement('w:tblPr')
        tbl.insert(0, tblPr)
    for old in tblPr.findall(qn('w:tblW')):
        tblPr.remove(old)
    tblW = OxmlElement('w:tblW')
    tblW.set(qn('w:w'),    '5000')
    tblW.set(qn('w:type'), 'pct')
    tblPr.append(tblW)

def add_bookmark(para, bid, name):
    run = para.add_run()
    start = OxmlElement('w:bookmarkStart')
    start.set(qn('w:id'),   str(bid))
    start.set(qn('w:name'), name)
    run._r.append(start)
    end = OxmlElement('w:bookmarkEnd')
    end.set(qn('w:id'), str(bid))
    run._r.append(end)

def add_page_num_field(para):
    for tag, text in [('begin', None), ('separate', None), ('end', None)]:
        r = OxmlElement('w:r')
        rPr = OxmlElement('w:rPr')
        color = OxmlElement('w:color')
        color.set(qn('w:val'), '9AA3B2')
        sz = OxmlElement('w:sz')
        sz.set(qn('w:val'), '17')
        rPr.append(color); rPr.append(sz)
        r.append(rPr)
        if tag == 'separate':
            instr = OxmlElement('w:instrText')
            instr.set(qn('xml:space'), 'preserve')
            instr.text = ' PAGE '
            r.append(instr)
        fld = OxmlElement('w:fldChar')
        fld.set(qn('w:fldCharType'), tag)
        r.append(fld)
        para._p.append(r)

def setup_footer(section):
    footer = section.footer
    footer.is_linked_to_previous = False
    para = footer.paragraphs[0] if footer.paragraphs else footer.add_paragraph()
    para.clear()
    para.alignment = WD_ALIGN_PARAGRAPH.RIGHT

    pPr = para._p.get_or_add_pPr()
    pBdr = OxmlElement('w:pBdr')
    top = OxmlElement('w:top')
    top.set(qn('w:val'),   'single')
    top.set(qn('w:sz'),    '4')
    top.set(qn('w:space'), '4')
    top.set(qn('w:color'), RULE)
    pBdr.append(top)
    pPr.append(pBdr)

    r = para.add_run('ReservistGO   |   Page ')
    r.font.size = Pt(8.5)
    r.font.color.rgb = LIGHT
    r.font.name = FONT
    add_page_num_field(para)


# ── Layout helpers ─────────────────────────────────────────────────────────────

def spacer(doc, pts=8):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after  = Pt(pts)
    return p

def page_break(doc):
    doc.add_page_break()

def divider(doc, before=10, after=10):
    """Thin horizontal rule."""
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(before)
    p.paragraph_format.space_after  = Pt(after)
    pPr = p._p.get_or_add_pPr()
    pBdr = OxmlElement('w:pBdr')
    bottom = OxmlElement('w:bottom')
    bottom.set(qn('w:val'),   'single')
    bottom.set(qn('w:sz'),    '4')
    bottom.set(qn('w:space'), '1')
    bottom.set(qn('w:color'), RULE)
    pBdr.append(bottom)
    pPr.append(pBdr)
    return p

def h1(doc, number, title, bid=None, bname=None):
    """Section heading with thin rule below."""
    para = doc.add_paragraph()
    para.paragraph_format.space_before = Pt(0)
    para.paragraph_format.space_after  = Pt(2)

    n = para.add_run(f'{number:02d}  ')
    n.font.size  = Pt(11)
    n.font.bold  = True
    n.font.color.rgb = ACCENT
    n.font.name  = FONT

    t = para.add_run(title)
    t.font.size  = Pt(20)
    t.font.bold  = True
    t.font.color.rgb = DARK
    t.font.name  = FONT

    pPr = para._p.get_or_add_pPr()
    pBdr = OxmlElement('w:pBdr')
    bot = OxmlElement('w:bottom')
    bot.set(qn('w:val'),   'single')
    bot.set(qn('w:sz'),    '6')
    bot.set(qn('w:space'), '3')
    bot.set(qn('w:color'), RULE)
    pBdr.append(bot)
    pPr.append(pBdr)

    if bid is not None:
        add_bookmark(para, bid, bname)

    spacer(doc, 10)
    return para

def h2(doc, title, bid=None, bname=None):
    """Sub-section heading."""
    para = doc.add_paragraph()
    para.paragraph_format.space_before = Pt(16)
    para.paragraph_format.space_after  = Pt(5)
    run = para.add_run(title)
    run.font.size  = Pt(13)
    run.font.bold  = True
    run.font.color.rgb = DARK
    run.font.name  = FONT
    if bid is not None:
        add_bookmark(para, bid, bname)
    return para

def body(doc, text, lead=None):
    para = doc.add_paragraph()
    para.paragraph_format.space_before = Pt(0)
    para.paragraph_format.space_after  = Pt(6)
    pf = para.paragraph_format
    pf.line_spacing = Pt(15)
    if lead:
        r1 = para.add_run(lead + '  ')
        r1.bold = True
        r1.font.size  = Pt(11)
        r1.font.color.rgb = DARK
        r1.font.name  = FONT
    r2 = para.add_run(text)
    r2.font.size  = Pt(11)
    r2.font.color.rgb = MID
    r2.font.name  = FONT
    return para

def bullet(doc, text, label=None):
    para = doc.add_paragraph(style='List Bullet')
    para.paragraph_format.space_before = Pt(2)
    para.paragraph_format.space_after  = Pt(3)
    para.paragraph_format.line_spacing = Pt(14)
    if label:
        r1 = para.add_run(label + ':  ')
        r1.bold = True
        r1.font.size  = Pt(11)
        r1.font.color.rgb = DARK
        r1.font.name  = FONT
    r2 = para.add_run(text)
    r2.font.size  = Pt(11)
    r2.font.color.rgb = MID
    r2.font.name  = FONT
    return para

def clean_table(doc, headers, rows, col_widths=None):
    """Minimal table: bold header with thick bottom rule, light row dividers."""
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    remove_table_borders(table)
    set_table_full_width(table)

    hdr = table.rows[0]
    for i, h in enumerate(headers):
        cell = hdr.cells[i]
        clear_cell_borders(cell)
        cell_border(cell, 'bottom', 'single', 12, '1A2035')
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        para = cell.paragraphs[0]
        para.paragraph_format.space_before = Pt(5)
        para.paragraph_format.space_after  = Pt(6)
        run = para.add_run(h)
        run.bold = True
        run.font.size  = Pt(10)
        run.font.color.rgb = DARK
        run.font.name  = FONT

    for r_idx, row_data in enumerate(rows):
        row = table.rows[r_idx + 1]
        is_last = (r_idx == len(rows) - 1)
        for c_idx, val in enumerate(row_data):
            cell = row.cells[c_idx]
            clear_cell_borders(cell)
            cell_border(cell, 'bottom', 'single', 4 if not is_last else 8,
                        RULE if not is_last else 'B0B8C8')
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            para = cell.paragraphs[0]
            para.paragraph_format.space_before = Pt(6)
            para.paragraph_format.space_after  = Pt(6)
            run = para.add_run(str(val))
            run.font.size  = Pt(10.5)
            run.font.color.rgb = MID
            run.font.name  = FONT

    if col_widths:
        for i, w in enumerate(col_widths):
            for row in table.rows:
                row.cells[i].width = Cm(w)

    spacer(doc, 8)
    return table

def roadmap_table(doc, rows):
    effort_fg = {
        'Quick win':   ACCENT,
        'Medium':      RGBColor(0xB9, 0x79, 0x1A),
        'Large scope': RGBColor(0xC0, 0x39, 0x2B),
    }
    table = doc.add_table(rows=1 + len(rows), cols=3)
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    remove_table_borders(table)
    set_table_full_width(table)

    for i, h in enumerate(['', 'Enhancement', 'Effort']):
        cell = table.rows[0].cells[i]
        clear_cell_borders(cell)
        cell_border(cell, 'bottom', 'single', 12, '1A2035')
        para = cell.paragraphs[0]
        para.paragraph_format.space_before = Pt(5)
        para.paragraph_format.space_after  = Pt(6)
        run = para.add_run(h)
        run.bold = True
        run.font.size  = Pt(10)
        run.font.color.rgb = DARK
        run.font.name  = FONT

    for r_idx, (num, label, desc, effort) in enumerate(rows):
        row = table.rows[r_idx + 1]
        is_last = (r_idx == len(rows) - 1)
        border_sz    = 8 if is_last else 4
        border_color = 'B0B8C8' if is_last else RULE

        # Number
        c0 = row.cells[0]
        clear_cell_borders(c0)
        cell_border(c0, 'bottom', 'single', border_sz, border_color)
        p0 = c0.paragraphs[0]
        p0.paragraph_format.space_before = Pt(6)
        p0.paragraph_format.space_after  = Pt(6)
        p0.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r0 = p0.add_run(str(num))
        r0.bold = True
        r0.font.size  = Pt(11)
        r0.font.color.rgb = ACCENT
        r0.font.name  = FONT

        # Label + description
        c1 = row.cells[1]
        clear_cell_borders(c1)
        cell_border(c1, 'bottom', 'single', border_sz, border_color)
        p1 = c1.paragraphs[0]
        p1.paragraph_format.space_before = Pt(6)
        p1.paragraph_format.space_after  = Pt(6)
        r1a = p1.add_run(label + '\n')
        r1a.bold = True
        r1a.font.size  = Pt(11)
        r1a.font.color.rgb = DARK
        r1a.font.name  = FONT
        r1b = p1.add_run(desc)
        r1b.font.size  = Pt(9.5)
        r1b.font.color.rgb = MID
        r1b.font.name  = FONT

        # Effort label
        c2 = row.cells[2]
        clear_cell_borders(c2)
        cell_border(c2, 'bottom', 'single', border_sz, border_color)
        p2 = c2.paragraphs[0]
        p2.paragraph_format.space_before = Pt(6)
        p2.paragraph_format.space_after  = Pt(6)
        p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r2 = p2.add_run(effort)
        r2.bold = True
        r2.font.size  = Pt(9.5)
        r2.font.color.rgb = effort_fg.get(effort, ACCENT)
        r2.font.name  = FONT

    for row in table.rows:
        row.cells[0].width = Cm(1.0)
        row.cells[1].width = Cm(12.5)
        row.cells[2].width = Cm(2.7)

    spacer(doc, 10)
    return table

def toc_row(doc, num, label, level=1):
    para = doc.add_paragraph()
    para.paragraph_format.left_indent  = Cm(0 if level == 1 else 1.0)
    para.paragraph_format.space_before = Pt(3 if level == 1 else 1)
    para.paragraph_format.space_after  = Pt(3 if level == 1 else 1)
    prefix = f'{num}  ' if num else '     '
    run = para.add_run(prefix + label)
    run.font.size  = Pt(11.5 if level == 1 else 10.5)
    run.font.bold  = (level == 1)
    run.font.color.rgb = DARK if level == 1 else MID
    run.font.name  = FONT
    return para


# ── Build ──────────────────────────────────────────────────────────────────────

def build():
    doc = Document()

    for section in doc.sections:
        section.top_margin    = Cm(2.5)
        section.bottom_margin = Cm(2.5)
        section.left_margin   = Cm(3.0)
        section.right_margin  = Cm(3.0)
        setup_footer(section)

    style = doc.styles['Normal']
    style.font.name = FONT
    style.font.size = Pt(11)

    today = datetime.datetime.now().strftime('%B %Y')

    # ============================================================
    # COVER
    # ============================================================
    for _ in range(7):
        spacer(doc, 14)

    title_p = doc.add_paragraph()
    title_p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    title_p.paragraph_format.space_after = Pt(6)
    tr = title_p.add_run('ReservistGO')
    tr.font.size  = Pt(38)
    tr.font.bold  = True
    tr.font.color.rgb = DARK
    tr.font.name  = FONT

    rule_p = doc.add_paragraph()
    rule_p.paragraph_format.space_before = Pt(0)
    rule_p.paragraph_format.space_after  = Pt(0)
    pPr = rule_p._p.get_or_add_pPr()
    pBdr = OxmlElement('w:pBdr')
    bot = OxmlElement('w:bottom')
    bot.set(qn('w:val'),   'single')
    bot.set(qn('w:sz'),    '8')
    bot.set(qn('w:space'), '1')
    bot.set(qn('w:color'), '2F5FD0')
    pBdr.append(bot)
    pPr.append(pBdr)

    spacer(doc, 10)

    sub_p = doc.add_paragraph()
    sub_p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    sub_p.paragraph_format.space_after = Pt(0)
    sr = sub_p.add_run('Digital Attendance Management System')
    sr.font.size  = Pt(14)
    sr.font.color.rgb = MID
    sr.font.name  = FONT

    for _ in range(9):
        spacer(doc, 14)

    meta_p = doc.add_paragraph()
    meta_p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    meta_p.paragraph_format.space_after = Pt(2)
    dr = meta_p.add_run(today)
    dr.font.size  = Pt(10.5)
    dr.font.color.rgb = LIGHT
    dr.font.name  = FONT

    tag_p = doc.add_paragraph()
    tag_p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    tag_p.paragraph_format.space_after = Pt(0)
    tg = tag_p.add_run('Prepared for Supervisors and Operations Staff')
    tg.font.size   = Pt(10.5)
    tg.font.color.rgb = LIGHT
    tg.font.italic = True
    tg.font.name   = FONT

    # ============================================================
    # TABLE OF CONTENTS
    # ============================================================
    page_break(doc)

    toc_h = doc.add_paragraph()
    toc_h.paragraph_format.space_before = Pt(0)
    toc_h.paragraph_format.space_after  = Pt(4)
    th = toc_h.add_run('Contents')
    th.font.size  = Pt(22)
    th.font.bold  = True
    th.font.color.rgb = DARK
    th.font.name  = FONT

    divider(doc, before=0, after=16)

    entries = [
        ('01', 'Overview',                        1),
        ('02', 'What Problem It Solves',           1),
        ('03', 'Access Roles',                     1),
        ('04', 'Features: For Reservists',         1),
        ('',   '4.1  Check-In and GPS',            2),
        ('',   '4.2  Leave and MC Requests',       2),
        ('',   '4.3  Attendance and Calendar',     2),
        ('',   '4.4  Safety and Reliability',      2),
        ('05', 'Features: For Supervisors',        1),
        ('',   '5.1  Attendance Roster and Log',   2),
        ('',   '5.2  Requests and Leave Inbox',    2),
        ('',   '5.3  Personnel Management',        2),
        ('',   '5.4  Cycle Management and Export', 2),
        ('06', 'Features: For Master Level',       1),
        ('07', 'Data Privacy',                     1),
        ('08', 'Technical Overview',               1),
        ('09', 'Planned Enhancements',             1),
        ('',   '9.1  Quick Wins',                  2),
        ('',   '9.2  Medium Effort',               2),
        ('',   '9.3  Larger Scope',                2),
    ]

    for num, label, level in entries:
        if level == 1 and num not in ('', '01'):
            spacer(doc, 4)
        toc_row(doc, num, label, level)

    # ============================================================
    # SECTIONS 1 - 3
    # ============================================================
    page_break(doc)

    h1(doc, 1, 'Overview', bid=0, bname='sec_overview')
    body(doc,
        'ReservistGO is a mobile-first web application for managing NS reservist attendance. '
        'It replaces manual sign-in sheets and WhatsApp headcounts with a structured, auditable '
        'digital system accessible from any smartphone, with no app installation required.')
    body(doc,
        'Supervisors get a live dashboard of who has reported, who is late, and who has not shown up. '
        'Reservists check in from their phones using GPS verification. All records are timestamped, '
        'stored in the cloud, and exportable to Excel.')
    body(doc,
        'The system runs entirely in the browser. There is no hardware cost, no IT setup per user, '
        'and no dedicated terminals. Personnel access it through a URL that can be saved to the home '
        'screen for one-tap access. A built-in demo mode allows anyone to explore both the reservist '
        'and supervisor views without creating an account.')

    divider(doc)

    h1(doc, 2, 'What Problem It Solves', bid=1, bname='sec_problem')
    body(doc,
        'Before ReservistGO, attendance was tracked through a combination of paper sign-in sheets, '
        'manual WhatsApp headcounts, and verbal confirmation. This created several recurring problems:')
    spacer(doc, 4)
    bullet(doc, 'No single source of truth. Supervisors had to consolidate information from multiple channels.')
    bullet(doc, 'No timestamped records. It was difficult to verify when a reservist checked in or whether they clocked out.')
    bullet(doc, 'Meal allowance errors. Without reliable clock-out records, it was hard to confirm eligibility and process corrections.')
    bullet(doc, 'Leave and MC tracking was informal. Requests came through messages and were not stored in a verifiable, auditable format.')
    bullet(doc, 'Absences were not automatically recorded. Someone had to manually identify and log no-shows each day.')
    spacer(doc, 6)
    body(doc, 'ReservistGO addresses all of these through a single system that all parties interact with directly.')

    divider(doc)

    h1(doc, 3, 'Access Roles', bid=2, bname='sec_roles')
    body(doc, 'The system uses three permission levels. Each role sees only what is relevant to them.')
    spacer(doc, 8)

    clean_table(doc,
        ['Role', 'Who', 'Access'],
        [
            ('Reservist',  'NS personnel',               'Own check-in, leave requests, attendance history, and team directory. Scoped to their department.'),
            ('Supervisor', 'Staff officers, supervisors', 'Full roster, attendance log, time correction, leave approval, personnel records, cycle management, and exports.'),
            ('Master',     'Command level',               'Everything supervisors can do, plus managing all supervisor accounts and switching between departments.'),
        ],
        col_widths=[2.5, 3.8, 9.9]
    )

    # ============================================================
    # SECTION 4: Reservist Features
    # ============================================================
    page_break(doc)

    h1(doc, 4, 'Features: For Reservists', bid=3, bname='sec_reservist')
    body(doc,
        'All reservists access the system through the same URL. The interface adapts based on department. '
        'Ops Security reservists follow a four-phase check-in flow. CAS (Crime Alert) reservists follow '
        'a simplified two-phase flow: check in and check out only.')

    h2(doc, '4.1  Check-In and GPS', bid=4, bname='sec_checkin')
    bullet(doc, 'Ops Security reservists log four phases: check in, lunch out, return from lunch, and end of shift. CAS reservists log check in and check out only. Each phase is timestamped to the minute.', 'Department-based flow')
    bullet(doc, 'Tapping a phase shows a "Locate me" button first. Once GPS confirms the reservist is within range of HQ, the button changes to "Check in to work". Distance from HQ in metres is recorded. The accepted radius is configurable.', 'Sequential GPS verification')
    bullet(doc, 'After two failed GPS attempts a bypass option appears. Bypassed records are permanently flagged in the log so supervisors are aware.', 'GPS bypass')
    bullet(doc, 'If the app is opened inside WhatsApp, Instagram, or another in-app browser where GPS is blocked, the app shows specific instructions for switching to the device browser.', 'In-app browser detection')
    bullet(doc, 'If connectivity is lost during check-in, the action is saved on the device and submitted automatically once the connection is restored.', 'Offline check-in')
    bullet(doc, 'If checking in more than one hour after shift start, the reservist is prompted for a written reason before the check-in is accepted. The reason is stored alongside the attendance record.', 'Late declaration')

    h2(doc, '4.2  Leave and MC Requests', bid=5, bname='sec_leave')
    bullet(doc, 'Reservists submit MC, personal leave, or other leave requests directly through the app. Requests go to the supervisor inbox with no phone calls or messages needed.', 'Digital submission')
    bullet(doc, 'A pending request can be withdrawn by the reservist before the supervisor has acted on it, from both the check-in screen and the Requests history.', 'Cancel pending requests')
    bullet(doc, 'The Requests history tab shows all past submissions with their current status: approved, rejected with reason, or withdrawn.', 'Request history')

    h2(doc, '4.3  Attendance and Calendar', bid=6, bname='sec_attend')
    bullet(doc, 'A colour-coded calendar shows the full cycle record: present (green), MC (amber), absent, and no-report days (slate blue). Pending MC requests appear with a lighter tint and a dashed border.', 'Attendance calendar')
    bullet(doc, 'If a past day has no clock-out recorded, that calendar cell is coloured orange with a dashed border. A persistent warning also appears on the check-in screen.', 'Missing clock-out detection')
    bullet(doc, 'A reminder banner appears automatically when a check-in phase window is open and the phase has not yet been logged. It disappears once the phase is submitted.', 'Phase reminder banner')
    bullet(doc, 'All remaining no-report days in the current cycle are listed so reservists can plan ahead.', 'Upcoming no-report days')
    bullet(doc, 'When meal allowance is active for the cycle, a live timer shows total work time, paused during lunch. A "Meal eligible" badge appears once 6 hours of work is reached.', 'Work timer and meal eligibility')

    h2(doc, '4.4  Safety and Reliability', bid=7, bname='sec_safety')
    bullet(doc, 'A confirmation step appears before logging out, preventing accidental session loss.', 'Logout confirmation')
    bullet(doc, 'A warning appears at 55 minutes with a one-tap option to extend the session before it expires at 60 minutes. Sessions also expire after 20 minutes of inactivity, with a warning at 18 minutes.', 'Session and idle warnings')
    bullet(doc, 'Reservists can upload a profile photo from account settings. Tapping any photo in the app opens it enlarged.', 'Profile photo')

    # ============================================================
    # SECTION 5: Supervisor Features
    # ============================================================
    page_break(doc)

    h1(doc, 5, 'Features: For Supervisors', bid=8, bname='sec_admin')
    body(doc,
        'Supervisors have full visibility over their department\'s personnel, attendance records, leave requests, '
        'and cycle configuration. All data is scoped to the active department and updates in real time.')

    h2(doc, '5.1  Attendance Roster and Log', bid=9, bname='sec_roster')
    bullet(doc, 'The roster updates in real time as reservists check in. No manual refresh is needed.', 'Live attendance board')
    bullet(doc, 'Filter by All, Present, MC, Absent, or Pending. Search by name. Navigate between dates by swipe or button, or jump directly to any date using the date picker.', 'Filters, search, and navigation')
    bullet(doc, 'Mark any reservist as Present, MC, or Absent from the roster. Mark all pending as absent or all pending as present in a single action, with a required confirmation step each time.', 'Status override')
    bullet(doc, 'Edit any reservist\'s check-in times for any phase on any day. Corrected records are flagged as admin-entered with the editor\'s name and timestamp.', 'Time correction')
    bullet(doc, 'Late check-ins (over one hour after shift start) are automatically flagged in the log with the reservist\'s written reason displayed alongside the record.', 'Late check-in alerts')
    bullet(doc, 'Any log entry where a reservist is marked present but has no clock-out is flagged with a visible badge, making it easy to identify before meal allowance is processed.', 'Missing clock-out flag')
    bullet(doc, 'Add a free-text note against any person\'s attendance entry. Also supports welfare notes and missed-attendance notes.', 'Log notes')

    h2(doc, '5.2  Requests and Leave Inbox', bid=10, bname='sec_inbox')
    bullet(doc, 'All pending signup requests, MC requests, and leave requests appear in one unified inbox. Each signup is labelled New or Returning so supervisors know at a glance whether they are onboarding or re-enrolling.', 'Unified inbox')
    bullet(doc, 'Select multiple leave requests and approve or reject them in a single action. Bulk rejection requires a written reason stored against each request.', 'Bulk leave actions')
    bullet(doc, 'Select-all checkbox in the signup section selects all visible pending signups, filtered by the search box.', 'Select-all for signups')
    bullet(doc, 'Rejected signup requests can be re-opened and returned to pending status if the decision needs to be reversed.', 'Reopen rejected signups')

    h2(doc, '5.3  Personnel Management', bid=11, bname='sec_people')
    bullet(doc, 'Lists all personnel in the current cycle with their attendance rate. Personnel below 75% are flagged with an amber indicator.', 'Personnel roster')
    bullet(doc, 'Click any person\'s card to open their full attendance history across all cycles, with status filters and pagination. Exportable to Excel.', 'Per-person history')
    bullet(doc, 'Add multiple reservists at once by pasting a list of names and contact numbers.', 'Bulk add')
    bullet(doc, 'Reset any reservist\'s password directly from the roster without requiring database access.', 'Password reset')
    bullet(doc, 'Search across all cycles and all personnel by name, contact, or status. Supports permanent deletion and bulk delete.', 'Cross-cycle member search')

    h2(doc, '5.4  Cycle Management and Export', bid=12, bname='sec_cycle')
    bullet(doc, 'Create and label reporting cycles. The system prepares the next 8 cycles automatically on every admin login.', 'Cycle management')
    bullet(doc, 'Mark any date as a no-report day. Paste a list of dates to mark multiple days at once. Singapore public holidays are excluded automatically.', 'No-report day control')
    bullet(doc, 'Post a short notice that appears on every reservist\'s check-in screen for the duration of the cycle, scoped to the active department only.', 'Cycle notice board')
    bullet(doc, 'Enable or disable meal allowance per cycle. When active, the work timer and meal eligibility calculations are shown to reservists.', 'Meal allowance toggle')
    bullet(doc, 'Export the full attendance matrix as an Excel spreadsheet with per-person rates, colour-coded cells, and a meal claims column.', 'Excel export')
    bullet(doc, 'Generate a formatted A4 attendance report, printable or saveable as PDF directly from the browser.', 'Print report')
    bullet(doc, 'One tap generates the day\'s attendance summary as a WhatsApp-ready message with a preview, copy, and direct-send option.', 'WhatsApp summary')

    # ============================================================
    # SECTIONS 6 - 7  (same page)
    # ============================================================
    page_break(doc)

    h1(doc, 6, 'Features: For Master Level', bid=13, bname='sec_master')
    body(doc, 'The Master account holds all supervisor capabilities plus the following additional controls:')
    spacer(doc, 4)
    bullet(doc, 'Switch the admin view between departments (Ops Security and Crime Alert/CAS) using a dropdown in the header. Each department\'s last-selected cycle is remembered independently.', 'Department switcher')
    bullet(doc, 'All data is fully scoped to the active department. Switching clears the current view and reloads fresh data for the selected department.', 'Cross-department isolation')
    bullet(doc, 'Add new supervisor accounts directly within the app. Demote any admin back to reservist status, or promote any reservist to admin.', 'Supervisor account management')
    bullet(doc, 'Reset any supervisor\'s password directly from the Team tab, without requiring database access.', 'Supervisor password reset')

    divider(doc)

    h1(doc, 7, 'Data Privacy', bid=14, bname='sec_privacy')
    body(doc, 'ReservistGO collects only what is operationally necessary.')
    spacer(doc, 8)

    clean_table(doc,
        ['What is stored', 'What is NOT stored'],
        [
            ('Name, phone number, and attendance records',      'NRIC, rank, or service details'),
            ('Distance from HQ in metres at check-in only',    'Location history or exact GPS coordinates'),
            ('Profile photo (optional, removable at any time)','Device identifiers or browser fingerprints'),
            ('Encrypted passwords via authentication service', 'Passwords in plain text (inaccessible even to admins)'),
            ('Temporary browser session (cleared on tab close)','Persistent login data stored on the device'),
        ],
        col_widths=[8.0, 8.2]
    )

    body(doc,
        'Sessions are cleared when the browser tab is closed or after 20 minutes of inactivity. '
        'Passwords are encrypted before storage and are inaccessible to all accounts including the Master.')

    # ============================================================
    # SECTION 8: Technical Overview
    # ============================================================
    page_break(doc)

    h1(doc, 8, 'Technical Overview', bid=15, bname='sec_tech')
    body(doc,
        'A brief non-technical summary of the components that power the system. '
        'No specialist knowledge is needed to operate the system day-to-day.')
    spacer(doc, 8)

    clean_table(doc,
        ['Component', 'Technology', 'What it does'],
        [
            ('The app',        'Vanilla JavaScript',   'Runs entirely in the browser. No framework or app installation required.'),
            ('Database',       'Supabase / PostgreSQL', 'Stores all personnel, attendance, and leave records. Managed, hosted, and automatically backed up.'),
            ('Login',          'Supabase Auth',         'Handles all password security. Passwords are encrypted before storage.'),
            ('Live updates',   'Supabase Realtime',     'Pushes attendance changes to all connected supervisors instantly, without any page refresh.'),
            ('Profile photos', 'Supabase Storage',      'Profile pictures stored in the cloud, isolated per user.'),
            ('Hosting',        'Vercel',                'Deployed on a global CDN. Loads quickly regardless of network conditions. Zero server maintenance.'),
            ('Offline support','Service Worker',        'Caches the app and queues check-in actions when there is no internet connection.'),
        ],
        col_widths=[3.0, 3.5, 9.7]
    )

    body(doc,
        'The system requires no dedicated servers, no IT maintenance, and no per-device setup. '
        'Updates are deployed instantly to all users without anyone needing to refresh or reinstall.')

    # ============================================================
    # SECTION 9: Planned Enhancements
    # ============================================================
    page_break(doc)

    h1(doc, 9, 'Planned Enhancements', bid=16, bname='sec_roadmap')
    body(doc,
        'The following improvements are planned to make the system fully self-managed by supervisors, '
        'requiring no developer involvement after initial deployment. '
        'Items are ordered from lowest to highest implementation complexity.')

    h2(doc, '9.1  Quick Wins', bid=17, bname='sec_r_quick')
    body(doc, 'Configuration and database changes that can be delivered quickly with immediate operational impact.')
    spacer(doc, 8)

    roadmap_table(doc, [
        (1, 'Editable reporting timings',
         'Phase windows (0900, 1200, 1400, 1800) are currently fixed constants. Moving them into the database per cycle lets supervisors set different reporting hours from within the app. Phase reminders, the work timer, and meal eligibility all update automatically.',
         'Quick win'),
        (2, 'Editable Info tab content',
         'Attire requirements, meal form links, and dekit checklists are currently hardcoded. An edit form in the cycle management panel lets supervisors keep this content current without touching any files.',
         'Quick win'),
        (3, 'WhatsApp group link in database',
         'The unit WA group link is currently set once at deployment. Moving it to a department record lets supervisors update it from within the app when the group changes.',
         'Quick win'),
        (4, 'Multiple shifts per department',
         'The system currently supports one shift type. Extending to AM, PM, Night, and custom shifts (each with configurable phase windows) supports departments with rotating schedules.',
         'Quick win'),
        (5, 'Per-cycle GPS location and radius',
         'HQ coordinates and the check-in radius are currently deployment-level settings. Storing them per cycle allows supervisors to run cycles at different venues without a code deployment.',
         'Quick win'),
    ])

    h2(doc, '9.2  Medium Effort', bid=18, bname='sec_r_medium')
    body(doc, 'More involved changes requiring database schema updates or new service integrations.')
    spacer(doc, 8)

    roadmap_table(doc, [
        (6, 'Department CRUD',
         'Departments are currently a fixed database type. Migrating to a departments table lets the Master account create and manage departments from within the app. This is the prerequisite for item 7.',
         'Medium'),
        (7, 'Per-department configuration panel',
         'Once departments are table-driven, each department stores its own HQ coordinates, phase windows, WA group link, and Info tab content. A Settings panel in the app replaces all deployment-time configuration.',
         'Medium'),
        (8, 'Shift scheduler',
         'Pre-assign which reservists report on which days. Generates the expected attendance list per date so mark-all-absent only targets scheduled personnel, not the full roster.',
         'Medium'),
        (9, 'Push notifications',
         'The service worker is already in place. Adding Web Push lets reservists receive reminders when a phase window opens, and supervisors receive alerts on new requests without needing the app open.',
         'Medium'),
        (10, 'Audit log viewer',
         'A read-only log of all supervisor actions (status overrides, time corrections, approvals, account changes) surfaced as a tab for the Master account.',
         'Medium'),
    ])

    h2(doc, '9.3  Larger Scope', bid=19, bname='sec_r_large')
    body(doc, 'Significant changes that would make the system entirely self-contained after initial deployment.')
    spacer(doc, 8)

    roadmap_table(doc, [
        (11, 'In-app configuration editor',
         'Replace all deployment-time configuration (org name, accent colour, HQ location) with a Settings panel inside the app. After initial deployment, no files ever need to be edited again.',
         'Large scope'),
        (12, 'Scoped department access for supervisors',
         'Currently all admins in a department see all data for that department. As more departments are added, supervisors may need to be scoped to one department, with the Master retaining full cross-department visibility.',
         'Large scope'),
        (13, 'Automated attendance summaries',
         'Scheduled daily and weekly reports sent to the supervisor\'s WhatsApp or email covering attendance rate, pending leave requests, and missing clock-outs. Requires a messaging API integration.',
         'Large scope'),
        (14, 'Equipment and dekit tracking',
         'Track issued items per reservist per cycle and record return status at dekit. Fits naturally into the existing cycle lifecycle alongside the dekit date already stored on each cycle.',
         'Large scope'),
    ])

    out = 'ReservistGO_Overview.docx'
    doc.save(out)
    print(f'Saved: {out}')

if __name__ == '__main__':
    build()
