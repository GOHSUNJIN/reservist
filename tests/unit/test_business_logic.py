"""
Unit tests for business logic rules replicated from utils.js.

These run with no external dependencies and validate the core numeric
thresholds and date-format rules that drive check-in and meal eligibility.
"""

import re
from datetime import date, timedelta


# ---------------------------------------------------------------------------
# Late detection
# ---------------------------------------------------------------------------

class TestLateThresholds:
    """Mirrors the late-detection logic in handlers/checkin.js and builders/admin/roster.js.

    Both the warning banner (shown to the reservist) and the admin 'Late' flag
    fire at 120 minutes after the person's p1_open time.
    """

    LATE_CUTOFF = "09:00"
    LATE_MINS = 120

    @staticmethod
    def hm_to_mins(hhmm: str) -> int:
        h, m = map(int, hhmm.split(":"))
        return h * 60 + m

    def mins_late(self, checkin: str) -> int:
        return self.hm_to_mins(checkin) - self.hm_to_mins(self.LATE_CUTOFF)

    def test_on_time_not_flagged(self):
        assert self.mins_late("08:55") < self.LATE_MINS

    def test_exactly_cutoff_not_flagged(self):
        assert self.mins_late("09:00") < self.LATE_MINS

    def test_119_mins_late_not_flagged(self):
        assert self.mins_late("10:59") < self.LATE_MINS

    def test_120_mins_late_triggers_warning_and_flag(self):
        assert self.mins_late("11:00") >= self.LATE_MINS

    def test_3h_late_also_flagged(self):
        assert self.mins_late("12:00") >= self.LATE_MINS


# ---------------------------------------------------------------------------
# Date formatting
# ---------------------------------------------------------------------------

class TestDateFormat:
    """Mirrors Utils.dateKey() — must produce YYYY-MM-DD."""

    def test_standard_date(self):
        assert date(2026, 10, 2).isoformat() == "2026-10-02"

    def test_month_padding(self):
        assert date(2026, 1, 5).isoformat() == "2026-01-05"

    def test_day_padding(self):
        assert date(2026, 12, 1).isoformat() == "2026-12-01"


# ---------------------------------------------------------------------------
# Work minutes and meal eligibility
# ---------------------------------------------------------------------------

class TestWorkMinutes:
    """Mirrors Utils.workMins() — net worked minutes excluding break time."""

    @staticmethod
    def hm(hhmm: str) -> int:
        h, m = map(int, hhmm.split(":"))
        return h * 60 + m

    def work_mins(self, rec: dict, now_hhmm: str) -> int:
        if not rec.get("p1"):
            return 0
        p1 = self.hm(rec["p1"])
        end = self.hm(rec["p4"]) if rec.get("p4") else self.hm(now_hhmm)
        lunch = 0
        if rec.get("p2"):
            p2 = self.hm(rec["p2"])
            lunch = self.hm(rec["p3"]) - p2 if rec.get("p3") else self.hm(now_hhmm) - p2
        return max(0, end - p1 - max(0, lunch))

    def test_no_checkin_returns_zero(self):
        assert self.work_mins({}, "10:00") == 0

    def test_checkin_only_no_checkout_uses_now(self):
        assert self.work_mins({"p1": "08:00"}, "10:00") == 120

    def test_full_day_no_break(self):
        assert self.work_mins({"p1": "08:00", "p4": "16:00"}, "16:00") == 480

    def test_full_day_with_one_hour_lunch(self):
        rec = {"p1": "08:00", "p2": "12:00", "p3": "13:00", "p4": "17:00"}
        assert self.work_mins(rec, "17:00") == 480  # 9h - 1h break

    def test_on_break_lunch_counted_to_now(self):
        # p2 recorded, p3 not yet — currently on break
        # total elapsed: 12:30-08:00=270, break so far: 12:30-12:00=30 → net=240
        rec = {"p1": "08:00", "p2": "12:00"}
        assert self.work_mins(rec, "12:30") == 240

    def test_exactly_meal_threshold(self):
        # total: 15:00-08:00=420, lunch: 13:00-12:00=60 → net=360
        rec = {"p1": "08:00", "p2": "12:00", "p3": "13:00", "p4": "15:00"}
        assert self.work_mins(rec, "15:00") == 360

    def test_one_minute_below_meal_threshold(self):
        # total: 14:59-08:00=419, lunch: 13:00-12:00=60 → net=359
        rec = {"p1": "08:00", "p2": "12:00", "p3": "13:00", "p4": "14:59"}
        assert self.work_mins(rec, "14:59") == 359


class TestMealEligibility:
    """Mirrors Utils.mealEligible() — 360 minutes (6 h) worked threshold."""

    MEAL_THRESHOLD_MINS = 360

    @staticmethod
    def hm(hhmm: str) -> int:
        h, m = map(int, hhmm.split(":"))
        return h * 60 + m

    def work_mins(self, rec: dict, now_hhmm: str) -> int:
        if not rec.get("p1"):
            return 0
        p1 = self.hm(rec["p1"])
        end = self.hm(rec["p4"]) if rec.get("p4") else self.hm(now_hhmm)
        lunch = 0
        if rec.get("p2"):
            p2 = self.hm(rec["p2"])
            lunch = self.hm(rec["p3"]) - p2 if rec.get("p3") else self.hm(now_hhmm) - p2
        return max(0, end - p1 - max(0, lunch))

    def meal_eligible(self, rec: dict, now_hhmm: str) -> bool:
        return self.work_mins(rec, now_hhmm) >= self.MEAL_THRESHOLD_MINS

    def test_eligible_at_threshold(self):
        rec = {"p1": "08:00", "p2": "12:00", "p3": "14:00", "p4": "18:00"}
        assert self.meal_eligible(rec, "18:00")

    def test_not_eligible_one_minute_below(self):
        # total: 14:59-08:00=419, lunch: 13:00-12:00=60 → net=359 < 360
        rec = {"p1": "08:00", "p2": "12:00", "p3": "13:00", "p4": "14:59"}
        assert not self.meal_eligible(rec, "14:59")

    def test_not_eligible_with_no_checkin(self):
        assert not self.meal_eligible({}, "17:00")

    def test_eligible_well_above_threshold(self):
        rec = {"p1": "08:00", "p4": "20:00"}
        assert self.meal_eligible(rec, "20:00")


# ---------------------------------------------------------------------------
# Contact validation
# ---------------------------------------------------------------------------

class TestContactValidation:
    """Mirrors Utils.validateSGContact()."""

    def validate(self, raw):
        clean = (raw or "").replace(" ", "").replace("-", "")
        if not clean:
            return {"clean": "", "error": "Contact number is required."}
        if not re.match(r"^[689]\d{7}$", clean):
            return {"clean": clean, "error": "Contact must be an 8-digit Singapore number."}
        return {"clean": clean, "error": None}

    def test_valid_9_prefix(self):
        assert self.validate("91234567")["error"] is None

    def test_valid_8_prefix(self):
        assert self.validate("81234567")["error"] is None

    def test_valid_6_prefix(self):
        assert self.validate("61234567")["error"] is None

    def test_spaces_stripped(self):
        r = self.validate("9123 4567")
        assert r["error"] is None and r["clean"] == "91234567"

    def test_dashes_stripped(self):
        assert self.validate("9123-4567")["error"] is None

    def test_too_short_rejected(self):
        assert self.validate("9123456")["error"] is not None

    def test_too_long_rejected(self):
        assert self.validate("912345678")["error"] is not None

    def test_wrong_prefix_rejected(self):
        assert self.validate("71234567")["error"] is not None

    def test_empty_string_rejected(self):
        assert self.validate("")["error"] == "Contact number is required."

    def test_none_rejected(self):
        assert self.validate(None)["error"] == "Contact number is required."


# ---------------------------------------------------------------------------
# Reporting day logic
# ---------------------------------------------------------------------------

class TestIsReportDay:
    """Mirrors Utils.isReportDay() — Mon–Fri for OPS/CAS, Mon–Sat for LNF."""

    def is_report_day(self, d: date, dept: str = "ops_security") -> bool:
        # JS getDay(): 0=Sun, 1=Mon...6=Sat → Mon-Fri = 1..5, Mon-Sat = 1..6
        # Python weekday(): 0=Mon...5=Sat, 6=Sun
        w = d.weekday()
        if dept == "lnf":
            return w <= 5  # Mon(0)–Sat(5)
        return w <= 4      # Mon(0)–Fri(4)

    def test_monday_reports(self):
        assert self.is_report_day(date(2026, 10, 12))  # Monday

    def test_friday_reports(self):
        assert self.is_report_day(date(2026, 10, 9))   # Friday

    def test_saturday_no_report(self):
        assert not self.is_report_day(date(2026, 10, 10))  # Saturday

    def test_sunday_no_report(self):
        assert not self.is_report_day(date(2026, 10, 11))  # Sunday

    def test_lnf_saturday_reports(self):
        assert self.is_report_day(date(2026, 10, 10), "lnf")  # Saturday

    def test_lnf_sunday_no_report(self):
        assert not self.is_report_day(date(2026, 10, 11), "lnf")  # Sunday

    def test_lnf_friday_reports(self):
        assert self.is_report_day(date(2026, 10, 9), "lnf")


# ---------------------------------------------------------------------------
# Batch cycle date calculation
# ---------------------------------------------------------------------------

class TestBatchDates:
    """Mirrors Utils.batchDatesFrom() and Utils.lnfBatchDatesFrom()."""

    def batch_dates_from(self, start_str: str) -> dict:
        start = date.fromisoformat(start_str)
        return {"start": start, "end": start + timedelta(days=13), "dekit": start + timedelta(days=15)}

    def lnf_batch_dates_from(self, start_str: str) -> dict:
        start = date.fromisoformat(start_str)
        return {"start": start, "end": start + timedelta(days=12), "dekit": start + timedelta(days=16)}

    def test_ops_end_is_13_days_after_start(self):
        d = self.batch_dates_from("2026-10-06")
        assert d["end"] == d["start"] + timedelta(days=13)

    def test_ops_dekit_is_15_days_after_start(self):
        d = self.batch_dates_from("2026-10-06")
        assert d["dekit"] == d["start"] + timedelta(days=15)

    def test_ops_start_tuesday_end_monday(self):
        d = self.batch_dates_from("2026-10-06")  # Tuesday
        assert d["start"].weekday() == 1  # Tue
        assert d["end"].weekday() == 0    # Mon

    def test_ops_dekit_is_wednesday(self):
        d = self.batch_dates_from("2026-10-06")
        assert d["dekit"].weekday() == 2  # Wed

    def test_lnf_end_is_12_days_after_start(self):
        d = self.lnf_batch_dates_from("2026-10-05")
        assert d["end"] == d["start"] + timedelta(days=12)

    def test_lnf_dekit_is_16_days_after_start(self):
        d = self.lnf_batch_dates_from("2026-10-05")
        assert d["dekit"] == d["start"] + timedelta(days=16)

    def test_lnf_start_monday_end_saturday(self):
        d = self.lnf_batch_dates_from("2026-10-05")  # Monday
        assert d["start"].weekday() == 0  # Mon
        assert d["end"].weekday() == 5    # Sat

    def test_lnf_dekit_is_wednesday(self):
        d = self.lnf_batch_dates_from("2026-10-05")
        assert d["dekit"].weekday() == 2  # Wed


# ---------------------------------------------------------------------------
# Dinner mode detection
# ---------------------------------------------------------------------------

class TestDinnerMode:
    """Mirrors Utils.isBreakDinner() — p2_open >= '17:00' signals dinner shift."""

    DEFAULT_P2_OPEN = "11:00"

    def is_break_dinner(self, timings: dict) -> bool:
        p2_open = (timings or {}).get("p2_open", self.DEFAULT_P2_OPEN)
        return p2_open >= "17:00"

    def test_default_office_timings_is_lunch(self):
        assert not self.is_break_dinner({"p2_open": "11:00"})

    def test_exactly_1700_is_dinner(self):
        assert self.is_break_dinner({"p2_open": "17:00"})

    def test_late_evening_is_dinner(self):
        assert self.is_break_dinner({"p2_open": "19:00"})

    def test_1659_is_still_lunch(self):
        assert not self.is_break_dinner({"p2_open": "16:59"})

    def test_none_timings_defaults_to_lunch(self):
        assert not self.is_break_dinner(None)


# ---------------------------------------------------------------------------
# Phase timing arithmetic
# ---------------------------------------------------------------------------

class TestAddMins:
    """Mirrors Utils._addMins() — adds minutes to HH:MM, capped at 23:59."""

    def add_mins(self, hhmm: str, mins: int) -> str:
        h, m = map(int, (hhmm or "00:00").split(":"))
        total = min(h * 60 + m + mins, 23 * 60 + 59)
        return f"{total // 60:02d}:{total % 60:02d}"

    def test_simple_addition(self):
        assert self.add_mins("08:00", 120) == "10:00"

    def test_crosses_hour_boundary(self):
        assert self.add_mins("10:45", 30) == "11:15"

    def test_overflow_capped_at_2359(self):
        assert self.add_mins("23:00", 120) == "23:59"

    def test_exactly_2359_not_capped(self):
        assert self.add_mins("23:59", 0) == "23:59"

    def test_from_midnight(self):
        assert self.add_mins("00:00", 90) == "01:30"


# ---------------------------------------------------------------------------
# Per-shift late threshold (person's own p1_open)
# ---------------------------------------------------------------------------

class TestLateThresholdPerShift:
    """Mirrors the updated late-base logic in builders/admin/roster.js.

    _lateBase = person's phase_timings.p1_open, else batch effective p1_open.
    The LATE_CUTOFF.OFFICE constant is no longer used as the log-row fallback.
    """

    LATE_MINS = 120

    @staticmethod
    def hm_to_mins(hhmm: str) -> int:
        h, m = map(int, hhmm.split(":"))
        return h * 60 + m

    def late_base(self, phase_timings=None, batch_p1_open="08:00") -> str:
        """Mirrors: (p.phase_timings?.p1_open) || effectiveTimings(activeBatch).p1_open"""
        if phase_timings and phase_timings.get("p1_open"):
            return phase_timings["p1_open"]
        return batch_p1_open

    def mins_late(self, checkin: str, phase_timings=None, batch_p1_open="08:00") -> int:
        base = self.late_base(phase_timings, batch_p1_open)
        return self.hm_to_mins(checkin) - self.hm_to_mins(base)

    def test_custom_p1_1200_checkin_1400_exactly_120_flagged(self):
        assert self.mins_late("14:00", {"p1_open": "12:00"}) >= self.LATE_MINS

    def test_custom_p1_1300_checkin_1400_only_60_not_late(self):
        assert self.mins_late("14:00", {"p1_open": "13:00"}) < self.LATE_MINS

    def test_no_personal_timings_uses_batch_p1(self):
        assert self.mins_late("10:00", phase_timings=None, batch_p1_open="08:00") == 120

    def test_batch_p1_1200_checkin_1300_not_late(self):
        assert self.mins_late("13:00", phase_timings=None, batch_p1_open="12:00") < self.LATE_MINS

    def test_personal_timings_override_batch(self):
        # batch says 08:00 → 14:00 would be 360 mins (late)
        # person says 13:00 → 14:00 is only 60 mins (not late)
        assert self.mins_late("14:00", {"p1_open": "13:00"}, batch_p1_open="08:00") < self.LATE_MINS

    def test_exactly_119_mins_after_custom_p1_not_late(self):
        assert self.mins_late("13:59", {"p1_open": "12:00"}) < self.LATE_MINS

    def test_default_batch_p1_0800_office_hours_still_work(self):
        assert self.mins_late("11:00", phase_timings=None, batch_p1_open="08:00") >= self.LATE_MINS


# ---------------------------------------------------------------------------
# Break label resolution (DINNER vs LUNCH)
# ---------------------------------------------------------------------------

class TestResolveBreakLabel:
    """Mirrors Utils.resolveBreakLabel() and the updated roster break-label logic.

    Priority: dinnerMode field → mode_changes → timings.p2_open.
    With the fix, timings are always resolved from person/batch rather than null.
    """

    @staticmethod
    def resolve_break_label(dinner_mode, mode_changes, date_key, timings):
        default_p2 = "11:00"
        if dinner_mode is not None:
            return "DINNER" if dinner_mode else "LUNCH"
        if date_key and mode_changes:
            rel = [e for e in mode_changes if e["from"] <= date_key]
            if rel:
                latest = max(rel, key=lambda e: e["from"])
                return "DINNER" if latest["dinner"] else "LUNCH"
        if timings:
            p2_open = timings.get("p2_open", default_p2)
            return "DINNER" if p2_open >= "17:00" else "LUNCH"
        return "LUNCH"

    def test_dinner_mode_true_wins(self):
        assert self.resolve_break_label(True, [], "2026-10-13", None) == "DINNER"

    def test_dinner_mode_false_wins(self):
        assert self.resolve_break_label(False, [], "2026-10-13", {"p2_open": "18:00"}) == "LUNCH"

    def test_null_dinner_mode_null_timings_returns_lunch(self):
        assert self.resolve_break_label(None, [], "2026-10-13", None) == "LUNCH"

    def test_personal_timings_p2_1800_returns_dinner(self):
        assert self.resolve_break_label(None, [], "2026-10-13", {"p2_open": "18:00"}) == "DINNER"

    def test_personal_timings_p2_1700_exactly_returns_dinner(self):
        assert self.resolve_break_label(None, [], "2026-10-13", {"p2_open": "17:00"}) == "DINNER"

    def test_personal_timings_p2_1659_returns_lunch(self):
        assert self.resolve_break_label(None, [], "2026-10-13", {"p2_open": "16:59"}) == "LUNCH"

    def test_batch_timings_p2_1800_returns_dinner(self):
        assert self.resolve_break_label(None, [], "2026-10-13", {"p2_open": "18:00"}) == "DINNER"

    def test_mode_changes_dinner_overrides_lunch_timings(self):
        changes = [{"from": "2026-10-12", "dinner": True}]
        assert self.resolve_break_label(None, changes, "2026-10-13", {"p2_open": "11:00"}) == "DINNER"

    def test_mode_changes_lunch_overrides_dinner_timings(self):
        changes = [{"from": "2026-10-12", "dinner": False}]
        assert self.resolve_break_label(None, changes, "2026-10-13", {"p2_open": "18:00"}) == "LUNCH"

    def test_only_future_mode_changes_ignored(self):
        changes = [{"from": "2026-10-14", "dinner": True}]
        # date_key is 2026-10-13, change is for 2026-10-14 — not applicable
        assert self.resolve_break_label(None, changes, "2026-10-13", {"p2_open": "11:00"}) == "LUNCH"
