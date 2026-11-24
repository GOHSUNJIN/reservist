# ReservistGO design rules

The rules the app follows. Keep new screens and changes to them. Values live in `css/styles.css` (`:root`) and `PAL` in `js/utils.js` (for SVG, which cannot read CSS variables).

## Colour

| Token | Value | Use |
|---|---|---|
| `--ink` | #161f30 | Headings, main text |
| `--ink-2` | #5c6678 | Secondary text, and grey text on tinted backgrounds |
| `--muted` | #667085 | Hints and captions on white only |
| `--muted-on-dark` | #9aa3b2 | Grey text on the navy cards and day bar |
| `--blue` | #2f5fd0 | Main actions, links, selected state |
| `--green` | #1a7a50 | Present, success |
| `--red` | #b0342a | Absent, errors, destructive actions |
| `--amber-text` | #8f5c10 | Warning text (late, pending notes) |
| `--amber-solid` | #9a6512 | Background behind white text (late Locate Me) |
| `--whatsapp` | #1a7f4b | WhatsApp actions only |

- Text must reach 4.5:1 against its background. Check gradients against their lightest stop.
- Don't type new hex colours for text. Use a token.

## Text

- 12px (`--fs-label`) is the floor, for labels and badges. 13px (`--fs-small`) for anything people need to read.
- Inputs and search boxes use 16px text so iPhones don't zoom in on focus.
- Capitalisation: Title Case for screen titles, nav tabs, section headings, buttons and tabs. Sentence case for body text, hints, errors, toasts and empty states. Keep PNSmen, SPF, DHQ, GPS and NRIC as written.
- The same action uses the same words everywhere ("Check In", never "Clock In").

## Corners

`--r-xs` 4px (badges) · `--r-sm` 8px (buttons) · `--r-md` 12px (inputs, search) · `--r-lg` 16px (cards, sheets) · `--r-pill` (chips and status pills only, never a card).

## Buttons: three sizes

Every button uses one of these classes. The class sets the visible height. The touch area is always at least 44px through an invisible `::after`, so a button never has to look 44px to be easy to tap.

| Class | Height | Use |
|---|---|---|
| `b-lg` | 48px | Full-width main buttons: Locate Me, Submit Request, Log In, Request Absence, Check Again, Log Out |
| `b-md` | 40px | Buttons inside rows, cards and the admin header: note, Absent, Edit, Approve/Decline, Bulk, +, Cycle, Go, day arrows |
| `b-sm` | 32px | Filter chips, sort and mark buttons, tabs, Excel, Prev/Next |

- Add `b-icon` for square icon-only buttons (40×40 or 32×32).
- Use `hit44` for text links that need a touch area but no box (Rename Cycle, Forgot Password?).
- Buttons side by side in a row are the same size class.

## Chips, search, close

- **Filter chips:** always `Utils.chip(active, accent)` with `b-sm`. Pill shape, white with grey border, department colour when selected.
- **Search boxes:** always `.search-field`. 40px, search icon left, 16px text, `.search-clear` (32px) on the right.
- **Close buttons on sheets and dialogs:** `.btn-circle`, a 32px grey circle. Banner dismiss ×: `.btn-dismiss` (28px, plain).
- **Sheets and dialogs:** `role="dialog" aria-modal="true"` and an `aria-label` that matches the title.

## Layout

- Check every screen at 390px and 320px. Nothing may scroll sideways. Names may shorten with … but must not drop to one or two letters. Move buttons to their own line instead.
- No box inside a box. Separate sections inside a card with a 1px divider.
- No coloured stripes (`border-left` thicker than 1px) on rows, cards or callouts. Status is shown with a pill.
- Respect reduced motion. Spinners pulse instead of spin, and nothing slides.
