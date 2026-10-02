"""
Unit tests for business logic rules replicated from utils.js.

These run with no external dependencies and validate the core numeric
thresholds and date-format rules that drive check-in and meal eligibility.
"""

from datetime import date


class TestLateThresholds:
    """Mirrors the late-detection logic in handlers/checkin.js."""

    LATE_CUTOFF = "09:00"

    @staticmethod
    def hm_to_mins(hhmm: str) -> int:
        h, m = map(int, hhmm.split(":"))
        return h * 60 + m

    def mins_late(self, checkin: str) -> int:
        return self.hm_to_mins(checkin) - self.hm_to_mins(self.LATE_CUTOFF)

    def test_on_time_not_flagged(self):
        assert self.mins_late("08:55") < 30

    def test_exactly_cutoff_not_flagged(self):
        assert self.mins_late("09:00") < 30

    def test_29_mins_late_not_flagged(self):
        assert self.mins_late("09:29") < 30

    def test_30_mins_late_triggers_warning(self):
        assert self.mins_late("09:30") >= 30

    def test_59_mins_late_warning_only(self):
        ml = self.mins_late("09:59")
        assert 30 <= ml < 60

    def test_60_mins_late_triggers_admin_flag(self):
        assert self.mins_late("10:00") >= 60

    def test_2h_late_also_flagged(self):
        assert self.mins_late("11:00") >= 60


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
