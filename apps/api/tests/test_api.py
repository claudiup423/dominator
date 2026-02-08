import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_register_and_login(client: AsyncClient):
    resp = await client.post("/api/auth/register", json={
        "email": "newuser@test.com",
        "password": "securepass",
        "role": "player",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert data["user"]["email"] == "newuser@test.com"

    # Login
    resp2 = await client.post("/api/auth/login", json={
        "email": "newuser@test.com",
        "password": "securepass",
    })
    assert resp2.status_code == 200
    assert "access_token" in resp2.json()


@pytest.mark.asyncio
async def test_register_duplicate(client: AsyncClient):
    await client.post("/api/auth/register", json={
        "email": "dup@test.com",
        "password": "securepass",
    })
    resp = await client.post("/api/auth/register", json={
        "email": "dup@test.com",
        "password": "securepass",
    })
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_me_unauthenticated(client: AsyncClient):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_models_require_admin(client: AsyncClient):
    # Register player
    await client.post("/api/auth/register", json={
        "email": "player2@test.com",
        "password": "testpass",
        "role": "player",
    })
    login = await client.post("/api/auth/login", json={
        "email": "player2@test.com",
        "password": "testpass",
    })
    token = login.json()["access_token"]

    resp = await client.post(
        "/api/models",
        json={"name": "test", "version": "v1"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_list_models_public(client: AsyncClient):
    resp = await client.get("/api/models")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
