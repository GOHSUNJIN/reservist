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

    def test_batches_readable_anonymously(self, db):
        # Batch metadata (cycle dates/labels) is intentionally public for signup flow
        resp = db.table("batches").select("id,label").limit(1).execute()
        assert isinstance(resp.data, list)

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
