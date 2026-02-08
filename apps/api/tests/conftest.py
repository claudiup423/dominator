import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def admin_client(client: AsyncClient):
    """Register an admin user and return authenticated client."""
    await client.post("/api/auth/register", json={
        "email": "admin@test.com",
        "password": "testpass123",
        "role": "admin",
    })
    resp = await client.post("/api/auth/login", json={
        "email": "admin@test.com",
        "password": "testpass123",
    })
    token = resp.json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    return client


@pytest.fixture
async def player_client(client: AsyncClient):
    """Register a player user and return authenticated client."""
    await client.post("/api/auth/register", json={
        "email": "player@test.com",
        "password": "testpass123",
        "role": "player",
    })
    resp = await client.post("/api/auth/login", json={
        "email": "player@test.com",
        "password": "testpass123",
    })
    token = resp.json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    return client
