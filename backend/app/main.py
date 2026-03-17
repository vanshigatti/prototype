from fastapi import FastAPI
from app.routes.analyze import router

app = FastAPI()

app.include_router(router)