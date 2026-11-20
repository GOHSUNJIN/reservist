"""Supabase Row-Level Security tests — unauthenticated access must be blocked."""

import pytest


class TestRLS:
    SENSITIVE_TABLES = [
        "personnel",
        "attendance",
        "leave_requests",
        "signup_requests",
        "audit_log",
    ]

    @pytest.mark.parametrize("table", SENSITIVE_TABLES)
    def test_anon_blocked(self, db, table):
        resp = db.table(table).select("id").limit(5).execute()
        assert resp.data == [], (
            f"Table '{table}' returned rows to an unauthenticated client — RLS may be misconfigured"
        )

    def test_batches_table_hidden_from_anon(self, db):
        # Cycle notices and timings are no longer public; sign-up uses signup_open_batches()
        resp = db.table("batches").select("id,label,notice_text").limit(5).execute()
        assert resp.data == []

    def test_signup_open_batches_rpc_available_anonymously(self, db):
        resp = db.rpc("signup_open_batches", {}).execute()
        assert isinstance(resp.data, list)
        for row in resp.data:
            assert "notice_text" not in row and "phase_timings" not in row

    def test_anon_cannot_call_log_phase_now(self, db):
        try:
            db.rpc("log_phase_now", {
                "p_personnel_id": "00000000-0000-0000-0000-000000000000",
                "p_date": "2099-01-01",
                "p_phase": "p1",
            }).execute()
            pytest.fail("Unauthenticated log_phase_now should have been rejected")
        except Exception:
            pass

    def test_anon_cannot_insert_attendance(self, db):
        try:
            db.table("attendance").insert({
                "personnel_id": "00000000-0000-0000-0000-000000000000",
                "date": "2099-01-01",
                "status": "present",
            }).execute()
            pytest.fail("Unauthenticated insert to attendance should have been rejected")
        except Exception:
            pass
