"""Deployment health tests — verify the live Vercel production URL."""

import requests
import pytest
from tests.conftest import prod_url  # noqa: F401 — re-export for parametrize


class TestDeployment:
    def test_index_returns_200(self, prod_url):
        r = requests.get(prod_url, timeout=15)
        assert r.status_code == 200

    def test_index_is_html(self, prod_url):
        r = requests.get(prod_url, timeout=15)
        assert "text/html" in r.headers.get("content-type", "")

    def test_index_contains_app_root(self, prod_url):
        r = requests.get(prod_url, timeout=15)
        assert "<x-dc>" in r.text

    def test_service_worker_served(self, prod_url):
        r = requests.get(f"{prod_url}/sw.js", timeout=15)
        assert r.status_code == 200
        assert "javascript" in r.headers.get("content-type", "")

    def test_css_served(self, prod_url):
        r = requests.get(f"{prod_url}/css/styles.css", timeout=15)
        assert r.status_code == 200

    def test_manifest_name(self, prod_url):
        r = requests.get(f"{prod_url}/manifest.json", timeout=15)
        assert r.status_code == 200
        assert r.json().get("name") == "ReservistGO"

    def test_no_exposed_supabase_service_key(self, prod_url):
        r = requests.get(prod_url, timeout=15)
        assert "service_role" not in r.text
