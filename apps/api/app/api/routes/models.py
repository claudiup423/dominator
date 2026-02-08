from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID

from app.db.session import get_db
from app.db.models import Model as ModelDB, ModelTag, EvalResult, Checkpoint
from app.schemas import ModelCreate, ModelUpdate, ModelResponse
from app.middleware.auth import get_current_user, require_admin

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("", response_model=List[ModelResponse])
async def list_models(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ModelDB).order_by(ModelDB.created_at.desc()))
    return [ModelResponse.model_validate(m) for m in result.scalars().all()]


@router.post("", response_model=ModelResponse, status_code=201)
async def create_model(body: ModelCreate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    model = ModelDB(**body.model_dump())
    db.add(model)
    await db.commit()
    await db.refresh(model)
    return ModelResponse.model_validate(model)


@router.patch("/{model_id}", response_model=ModelResponse)
async def update_model(model_id: UUID, body: ModelUpdate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(ModelDB).where(ModelDB.id == model_id))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(model, key, val)
    await db.commit()
    await db.refresh(model)
    return ModelResponse.model_validate(model)


@router.post("/{model_id}/promote", response_model=ModelResponse)
async def promote_model(model_id: UUID, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(ModelDB).where(ModelDB.id == model_id))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    if model.tag != ModelTag.candidate:
        raise HTTPException(status_code=400, detail="Only candidate models can be promoted")

    # Check gates: must have at least one passing eval
    cp_result = await db.execute(
        select(Checkpoint).join(ModelDB.training_runs).where(ModelDB.id == model_id)
    )
    checkpoint_ids = [cp.id for cp in cp_result.scalars().all()]
    if not checkpoint_ids:
        raise HTTPException(status_code=400, detail="No checkpoints found for this model")

    eval_result = await db.execute(
        select(EvalResult).where(
            EvalResult.checkpoint_id.in_(checkpoint_ids),
            EvalResult.passed_gates == True
        )
    )
    if not eval_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Model has not passed evaluation gates")

    # Demote current stable
    stable_result = await db.execute(select(ModelDB).where(ModelDB.tag == ModelTag.stable))
    for stable in stable_result.scalars().all():
        stable.tag = ModelTag.baseline

    model.tag = ModelTag.stable
    await db.commit()
    await db.refresh(model)
    return ModelResponse.model_validate(model)
