"""Shared fixtures for the ReservistGO test suite."""

import pytest
from pathlib import Path
from supabase import create_client, Client

PROD_URL = "https://opsreservist.vercel.app"
SUPABASE_URL = "https://phekjmzqvapzhvofrkgy.supabase.co"
SUPABASE_ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    ".eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoZWtqbXpxdmFwemh2b2Zya2d5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MTUyNTksImV4cCI6MjEwMjE5MTI1OX0"
    ".n6av5HL-65Y7C3RYmjkoqBxnCOQvyDqFsgrM9M74TEk"
)
ROOT = Path(__file__).parent.parent


@pytest.fixture(scope="session")
def prod_url() -> str:
    return PROD_URL


@pytest.fixture(scope="session")
def db() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


@pytest.fixture(scope="session")
def index_html() -> str:
    return (ROOT / "index.html").read_text(encoding="utf-8")


def read_src(rel_path: str) -> str:
    return (ROOT / rel_path).read_text(encoding="utf-8")
