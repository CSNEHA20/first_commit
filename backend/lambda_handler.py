"""
PolicyLab AWS Lambda Entrypoint
Adapts the FastAPI application for AWS Lambda execution via Mangum.
Preserves existing routes, middleware, and domain logic with zero divergence.
"""

from mangum import Mangum
from backend.main import app

# Mangum ASGI adapter for AWS API Gateway / Lambda
handler = Mangum(app, lifespan="off")
