"""Admin Product CRUD — /api/v1/admin/products."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.middleware.auth import require_role
from app.models import Product
from app.models.admin_user import AdminUser
from app.schemas.product import (
    ProductCreate,
    ProductListResponse,
    ProductRead,
    ProductUpdate,
)

router = APIRouter()


def _get_product(db: Session, product_id: str) -> Product:
    product = db.query(Product).filter(Product.id == product_id).first()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


@router.get("", response_model=ProductListResponse)
def list_products(
    type: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    query = db.query(Product)
    if type:
        query = query.filter(Product.type == type)
    if status_filter:
        query = query.filter(Product.status == status_filter)
    items = query.order_by(Product.created_at.desc()).all()
    return ProductListResponse(items=items, total=len(items))


@router.post("", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    if db.query(Product).filter(Product.slug == payload.slug).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slug already in use")
    product = Product(**payload.model_dump(), created_by=current_user.id)
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.get("/{product_id}", response_model=ProductRead)
def get_product(
    product_id: str,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    return _get_product(db, product_id)


@router.patch("/{product_id}", response_model=ProductRead)
def update_product(
    product_id: str,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    product = _get_product(db, product_id)
    updates = payload.model_dump(exclude_unset=True)
    if "slug" in updates and updates["slug"] != product.slug:
        if db.query(Product).filter(Product.slug == updates["slug"]).first():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slug already in use")
    # Product fields that are baked into a funnel's cached landing payload.
    landing_affecting = {"base_price", "name"}
    refresh_funnel_caches = bool(landing_affecting & set(updates))
    for key, value in updates.items():
        setattr(product, key, value)
    product.updated_by = current_user.id
    db.commit()
    db.refresh(product)
    # Write-through: price/name live in {{price}}/{{product_name}}, so changing
    # them must refresh the cache of every published funnel attached to this product.
    if refresh_funnel_caches:
        from app.services.funnel_landing_service import refresh_funnel_landing_cache

        for funnel in product.funnels:
            if funnel.status == "published":
                refresh_funnel_landing_cache(db, funnel)
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: str,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    product = _get_product(db, product_id)
    db.delete(product)
    db.commit()
