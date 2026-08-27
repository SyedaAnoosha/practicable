"""The receipt email's version-stamp line and the ABN-absence guarantee. Direct
template-rendering tests — no network, no DB — since `_render` is pure given its
context dict.
"""
from datetime import datetime, timezone

from app.services.email_service import _format_version_stamp, _render


def test_format_version_stamp_both_set():
    assert _format_version_stamp("1.2", datetime(2026, 8, 17, tzinfo=timezone.utc)) == "v1.2 · reviewed 17 Aug 2026"


def test_format_version_stamp_version_only():
    assert _format_version_stamp("2.0", None) == "v2.0"


def test_format_version_stamp_date_only():
    assert _format_version_stamp(None, datetime(2026, 1, 5, tzinfo=timezone.utc)) == "reviewed 5 Jan 2026"


def test_format_version_stamp_neither_set_is_none():
    """The absence rule: nothing renders, never a placeholder."""
    assert _format_version_stamp(None, None) is None


def test_receipt_renders_version_stamp_when_set():
    html, text = _render(
        "receipt",
        order_id="ord_123",
        product_names=["Vendor Risk Assessment Scorecard"],
        product_lines=[{"name": "Vendor Risk Assessment Scorecard", "version_stamp": "v1.2 · reviewed 17 Aug 2026"}],
        amount_display="A$39.00",
        order_date="17 Aug 2026",
        tax_line=None,
        primary_link="https://example.test/library",
        refund_position_text=None,
        refunds_url=None,
        invoice_number=None,
        seller_legal_name=None,
    )
    assert "v1.2 · reviewed 17 Aug 2026" in html
    assert "(v1.2 · reviewed 17 Aug 2026)" in text


def test_receipt_omits_version_stamp_when_unset():
    """No product_lines entry has a version_stamp -> nothing renders. Never `v—`."""
    html, text = _render(
        "receipt",
        order_id="ord_123",
        product_names=["Free Template"],
        product_lines=[{"name": "Free Template", "version_stamp": None}],
        amount_display="A$0.00",
        order_date="17 Aug 2026",
        tax_line=None,
        primary_link="https://example.test/library",
        refund_position_text=None,
        refunds_url=None,
        invoice_number=None,
        seller_legal_name=None,
    )
    assert "v—" not in html and "v—" not in text
    assert "reviewed" not in html and "reviewed" not in text


def test_receipt_never_contains_abn_string():
    """No ABN field exists anywhere in this app. Set or unset seller_legal_name, the
    string never appears."""
    for seller_name in (None, "Effective Risk Management"):
        html, text = _render(
            "receipt",
            order_id="ord_123",
            product_names=["A Product"],
            product_lines=[{"name": "A Product", "version_stamp": None}],
            amount_display="A$39.00",
            order_date="17 Aug 2026",
            tax_line="GST included",
            primary_link="https://example.test/library",
            refund_position_text="One-time purchase, lifetime access.",
            refunds_url="https://example.test/legal/refunds",
            invoice_number="INV-000142",
            seller_legal_name=seller_name,
        )
        assert "ABN" not in html
        assert "ABN" not in text
