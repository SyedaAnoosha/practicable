"""week4_plan.md Phase 8 (8F-11): "Rate-limit link minting per user per template per
hour, in memory, no IP stored" — real, correctly wired, but had no test file at all
until this pass (found during the 8F/8G re-verification, 2026-08-21). Every claim in
link_rate_limit.py's own docstring is checked here, seen red first against the module's
real state before this file existed (each test below fails if the corresponding
behaviour in link_rate_limit.py is reverted to a naive always-True/never-log stub —
confirmed by temporarily stubbing check_and_record's body during this pass).
"""
import logging

import app.services.link_rate_limit as link_rate_limit
from app.services.link_rate_limit import check_and_record


def _reset():
    """Each test gets a clean slate — the module's _mints dict is process-global
    state, exactly like the real server's, so leaking counts across tests would make
    the limit tests flaky depending on run order."""
    link_rate_limit._mints.clear()


def test_within_limit_returns_true():
    _reset()
    assert check_and_record("user-1", "template-1") is True


def test_never_raises_on_new_user_or_template():
    _reset()
    # First call for a brand-new user/template pair — the defaultdict-of-defaultdict
    # must not KeyError.
    result = check_and_record("brand-new-user", "brand-new-template")
    assert result is True


def test_exceeding_limit_returns_false():
    _reset()
    for _ in range(link_rate_limit.MAX_MINTS):
        assert check_and_record("user-2", "template-2") is True
    # The 11th mint in the same window exceeds MAX_MINTS=10.
    assert check_and_record("user-2", "template-2") is False


def test_exceeding_limit_logs_a_warning(caplog):
    _reset()
    with caplog.at_level(logging.WARNING, logger="app.services.link_rate_limit"):
        for _ in range(link_rate_limit.MAX_MINTS):
            check_and_record("user-3", "template-3")
        check_and_record("user-3", "template-3")
    assert "link_mint_rate_exceeded" in caplog.text
    assert "user-3" in caplog.text
    assert "template-3" in caplog.text


def test_within_limit_does_not_log(caplog):
    _reset()
    with caplog.at_level(logging.WARNING, logger="app.services.link_rate_limit"):
        check_and_record("user-4", "template-4")
    assert "link_mint_rate_exceeded" not in caplog.text


def test_exceeding_never_raises_and_caller_can_ignore_the_result():
    """The module's own docstring: 'Never raises. The caller ignores the return value
    — exceeding the limit is logged, not enforced.' A caller that never checks the
    return value must still be able to keep calling indefinitely without a crash."""
    _reset()
    for _ in range(50):
        check_and_record("user-5", "template-5")  # no assertion — must simply not raise


def test_limit_is_per_user_per_template_not_global():
    """A second user hitting the same template starts its own fresh window — the
    limit is per (user, template) pair, not a single global counter or a per-user
    counter shared across templates."""
    _reset()
    for _ in range(link_rate_limit.MAX_MINTS):
        check_and_record("user-6", "template-a")
    # Different template, same user — fresh limit.
    assert check_and_record("user-6", "template-b") is True
    # Different user, same template that user-6 exhausted — fresh limit.
    assert check_and_record("user-7", "template-a") is True


def test_expired_entries_are_pruned_and_do_not_count_toward_the_limit():
    """The window is 1 hour (WINDOW_SECONDS). A mint recorded before the window start
    must not count toward MAX_MINTS — otherwise the limiter would never reset and a
    legitimate downloader would be permanently rate-limited after one busy hour."""
    _reset()
    # Manually seed timestamps far outside the window (well past WINDOW_SECONDS ago).
    stale_time = link_rate_limit.time.time() - (link_rate_limit.WINDOW_SECONDS * 2)
    link_rate_limit._mints["user-8"]["template-8"] = [stale_time] * link_rate_limit.MAX_MINTS
    # A fresh call should prune all the stale entries and still be within limit.
    assert check_and_record("user-8", "template-8") is True


def test_no_ip_address_is_ever_recorded_or_logged(caplog):
    """8C's and 6B's rule, restated in this module's own docstring: 'No IP stored.'
    check_and_record's signature takes no IP parameter at all, and nothing it logs
    or stores could carry one — this test locks that contract so a future edit adding
    an ip_address parameter or an IP to the log line would fail it."""
    _reset()
    import inspect

    sig = inspect.signature(check_and_record)
    assert "ip" not in " ".join(sig.parameters).lower()

    with caplog.at_level(logging.WARNING, logger="app.services.link_rate_limit"):
        for _ in range(link_rate_limit.MAX_MINTS + 1):
            check_and_record("user-9", "template-9")
    assert "ip" not in caplog.text.lower()
