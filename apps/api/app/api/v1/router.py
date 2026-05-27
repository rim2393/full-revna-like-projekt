from fastapi import APIRouter

from app.api.v1.routes.health import router as health_router
from app.domains.api_keys.router import router as api_keys_router
from app.domains.auth.router import router as auth_router
from app.domains.licenses.router import router as licenses_router
from app.domains.nodes.router import router as nodes_router
from app.domains.subscriptions.router import router as subscriptions_router
from app.domains.users.router import router as users_router

api_v1_router = APIRouter()
api_v1_router.include_router(health_router, tags=["health"])
api_v1_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_v1_router.include_router(users_router, prefix="/users", tags=["users"])
api_v1_router.include_router(api_keys_router, prefix="/api-keys", tags=["api-keys"])
api_v1_router.include_router(licenses_router, prefix="/licenses", tags=["licenses"])
api_v1_router.include_router(nodes_router, prefix="/nodes", tags=["nodes"])
api_v1_router.include_router(subscriptions_router, prefix="/subscriptions", tags=["subscriptions"])

