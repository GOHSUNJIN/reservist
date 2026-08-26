"""
Run:  python scripts/generate_doc.py
Output: ReservistGO_Overview.docx  (in project root)
Requires: pip install python-docx
"""

from docx import Document
from docx.shared import Pt, Cm, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import datetime

ACCENT = RGBColor(0x2F, 0x5F, 0xD0)
DARK   = RGBColor(0x16, 0x1F, 0x30)
MID    = RGBColor(0x4A, 0x5A, 0x72)
LIGHT  = RGBColor(0x8A, 0x94, 0xA3)
WHITE  = RGBColor(0xFF, 0xFF, 0xFF)
SOFT   = RGBColor(0xEE, 0xF3, 0xFC)

def set_cell_bg(cell, hex_color):
    tc   = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd  = OxmlElement('w:shd')
    shd.set(qn('w:val'),   'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'),  hex_color)
    tcPr.append(shd)

def set_cell_borders(cell, top=None, bottom=None, left=None, right=None):
    tc   = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcBorders = OxmlElement('w:tcBorders')
    for side, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        if val:
            el = OxmlElement(f'w:{side}')
            el.set(qn('w:val'),   val.get('val', 'single'))
            el.set(qn('w:sz'),    str(val.get('sz', 6)))
            el.set(qn('w:space'), '0')
            el.set(qn('w:color'), val.get('color', 'auto'))
            tcBorders.append(el)
    tcPr.append(tcBorders)

def remove_table_borders(table):
    tbl  = table._tbl
    tblPr = tbl.find(qn('w:tblPr'))
    if tblPr is None:
        tblPr = OxmlElement('w:tblPr')
        tbl.insert(0, tblPr)
    tblBorders = OxmlElement('w:tblBorders')
    for side in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        el = OxmlElement(f'w:{side}')
        el.set(qn('w:val'), 'none')
        tblBorders.append(el)
    tblPr.append(tblBorders)

def add_bookmark(para, bookmark_id, name):
    run   = para.add_run()
    start = OxmlElement('w:bookmarkStart')
    start.set(qn('w:id'),   str(bookmark_id))
    start.set(qn('w:name'), name)
    run._r.append(start)
    end = OxmlElement('w:bookmarkEnd')
    end.set(qn('w:id'), str(bookmark_id))
    run._r.append(end)

def add_toc_entry(doc, label, bookmark, level=1):
    para = doc.add_paragraph()
    para.paragraph_format.space_before = Pt(1)
    para.paragraph_format.space_after  = Pt(1)
    indent = Cm(0.5 * (level - 1))
    para.paragraph_format.left_indent  = indent

    fld_char_begin = OxmlElement('w:fldChar')
    fld_char_begin.set(qn('w:fldCharType'), 'begin')
    r1 = OxmlElement('w:r')
    r1.append(fld_char_begin)

    instr = OxmlElement('w:instrText')
    instr.set(qn('xml:space'), 'preserve')
    instr.text = f' REF {bookmark} \\h '
    r2 = OxmlElement('w:r')
    r2.append(instr)

    fld_char_sep = OxmlElement('w:fldChar')
    fld_char_sep.set(qn('w:fldCharType'), 'separate')
    r3 = OxmlElement('w:r')
    r3.append(fld_char_sep)

    run = para.add_run(label)
    run.font.size  = Pt(10.5 if level == 1 else 10)
    run.font.color.rgb = ACCENT if level == 1 else MID
    run.font.bold  = (level == 1)
    para._p.insert(0, r1)
    para._p.insert(1, r2)
    para._p.insert(2, r3)

    fld_char_end = OxmlElement('w:fldChar')
    fld_char_end.set(qn('w:fldCharType'), 'end')
    r4 = OxmlElement('w:r')
    r4.append(fld_char_end)
    para._p.append(r4)
    return para

def heading(doc, text, level, bookmark_id=None, bookmark_name=None):
    para = doc.add_heading(text, level=level)
    if level == 1:
        para.runs[0].font.color.rgb = DARK
        para.runs[0].font.size = Pt(16)
    elif level == 2:
        para.runs[0].font.color.rgb = ACCENT
        para.runs[0].font.size = Pt(13)
    elif level == 3:
        para.runs[0].font.color.rgb = MID
        para.runs[0].font.size = Pt(11.5)
    if bookmark_id is not None:
        add_bookmark(para, bookmark_id, bookmark_name)
    return para

def body(doc, text, bold_prefix=None):
    para = doc.add_paragraph()
    para.paragraph_format.space_before = Pt(2)
    para.paragraph_format.space_after  = Pt(4)
    if bold_prefix:
        run = para.add_run(bold_prefix + ' ')
        run.bold = True
        run.font.color.rgb = DARK
        run.font.size = Pt(10.5)
        rest = para.add_run(text)
        rest.font.size = Pt(10.5)
        rest.font.color.rgb = MID
    else:
        run = para.add_run(text)
        run.font.size = Pt(10.5)
        run.font.color.rgb = MID
    return para

def bullet(doc, text, bold_label=None, level=1):
    style = 'List Bullet' if level == 1 else 'List Bullet 2'
    para = doc.add_paragraph(style=style)
    para.paragraph_format.space_before = Pt(1)
    para.paragraph_format.space_after  = Pt(2)
    if bold_label:
        run = para.add_run(bold_label + ': ')
        run.bold = True
        run.font.color.rgb = DARK
        run.font.size = Pt(10.5)
        rest = para.add_run(text)
        rest.font.size = Pt(10.5)
        rest.font.color.rgb = MID
    else:
        run = para.add_run(text)
        run.font.size = Pt(10.5)
        run.font.color.rgb = MID
    return para

def divider(doc):
    para = doc.add_paragraph()
    para.paragraph_format.space_before = Pt(4)
    para.paragraph_format.space_after  = Pt(4)
    pPr = para._p.get_or_add_pPr()
    pBdr = OxmlElement('w:pBdr')
    bottom = OxmlElement('w:bottom')
    bottom.set(qn('w:val'),   'single')
    bottom.set(qn('w:sz'),    '4')
    bottom.set(qn('w:space'), '1')
    bottom.set(qn('w:color'), 'C8D0DC')
    pBdr.append(bottom)
    pPr.append(pBdr)

def styled_table(doc, headers, rows, col_widths=None):
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    remove_table_borders(table)

    hdr_row = table.rows[0]
    for i, h in enumerate(headers):
        cell = hdr_row.cells[i]
        set_cell_bg(cell, '2F5FD0')
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        para = cell.paragraphs[0]
        para.paragraph_format.space_before = Pt(4)
        para.paragraph_format.space_after  = Pt(4)
        run = para.add_run(h)
        run.bold = True
        run.font.color.rgb = WHITE
        run.font.size = Pt(10)

    for r_idx, row_data in enumerate(rows):
        row = table.rows[r_idx + 1]
        bg = 'F4F6FB' if r_idx % 2 == 0 else 'FFFFFF'
        for c_idx, val in enumerate(row_data):
            cell = row.cells[c_idx]
            set_cell_bg(cell, bg)
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            para = cell.paragraphs[0]
            para.paragraph_format.space_before = Pt(3)
            para.paragraph_format.space_after  = Pt(3)
            if isinstance(val, tuple):
                run = para.add_run(val[0])
                run.bold = True
                run.font.size = Pt(10)
                run.font.color.rgb = DARK
                rest = para.add_run(' ' + val[1])
                rest.font.size = Pt(10)
                rest.font.color.rgb = MID
            else:
                run = para.add_run(str(val))
                run.font.size = Pt(10)
                run.font.color.rgb = MID

    if col_widths:
        for i, w in enumerate(col_widths):
            for row in table.rows:
                row.cells[i].width = Cm(w)

    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return table

def roadmap_table(doc, rows):
    table = doc.add_table(rows=1 + len(rows), cols=3)
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    remove_table_borders(table)

    headers = ['#', 'Enhancement', 'Effort']
    hdr_row = table.rows[0]
    for i, h in enumerate(headers):
        cell = hdr_row.cells[i]
        set_cell_bg(cell, '2F5FD0')
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        para = cell.paragraphs[0]
        para.paragraph_format.space_before = Pt(4)
        para.paragraph_format.space_after  = Pt(4)
        run = para.add_run(h)
        run.bold = True
        run.font.color.rgb = WHITE
        run.font.size = Pt(10)

    effort_colors = {'Quick win': ('E7F3EC', '1F8A5B'), 'Medium': ('FDF6E9', 'B9791A'), 'Large scope': ('F7E4E1', 'C0392B')}

    for r_idx, (num, label, desc, effort) in enumerate(rows):
        row = table.rows[r_idx + 1]
        bg = 'F4F6FB' if r_idx % 2 == 0 else 'FFFFFF'

        set_cell_bg(row.cells[0], bg)
        p0 = row.cells[0].paragraphs[0]
        p0.paragraph_format.space_before = Pt(3)
        p0.paragraph_format.space_after  = Pt(3)
        r0 = p0.add_run(str(num))
        r0.bold = True
        r0.font.size = Pt(10)
        r0.font.color.rgb = ACCENT

        set_cell_bg(row.cells[1], bg)
        p1 = row.cells[1].paragraphs[0]
        p1.paragraph_format.space_before = Pt(3)
        p1.paragraph_format.space_after  = Pt(3)
        r1a = p1.add_run(label + '\n')
        r1a.bold = True
        r1a.font.size = Pt(10)
        r1a.font.color.rgb = DARK
        r1b = p1.add_run(desc)
        r1b.font.size = Pt(9.5)
        r1b.font.color.rgb = MID

        ebg, efg = effort_colors.get(effort, ('EEF3FC', '2F5FD0'))
        set_cell_bg(row.cells[2], ebg)
        p2 = row.cells[2].paragraphs[0]
        p2.paragraph_format.space_before = Pt(3)
        p2.paragraph_format.space_after  = Pt(3)
        p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r2 = p2.add_run(effort)
        r2.bold = True
        r2.font.size = Pt(9.5)
        r2.font.color.rgb = RGBColor(int(efg[0:2],16), int(efg[2:4],16), int(efg[4:6],16))

    for row in table.rows:
        row.cells[0].width = Cm(1.0)
        row.cells[1].width = Cm(12.5)
        row.cells[2].width = Cm(2.8)

    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return table

def page_break(doc):
    doc.add_page_break()

def build():
    doc = Document()

    # Page margins
    for section in doc.sections:
        section.top_margin    = Cm(2.0)
        section.bottom_margin = Cm(2.0)
        section.left_margin   = Cm(2.5)
        section.right_margin  = Cm(2.5)

    # Default paragraph style
    style = doc.styles['Normal']
    style.font.name = 'Calibri'
    style.font.size = Pt(10.5)

    # ── COVER PAGE ─────────────────────────────────────────────────────────────
    for _ in range(5):
        doc.add_paragraph()

    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    tr = title.add_run('ReservistGO')
    tr.font.size  = Pt(36)
    tr.font.bold  = True
    tr.font.color.rgb = ACCENT

    sub = doc.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sr = sub.add_run('Digital Attendance Management System')
    sr.font.size  = Pt(16)
    sr.font.color.rgb = MID

    doc.add_paragraph()

    date_p = doc.add_paragraph()
    date_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    dr = date_p.add_run(datetime.datetime.now().strftime('%B %Y'))
    dr.font.size  = Pt(12)
    dr.font.color.rgb = LIGHT

    for _ in range(8):
        doc.add_paragraph()

    tagline = doc.add_paragraph()
    tagline.alignment = WD_ALIGN_PARAGRAPH.CENTER
    tl = tagline.add_run('Prepared for Supervisors and Operations Staff')
    tl.font.size  = Pt(11)
    tl.font.color.rgb = LIGHT
    tl.font.italic = True

    page_break(doc)

    # ── TABLE OF CONTENTS ──────────────────────────────────────────────────────
    heading(doc, 'Table of Contents', 1)
    divider(doc)
    doc.add_paragraph()

    toc_entries = [
        ('1.  Overview',                          'sec_overview',   1),
        ('2.  What Problem It Solves',             'sec_problem',    1),
        ('3.  Access Roles',                       'sec_roles',      1),
        ('4.  Features: For Reservists',           'sec_reservist',  1),
        ('    4.1  Check-In and GPS',              'sec_checkin',    2),
        ('    4.2  Leave and MC Requests',         'sec_leave',      2),
        ('    4.3  Attendance and Calendar',       'sec_attendance', 2),
        ('    4.4  Safety and Reliability',        'sec_safety',     2),
        ('5.  Features: For Supervisors',          'sec_admin',      1),
        ('    5.1  Attendance Roster and Log',     'sec_roster',     2),
        ('    5.2  Requests and Leave Inbox',      'sec_requests',   2),
        ('    5.3  Personnel Management',          'sec_people',     2),
        ('    5.4  Cycle Management and Export',   'sec_cycle',      2),
        ('6.  Features: For Master Level',         'sec_master',     1),
        ('7.  Data Privacy',                       'sec_privacy',    1),
        ('8.  Technical Overview',                 'sec_tech',       1),
        ('9.  Planned Enhancements',               'sec_roadmap',    1),
        ('    9.1  Quick Wins',                    'sec_r_quick',    2),
        ('    9.2  Medium Effort',                 'sec_r_medium',   2),
        ('    9.3  Larger Scope',                  'sec_r_large',    2),
    ]

    for label, bm, level in toc_entries:
        add_toc_entry(doc, label, bm, level)

    page_break(doc)

    # ── 1. OVERVIEW ────────────────────────────────────────────────────────────
    h = heading(doc, '1. Overview', 1, 0, 'sec_overview')
    divider(doc)
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
        'screen for one-tap access.')
    body(doc,
        'A built-in demo mode on the login screen allows anyone to explore both the reservist and '
        'supervisor views without creating an account.')
    doc.add_paragraph()

    # ── 2. PROBLEM ─────────────────────────────────────────────────────────────
    heading(doc, '2. What Problem It Solves', 1, 1, 'sec_problem')
    divider(doc)
    body(doc, 'Before ReservistGO, attendance was tracked through a combination of paper sign-in sheets, '
         'manual WhatsApp headcounts, and verbal confirmation. This created several recurring problems:')

    bullet(doc, 'No single source of truth for who has reported. Supervisors had to consolidate information from multiple channels.')
    bullet(doc, 'No timestamped record. It was difficult to verify when a reservist actually checked in or whether they clocked out.')
    bullet(doc, 'Meal allowance errors. Without a reliable clock-out record, it was hard to confirm eligibility and handle corrections.')
    bullet(doc, 'Leave and MC tracking was informal. Requests came through messages and were not stored in a verifiable, auditable format.')
    bullet(doc, 'Absences were not automatically recorded. Someone had to manually identify and log no-shows each day.')

    doc.add_paragraph()
    body(doc, 'ReservistGO addresses all of these through a single system that all parties interact with directly.')
    doc.add_paragraph()

    # ── 3. ROLES ───────────────────────────────────────────────────────────────
    heading(doc, '3. Access Roles', 1, 2, 'sec_roles')
    divider(doc)
    body(doc, 'The system uses three permission levels. Each role sees only what is relevant to them.')
    doc.add_paragraph()

    styled_table(doc,
        ['Role', 'Who', 'Access'],
        [
            ('Reservist',  'NS personnel',             'Own check-in, leave requests, attendance history, team directory. Scoped to their department.'),
            ('Supervisor', 'Staff officers, supervisors', 'Full roster, attendance log, time correction, leave approval, personnel records, cycle management, exports. Scoped to their department.'),
            ('Master',     'Command level',            'Everything supervisors can do, plus managing all supervisor accounts and switching between departments.'),
        ],
        col_widths=[2.5, 4.0, 9.8]
    )
    doc.add_paragraph()

    # ── 4. RESERVIST FEATURES ──────────────────────────────────────────────────
    page_break(doc)
    heading(doc, '4. Features: For Reservists', 1, 3, 'sec_reservist')
    divider(doc)

    heading(doc, '4.1  Check-In and GPS', 2, 4, 'sec_checkin')
    bullet(doc, 'Ops Security reservists log four phases: check in, lunch out, return from lunch, and end of shift. CAS reservists use a simplified two-phase flow: check in and check out only. Each phase is timestamped to the minute.', 'Department-based check-in')
    bullet(doc, 'Tapping a check-in phase shows a "Locate me" button first. After GPS confirms the reservist is within range of HQ, the button changes to "Check in to work". Distance from HQ is recorded against the entry. The radius is configurable.', 'Sequential GPS flow')
    bullet(doc, 'After two failed GPS attempts, a bypass option appears. Bypassed check-ins are permanently flagged in the log so supervisors are aware.', 'GPS bypass')
    bullet(doc, 'If opened from WhatsApp, Instagram, or another in-app browser where GPS access is blocked, the app shows specific instructions for switching to the device browser.', 'In-app browser detection')
    bullet(doc, 'If connectivity is lost during check-in, the action is saved on the device and submitted automatically once the connection is restored.', 'Offline check-in')
    bullet(doc, 'If checking in more than one hour after shift start, the reservist is prompted for a written reason before the check-in is accepted. The reason is stored alongside the attendance record.', 'Late check-in declaration')
    doc.add_paragraph()

    heading(doc, '4.2  Leave and MC Requests', 2, 5, 'sec_leave')
    bullet(doc, 'Reservists submit MC, personal leave, or other leave requests directly through the app. Requests go to the supervisor\'s inbox with no phone calls or messages needed.', 'Digital leave submission')
    bullet(doc, 'A pending request can be withdrawn by the reservist before the supervisor has acted on it, from both the check-in screen and the Requests history.', 'Cancel pending requests')
    bullet(doc, 'The Requests history tab shows the status of all past requests including approval, rejection with reason, and withdrawal.', 'Request history')
    doc.add_paragraph()

    heading(doc, '4.3  Attendance and Calendar', 2, 6, 'sec_attendance')
    bullet(doc, 'The attendance calendar shows the full record for the current cycle: present days (green), MC (amber), absences, and no-report days (slate blue).', 'Attendance calendar')
    bullet(doc, 'Pending MC requests appear with a lighter amber tint and a dashed border so reservists can see which days have been covered.', 'MC calendar coloring')
    bullet(doc, 'If a past day has no clock-out recorded, that calendar day is coloured orange with a dashed border. A persistent warning also appears on the check-in screen.', 'Missing clock-out detection')
    bullet(doc, 'A banner appears automatically when a check-in phase window is open and the phase has not yet been recorded. It disappears once the phase is submitted.', 'Phase reminder banner')
    bullet(doc, 'All remaining no-report days in the current cycle are listed so reservists can plan ahead.', 'Upcoming no-report days')
    bullet(doc, 'When meal allowance is active, a live timer shows total work time for the day, paused during lunch. A "Meal eligible" badge appears once 6 hours of work is reached.', 'Work timer and meal eligibility')
    doc.add_paragraph()

    heading(doc, '4.4  Safety and Reliability', 2, 7, 'sec_safety')
    bullet(doc, 'A confirmation step appears before logging out, preventing accidental session loss.', 'Logout confirmation')
    bullet(doc, 'A warning appears at 55 minutes with a one-tap option to extend the session before it expires at 60 minutes. Sessions also expire after 20 minutes of inactivity, with a warning at 18 minutes.', 'Session and idle warnings')
    bullet(doc, 'Reservists can upload a profile photo from account settings. Tapping a photo anywhere in the app opens it enlarged.', 'Profile photo')
    doc.add_paragraph()

    # ── 5. SUPERVISOR FEATURES ─────────────────────────────────────────────────
    page_break(doc)
    heading(doc, '5. Features: For Supervisors', 1, 8, 'sec_admin')
    divider(doc)

    heading(doc, '5.1  Attendance Roster and Log', 2, 9, 'sec_roster')
    bullet(doc, 'The roster updates in real time as reservists check in. No manual refresh is needed.', 'Live attendance board')
    bullet(doc, 'Filter the roster by All, Present, MC, Absent, or Pending. Filter by name. Day navigation moves between dates by swipe or button. Jump directly to any date using the date picker.', 'Filters, search, and navigation')
    bullet(doc, 'Mark any reservist as Present, MC, or Absent directly from the roster. Mark all pending as absent or present in a single action, with a required confirmation step.', 'Manual status override')
    bullet(doc, 'Edit any reservist\'s check-in times for any phase on any day. Corrected records are flagged as admin-entered with the editor\'s name and timestamp.', 'Time correction')
    bullet(doc, 'Late check-ins (over one hour after shift start) are automatically flagged in the log with the reservist\'s written reason displayed alongside the record.', 'Late check-in alerts')
    bullet(doc, 'Any log entry where a reservist is present but has no clock-out time is flagged with a visible badge, making it easy to identify and correct before meal allowance is processed.', 'Missing clock-out flag')
    bullet(doc, 'Add a free-text note against any person\'s attendance entry. Also supports welfare notes and missed-attendance notes.', 'Log notes')
    doc.add_paragraph()

    heading(doc, '5.2  Requests and Leave Inbox', 2, 10, 'sec_requests')
    bullet(doc, 'All pending signup requests, MC requests, and leave requests appear in one unified inbox. Each signup is labelled New or Returning.', 'Unified inbox')
    bullet(doc, 'Select multiple leave requests and approve or reject them in a single action. Bulk rejection requires a written reason stored against each rejected request.', 'Bulk leave actions')
    bullet(doc, 'A checkbox in the signup section header selects or deselects all visible pending signups. Filtered by the search box, so select-all only acts on visible results.', 'Select-all for signups')
    bullet(doc, 'Rejected signup requests can be re-opened and returned to pending status if the decision needs to be reversed.', 'Reopen rejected signups')
    doc.add_paragraph()

    heading(doc, '5.3  Personnel Management', 2, 11, 'sec_people')
    bullet(doc, 'Lists all personnel in the current cycle with their attendance rate. Personnel below 75% attendance are flagged with an amber indicator.', 'Personnel roster')
    bullet(doc, 'Click any person\'s card to open their full attendance history across all cycles, with status filters and pagination. Exportable to Excel.', 'Per-person history')
    bullet(doc, 'Add multiple reservists at once by pasting a list of names and contact numbers.', 'Bulk add')
    bullet(doc, 'Reset any reservist\'s password directly from the roster without requiring database access.', 'Password reset')
    bullet(doc, 'Search across all cycles and all personnel by name, contact, or status. Supports permanent deletion and bulk delete.', 'Cross-cycle member search')
    doc.add_paragraph()

    heading(doc, '5.4  Cycle Management and Export', 2, 12, 'sec_cycle')
    bullet(doc, 'Create and label reporting cycles. The system prepares the next 8 cycles automatically on every admin login.', 'Cycle management')
    bullet(doc, 'Mark any date as a no-report day. Paste a list of dates to mark multiple days at once. Singapore public holidays are excluded automatically.', 'No-report day control')
    bullet(doc, 'Post a short notice that appears on every reservist\'s check-in screen for the duration of the cycle.', 'Cycle notice board')
    bullet(doc, 'Enable or disable meal allowance per cycle. When active, the work timer and meal eligibility calculations are shown to reservists.', 'Meal allowance toggle')
    bullet(doc, 'Export the full attendance matrix as an Excel spreadsheet with per-person rates, totals, colour-coded cells, and a meal claims column.', 'Excel export')
    bullet(doc, 'Generate a formatted A4 attendance report, printable or saveable as PDF directly from the browser.', 'Print report')
    bullet(doc, 'One tap generates the day\'s attendance summary as a WhatsApp message with a preview, copy, and direct-send option.', 'WhatsApp summary')
    doc.add_paragraph()

    # ── 6. MASTER ──────────────────────────────────────────────────────────────
    page_break(doc)
    heading(doc, '6. Features: For Master Level', 1, 13, 'sec_master')
    divider(doc)
    body(doc, 'The Master account has all supervisor capabilities, plus the following:')
    doc.add_paragraph()
    bullet(doc, 'Switch the entire admin view between departments (Ops Security and Crime Alert/CAS) using a dropdown in the header. Each department\'s last-selected cycle is remembered independently.', 'Department switcher')
    bullet(doc, 'All data (personnel, cycles, attendance, leave requests, and realtime updates) is fully scoped to the active department. Switching departments clears the current view and reloads fresh data.', 'Cross-department isolation')
    bullet(doc, 'Add new supervisor accounts directly within the app. Demote any admin back to reservist status, or promote any existing reservist to admin.', 'Supervisor account management')
    bullet(doc, 'Reset any supervisor\'s password directly from the Team tab, without database access.', 'Supervisor password reset')
    bullet(doc, 'Displayed with a Master label in the interface to distinguish from regular supervisors.', 'Master label')
    doc.add_paragraph()

    # ── 7. PRIVACY ─────────────────────────────────────────────────────────────
    heading(doc, '7. Data Privacy', 1, 14, 'sec_privacy')
    divider(doc)
    body(doc, 'ReservistGO collects only what is operationally necessary.')
    doc.add_paragraph()

    styled_table(doc,
        ['What is stored', 'What is not stored'],
        [
            ('Name, phone number, attendance records', 'NRIC, rank, or service details'),
            ('Distance from HQ in metres at check-in only', 'Location history or exact coordinates'),
            ('Profile photo (optional, removable)', 'Device identifiers or browser fingerprints'),
            ('Encrypted passwords (via authentication service)', 'Passwords in plain text (never accessible to admins)'),
            ('Temporary session in browser memory', 'Persistent login data on the device'),
        ],
        col_widths=[8.1, 8.1]
    )
    body(doc, 'Sessions are held in the browser\'s temporary memory and are cleared when the tab is closed or after 20 minutes of inactivity. All passwords are encrypted by the authentication service before storage. Even administrators cannot view a user\'s password.')
    doc.add_paragraph()

    # ── 8. TECH ────────────────────────────────────────────────────────────────
    heading(doc, '8. Technical Overview', 1, 15, 'sec_tech')
    divider(doc)
    body(doc, 'This section is a brief non-technical summary of the components that power the system.')
    doc.add_paragraph()

    styled_table(doc,
        ['Component', 'Technology', 'What it does'],
        [
            ('The app',        'Vanilla JavaScript',  'Runs entirely in the browser. No third-party framework.'),
            ('Database',       'Supabase (PostgreSQL)','Stores all personnel records, attendance, and leave requests. Managed and automatically backed up.'),
            ('Login/accounts', 'Supabase Auth',       'Handles all password security. Passwords are encrypted before storage.'),
            ('Live updates',   'Supabase Realtime',   'Pushes attendance changes to all connected supervisors instantly, without any page refresh.'),
            ('Profile photos', 'Supabase Storage',    'Profile pictures stored in the cloud, isolated per user.'),
            ('Hosting',        'Vercel',              'Deployed globally on a CDN. Loads quickly regardless of network conditions. Zero server maintenance.'),
            ('Offline support','Service Worker',      'Caches the app and queues check-in actions when there is no internet connection.'),
        ],
        col_widths=[3.0, 3.5, 9.7]
    )

    body(doc, 'The system requires no dedicated servers, no IT maintenance, and no per-device setup. '
         'Updates to the app are deployed instantly to all users without anyone needing to refresh or reinstall.')
    doc.add_paragraph()

    # ── 9. ROADMAP ─────────────────────────────────────────────────────────────
    page_break(doc)
    heading(doc, '9. Planned Enhancements', 1, 16, 'sec_roadmap')
    divider(doc)
    body(doc, 'The following improvements are planned to make the system fully self-managed by supervisors, '
         'requiring no developer involvement after initial deployment. Items are grouped by implementation effort.')
    doc.add_paragraph()

    heading(doc, '9.1  Quick Wins', 2, 17, 'sec_r_quick')
    body(doc, 'Low-complexity changes that deliver immediate operational value.')
    doc.add_paragraph()

    roadmap_table(doc, [
        (1, 'Editable reporting timings',
         'Phase windows (0900, 1200, 1400, 1800) are currently fixed. Moving them to the database per cycle lets supervisors set different reporting hours for each cycle from within the app.',
         'Quick win'),
        (2, 'Editable Info tab content',
         'Attire requirements, meal form links, and dekit checklists are currently hardcoded. An edit form in the cycle management panel lets supervisors keep this content current.',
         'Quick win'),
        (3, 'WhatsApp group link in database',
         'The unit WA group link is currently set at deployment. Moving it to a department record lets supervisors update it from within the app when the group changes.',
         'Quick win'),
        (4, 'Multiple shifts per department',
         'The system currently supports one shift type. Extending to AM, PM, Night, and custom shifts (each with their own phase windows) supports departments with rotating schedules.',
         'Quick win'),
        (5, 'Per-cycle GPS location and radius',
         'HQ coordinates and the accepted check-in radius are currently deployment-level settings. Storing them per cycle allows supervisors to run cycles at different venues without a code deployment.',
         'Quick win'),
    ])

    heading(doc, '9.2  Medium Effort', 2, 18, 'sec_r_medium')
    body(doc, 'More involved changes that require schema or architecture updates.')
    doc.add_paragraph()

    roadmap_table(doc, [
        (6, 'Department CRUD',
         'Departments are currently defined as a fixed database type. Migrating to a departments table lets the Master account create and manage departments from within the app. This is the prerequisite for item 7.',
         'Medium'),
        (7, 'Per-department configuration panel',
         'Once departments are table-driven, each department can store its own HQ coordinates, phase windows, WA group link, and Info tab content. A Settings panel in the app replaces all deployment-time configuration.',
         'Medium'),
        (8, 'Shift scheduler',
         'Pre-assign which reservists report on which days. This generates the expected attendance list per date so mark-all-absent only targets scheduled personnel.',
         'Medium'),
        (9, 'Push notifications',
         'The service worker is already in place. Adding Web Push allows reservists to receive reminders when a phase window opens, and supervisors to be alerted on new requests without having the app open.',
         'Medium'),
        (10, 'Audit log viewer',
         'A read-only log of all supervisor actions (status overrides, time corrections, approvals, account changes) surfaced as a tab for the Master account.',
         'Medium'),
    ])

    heading(doc, '9.3  Larger Scope', 2, 19, 'sec_r_large')
    body(doc, 'Significant changes that would make the system entirely self-contained after initial deployment.')
    doc.add_paragraph()

    roadmap_table(doc, [
        (11, 'In-app configuration editor',
         'Replace all deployment-time configuration (org name, accent colour, HQ location) with a Settings panel inside the app. After initial deployment, no files ever need to be edited again.',
         'Large scope'),
        (12, 'Scoped department access for supervisors',
         'Currently all admins in a department see all data in that department. As more departments are added, supervisors may need to be scoped to one department with the Master retaining full cross-department visibility.',
         'Large scope'),
        (13, 'Automated attendance summaries',
         'Scheduled daily and weekly reports sent to the supervisor\'s WhatsApp or email covering attendance rate, pending leave requests, and missing clock-outs. Requires a messaging API integration.',
         'Large scope'),
        (14, 'Equipment and dekit tracking',
         'Track issued items per reservist per cycle and record return status at dekit. Fits into the existing cycle lifecycle alongside the dekit date already stored on each cycle.',
         'Large scope'),
    ])

    # ── SAVE ───────────────────────────────────────────────────────────────────
    out = 'ReservistGO_Overview.docx'
    doc.save(out)
    print(f'Saved: {out}')

if __name__ == '__main__':
    build()
