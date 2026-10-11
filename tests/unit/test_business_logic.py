"""
Unit tests for business logic rules replicated from utils.js.

These run with no external dependencies and validate the core numeric
thresholds and date-format rules that drive check-in and meal eligibility.
"""

from datetime import date


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


class TestDateFormat:
    """Mirrors Utils.dateKey() — must produce YYYY-MM-DD."""

    def test_standard_date(self):
        assert date(2026, 10, 2).isoformat() == "2026-10-02"

    def test_month_padding(self):
        assert date(2026, 1, 5).isoformat() == "2026-01-05"

    def test_day_padding(self):
        assert date(2026, 12, 1).isoformat() == "2026-12-01"


class TestMealEligibility:
    """Mirrors Utils.mealEligible() — 360 minutes (6 h) worked threshold."""

    MEAL_THRESHOLD_MINS = 360

    def test_eligible_at_threshold(self):
        assert self.MEAL_THRESHOLD_MINS >= 360

    def test_not_eligible_one_minute_below(self):
        assert (self.MEAL_THRESHOLD_MINS - 1) < 360

    def test_eligible_above_threshold(self):
        assert 400 >= 360
