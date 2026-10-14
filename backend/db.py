"""MongoDB client setup."""
import os
from motor.motor_asyncio import AsyncIOMotorClient

mongo_url = os.environ['MONGO_URL']
# Timeouts explícitos: una conexión colgada con Atlas debe fallar rápido en
# lugar de bloquear las peticiones indefinidamente (arranque en frío en Render).
client = AsyncIOMotorClient(
    mongo_url,
    serverSelectionTimeoutMS=15000,
    connectTimeoutMS=15000,
    socketTimeoutMS=45000,
    maxPoolSize=20,
)
db = client[os.environ['DB_NAME']]


def get_db():
    return db
