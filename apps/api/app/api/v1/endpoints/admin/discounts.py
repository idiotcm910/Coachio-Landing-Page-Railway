"""Admin Discount CRUD — /api/v1/admin/discounts — GLOBAL pool.

Per-owner default activation is managed via POST/DELETE /admin/discounts/{id}/default.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.middleware.auth import require_role
from app.models.discount import Discount, DiscountDefaultActivation, DiscountScope
from app.models.admin_user import AdminUser
from app.schemas.discount import (
    DiscountCreate,
    DiscountDefaultActivationInput,
    DiscountDefaultOwner,
    DiscountListResponse,
    DiscountRead,
    DiscountScopeInput,
    DiscountUpdate,
)

router = APIRouter()


def _scope_pairs(scopes: list[DiscountScopeInput]) -> set[tuple[str, str]]:
    return {(s.owner_type, s.owner_id) for s in scopes}


def _owner_name(db: Session, owner_type: str, owner_id: str) -> str:
    """Best-effort human name for a funnel owner (falls back to the id)."""
    from app.models.funnel import Funnel

    if owner_type == "funnel":
        row = db.query(Funnel).filter(Funnel.id == owner_id).first()
        return getattr(row, "title", None) or owner_id
    return owner_id


def _validate_defaults_within_scope(
    scopes: list[DiscountScopeInput],
    default_owners: list[tuple[str, str]],
    db: Session | None = None,
) -> None:
    """A default owner MUST be within a non-empty scope (spec constraint).

    Empty scope = global → any default is allowed. When the constraint is violated
    the error names the offending owner(s) so the admin knows what to fix.
    """
    if not scopes:
        return
    allowed = _scope_pairs(scopes)
    offenders = [(t, i) for (t, i) in default_owners if (t, i) not in allowed]
    if not offenders:
        return
    if db is not None:
        names = ", ".join(f"{_owner_name(db, t, i)} ({t})" for t, i in offenders)
        detail = (
            f"This code is set to auto-apply (default) for {names}, which is not in the "
            f"selected scope. Add it to 'Applicable to', or remove it from defaults first."
        )
    else:
        detail = "A default owner must be within the discount's applicable scope"
    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)


def _replace_scopes(db: Session, discount: Discount, scopes: list[DiscountScopeInput]) -> None:
    """Replace a discount's scope rows wholesale (no commit)."""
    db.query(DiscountScope).filter(DiscountScope.discount_id == discount.id).delete()
    seen: set[tuple[str, str]] = set()
    for s in scopes:
        key = (s.owner_type, s.owner_id)
        if key in seen:
            continue  # dedupe
        seen.add(key)
        db.add(
            DiscountScope(
                discount_id=discount.id,
                owner_type=s.owner_type,
                owner_id=s.owner_id,
            )
        )


def _get_discount(db: Session, discount_id: str) -> Discount:
    discount = db.query(Discount).filter(Discount.id == discount_id).first()
    if discount is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discount not found")
    return discount


def _refresh_funnel_cache(db: Session, funnel_id: str) -> None:
    """Best-effort refresh of a funnel landing cache after a default change."""
    try:
        from app.api.v1.endpoints.admin.funnels import get_funnel_or_404
        from app.services.funnel_landing_service import refresh_funnel_landing_cache

        funnel = get_funnel_or_404(db, funnel_id)
        refresh_funnel_landing_cache(db, funnel)
    except Exception:
        pass  # cache refresh is best-effort; don't fail the request


def _upsert_scope(db: Session, discount_id: str, owner_type: str, owner_id: str) -> None:
    """Add a single owner to a discount's applicable scope if not already present (no commit)."""
    existing = (
        db.query(DiscountScope)
        .filter(
            DiscountScope.discount_id == discount_id,
            DiscountScope.owner_type == owner_type,
            DiscountScope.owner_id == owner_id,
        )
        .first()
    )
    if existing is None:
        db.add(DiscountScope(discount_id=discount_id, owner_type=owner_type, owner_id=owner_id))


def _upsert_default_activation(db: Session, discount_id: str, owner_type: str, owner_id: str) -> None:
    """Create a default activation if it doesn't already exist (no commit)."""
    existing = (
        db.query(DiscountDefaultActivation)
        .filter(
            DiscountDefaultActivation.discount_id == discount_id,
            DiscountDefaultActivation.owner_type == owner_type,
            DiscountDefaultActivation.owner_id == owner_id,
        )
        .first()
    )
    if existing is None:
        db.add(
            DiscountDefaultActivation(
                discount_id=discount_id,
                owner_type=owner_type,
                owner_id=owner_id,
            )
        )


def _annotate_default(discount: Discount, owner_type: str | None, owner_id: str | None, db: Session) -> DiscountRead:
    """Build DiscountRead, optionally annotating is_default_for_owner."""
    data = DiscountRead.model_validate(discount)
    if owner_type and owner_id:
        has_activation = (
            db.query(DiscountDefaultActivation)
            .filter(
                DiscountDefaultActivation.discount_id == discount.id,
                DiscountDefaultActivation.owner_type == owner_type,
                DiscountDefaultActivation.owner_id == owner_id,
            )
            .first()
        ) is not None
        data.is_default_for_owner = has_activation
    return data


@router.get("", response_model=DiscountListResponse)
def list_discounts(
    owner_type: str | None = Query(None),
    owner_id: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    items = db.query(Discount).order_by(Discount.created_at.desc()).all()
    annotated = [_annotate_default(d, owner_type, owner_id, db) for d in items]
    return DiscountListResponse(items=annotated, total=len(annotated))


@router.post("", response_model=DiscountRead, status_code=status.HTTP_201_CREATED)
def create_discount(
    payload: DiscountCreate,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    duplicate = db.query(Discount).filter(Discount.code == payload.code).first()
    if duplicate:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Code already exists globally")
    defaults = payload.defaults
    scopes = payload.scopes
    # A default owner must be within the scope (when scope is non-empty)
    _validate_defaults_within_scope(scopes, [(o.owner_type, o.owner_id) for o in defaults], db)

    discount = Discount(**payload.model_dump(exclude={"defaults", "scopes"}), created_by=current_user.id)
    db.add(discount)
    db.flush()  # assign discount.id before creating activations

    # Applicability scope (empty = global)
    if scopes:
        _replace_scopes(db, discount, scopes)

    # One-step flow: assign the new code as a default for the chosen funnels
    for owner in defaults:
        _upsert_default_activation(db, discount.id, owner.owner_type, owner.owner_id)
    db.commit()
    db.refresh(discount)

    for owner in defaults:
        if owner.owner_type == "funnel":
            _refresh_funnel_cache(db, owner.owner_id)

    return DiscountRead.model_validate(discount)


@router.patch("/{discount_id}", response_model=DiscountRead)
def update_discount(
    discount_id: str,
    payload: DiscountUpdate,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    discount = _get_discount(db, discount_id)
    data = payload.model_dump(exclude_unset=True)
    scopes = data.pop("scopes", None)  # not a column — handled separately

    for key, value in data.items():
        setattr(discount, key, value)
    discount.updated_by = current_user.id

    # Replace scope when provided (None = leave unchanged; [] = clear → global)
    if scopes is not None:
        scope_inputs = [DiscountScopeInput(**s) for s in scopes]
        # Reject if the new (non-empty) scope would exclude an existing default owner
        existing_defaults = (
            db.query(DiscountDefaultActivation)
            .filter(DiscountDefaultActivation.discount_id == discount.id)
            .all()
        )
        _validate_defaults_within_scope(
            scope_inputs, [(d.owner_type, d.owner_id) for d in existing_defaults], db
        )
        _replace_scopes(db, discount, scope_inputs)

    db.commit()
    db.refresh(discount)
    return DiscountRead.model_validate(discount)


@router.delete("/{discount_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_discount(
    discount_id: str,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    discount = _get_discount(db, discount_id)
    db.delete(discount)
    db.commit()


@router.post("/{discount_id}/default", response_model=DiscountRead, status_code=status.HTTP_200_OK)
def set_discount_default(
    discount_id: str,
    payload: DiscountDefaultActivationInput,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    """Upsert a default activation for the given owner (funnel)."""
    discount = _get_discount(db, discount_id)
    # A default owner must be within the scope when the discount is scoped (non-empty)
    if discount.scopes:
        allowed = {(s.owner_type, s.owner_id) for s in discount.scopes}
        if (payload.owner_type, payload.owner_id) not in allowed:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="This owner is not within the discount's applicable scope",
            )
    _upsert_default_activation(db, discount_id, payload.owner_type, payload.owner_id)
    db.commit()

    # Refresh funnel landing cache when toggling a funnel default
    if payload.owner_type == "funnel":
        _refresh_funnel_cache(db, payload.owner_id)

    db.refresh(discount)
    data = DiscountRead.model_validate(discount)
    data.is_default_for_owner = True
    return data


@router.delete("/{discount_id}/default", status_code=status.HTTP_204_NO_CONTENT)
def remove_discount_default(
    discount_id: str,
    owner_type: str = Query(...),
    owner_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    """Remove a default activation for the given owner."""
    _get_discount(db, discount_id)
    deleted = (
        db.query(DiscountDefaultActivation)
        .filter(
            DiscountDefaultActivation.discount_id == discount_id,
            DiscountDefaultActivation.owner_type == owner_type,
            DiscountDefaultActivation.owner_id == owner_id,
        )
        .delete()
    )
    if deleted:
        db.commit()
        # Refresh funnel landing cache when removing a funnel default
        if owner_type == "funnel":
            _refresh_funnel_cache(db, owner_id)


@router.get("/{discount_id}/defaults", response_model=list[DiscountDefaultOwner])
def list_discount_defaults(
    discount_id: str,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    """List the owners (funnels) this discount is a default for, with names."""
    from app.models.funnel import Funnel

    _get_discount(db, discount_id)
    rows = (
        db.query(DiscountDefaultActivation)
        .filter(DiscountDefaultActivation.discount_id == discount_id)
        .all()
    )
    result: list[DiscountDefaultOwner] = []
    for r in rows:
        name = None
        if r.owner_type == "funnel":
            owner = db.query(Funnel).filter(Funnel.id == r.owner_id).first()
            name = owner.title if owner else None
        result.append(
            DiscountDefaultOwner(owner_type=r.owner_type, owner_id=r.owner_id, owner_name=name)
        )
    return result


@router.post("/{discount_id}/scope", response_model=DiscountRead, status_code=status.HTTP_200_OK)
def add_discount_scope(
    discount_id: str,
    payload: DiscountScopeInput,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    """Restrict a discount to the given owner (add it to the applicable scope whitelist).

    Adding the first scope entry flips the code from global → restricted.
    """
    discount = _get_discount(db, discount_id)
    _upsert_scope(db, discount_id, payload.owner_type, payload.owner_id)
    db.commit()

    if payload.owner_type == "funnel":
        _refresh_funnel_cache(db, payload.owner_id)

    db.refresh(discount)
    return DiscountRead.model_validate(discount)


@router.delete("/{discount_id}/scope", status_code=status.HTTP_204_NO_CONTENT)
def remove_discount_scope(
    discount_id: str,
    owner_type: str = Query(...),
    owner_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    """Remove an owner from a discount's applicable scope.

    Rejected when the owner is still a default for this discount and the remaining
    scope stays non-empty (a default must live inside a non-empty scope). The admin
    must unset the default first.
    """
    discount = _get_discount(db, discount_id)
    remaining = [
        DiscountScopeInput(owner_type=s.owner_type, owner_id=s.owner_id)
        for s in discount.scopes
        if not (s.owner_type == owner_type and s.owner_id == owner_id)
    ]
    if remaining:
        existing_defaults = (
            db.query(DiscountDefaultActivation)
            .filter(DiscountDefaultActivation.discount_id == discount_id)
            .all()
        )
        _validate_defaults_within_scope(
            remaining, [(d.owner_type, d.owner_id) for d in existing_defaults], db
        )
    deleted = (
        db.query(DiscountScope)
        .filter(
            DiscountScope.discount_id == discount_id,
            DiscountScope.owner_type == owner_type,
            DiscountScope.owner_id == owner_id,
        )
        .delete()
    )
    if deleted:
        db.commit()
        if owner_type == "funnel":
            _refresh_funnel_cache(db, owner_id)
