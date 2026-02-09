from fastapi import APIRouter
from app.api.routes.auth import router as auth_router
from app.api.routes.models import router as models_router
from app.api.routes.training_runs import router as runs_router, stream_router
from app.api.routes.evals import router as evals_router, suite_router, eval_stream_router
from app.api.routes.sessions import router as sessions_router
from app.api.routes.artifacts import router as artifacts_router
from app.api.routes.training_control import router as training_control_router
from app.api.routes.match import router as match_router
from app.api.routes.downloads import router as downloads_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(models_router)
api_router.include_router(runs_router)
api_router.include_router(stream_router)
api_router.include_router(evals_router)
api_router.include_router(suite_router)
api_router.include_router(eval_stream_router)
api_router.include_router(sessions_router)
api_router.include_router(artifacts_router)
api_router.include_router(training_control_router)
api_router.include_router(match_router)
api_router.include_router(downloads_router)