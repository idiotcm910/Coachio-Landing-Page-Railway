"""Shared schema + validation for typed custom-variable metadata (variables_meta).

Custom variables stay a flat `{key: rawString}` map (`variables`). Optional
authoring metadata lives side-car in `variables_meta = {key: {name?, description?,
type}}`. `type` is an authoring affordance only — it selects the admin input
widget and a LENIENT value check; the substituted value is always the raw string.

Reused by both funnel and course schemas (DRY). The funnel/course reserved key
set is passed in since it differs per owner.
"""

import re
from typing import Literal, Optional

from pydantic import BaseModel, Field

VariableType = Literal["text", "number", "date", "time", "datetime"]
VARIABLE_TYPES: set[str] = {"text", "number", "date", "time", "datetime"}

# Canonical raw-string patterns produced by the admin pickers (lenient: empty allowed).
_VALUE_PATTERNS: dict[str, re.Pattern] = {
    "number": re.compile(r"^-?\d+(\.\d+)?$"),
    "date": re.compile(r"^\d{4}-\d{2}-\d{2}$"),
    "time": re.compile(r"^\d{2}:\d{2}$"),
    "datetime": re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$"),
}


class VariableMeta(BaseModel):
    """Per-key authoring metadata. `type` defaults to text for back-compat."""

    name: Optional[str] = Field(None, max_length=150)
    description: Optional[str] = Field(None, max_length=500)
    type: VariableType = "text"


def validate_variables_meta(
    variables: Optional[dict],
    variables_meta: Optional[dict],
    reserved_keys: set[str],
) -> None:
    """Validate metadata shape, key references, and value-vs-type (lenient).

    Raises ValueError on any violation. No-op when metadata is empty.
    """
    if not variables_meta:
        return

    meta_keys = set(variables_meta)
    reserved_hit = meta_keys & reserved_keys
    if reserved_hit:
        raise ValueError(
            f"variables_meta cannot reference reserved default keys: {sorted(reserved_hit)}"
        )

    var_keys = set(variables or {})
    orphan = meta_keys - var_keys
    if orphan:
        raise ValueError(
            f"variables_meta keys must exist in variables: {sorted(orphan)}"
        )

    for key, meta in variables_meta.items():
        if not isinstance(meta, dict):
            raise ValueError(f"variables_meta['{key}'] must be an object")
        vtype = meta.get("type", "text")
        if vtype not in VARIABLE_TYPES:
            raise ValueError(
                f"variables_meta['{key}'].type must be one of {sorted(VARIABLE_TYPES)}"
            )
        # Lenient value check: skip empty values; only typed temporal/number keys are checked.
        raw = (variables or {}).get(key)
        pattern = _VALUE_PATTERNS.get(vtype)
        if pattern and isinstance(raw, str) and raw and not pattern.match(raw):
            raise ValueError(
                f"variables['{key}'] value '{raw}' does not match type '{vtype}'"
            )
