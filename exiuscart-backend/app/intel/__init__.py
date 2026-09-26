"""Prodora product intelligence: turn a supplier product into evidence and a decision.

Pipeline (see engine.py):
  supplier product -> fingerprint -> marketplace listings -> same-product check
  -> economics -> verdict (TEST / WATCH / AVOID) with reasons and confidence.

Everything here is honest by construction: a number is only shown when there is
evidence behind it, sources that are not configured say so, and anything we
could not measure is listed under `not_measured` instead of being guessed.
"""
