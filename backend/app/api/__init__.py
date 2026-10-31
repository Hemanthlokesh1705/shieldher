# ShieldHer – API routers package
from app.api.health import router as health_router
from app.api.upload import router as upload_router
from app.api.verify import router as verify_router

__all__ = ["health_router", "upload_router", "verify_router"]
