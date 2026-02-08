from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID
import os

from app.db.session import get_db
from app.db.models import Artifact
from app.schemas import ArtifactResponse
from app.core.config import get_settings

router = APIRouter(prefix="/api/artifacts", tags=["artifacts"])


@router.get("", response_model=List[ArtifactResponse])
async def list_artifacts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Artifact).order_by(Artifact.created_at.desc()).limit(100))
    return [ArtifactResponse.model_validate(a) for a in result.scalars().all()]


@router.get("/{artifact_id}/download")
async def download_artifact(artifact_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Artifact).where(Artifact.id == artifact_id))
    artifact = result.scalar_one_or_none()
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")

    settings = get_settings()
    full_path = os.path.join(settings.ARTIFACTS_DIR, artifact.path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="Artifact file not found on disk")

    return FileResponse(full_path, filename=os.path.basename(artifact.path))
