def login(client, username="user", password="password"):
    return client.post("/api/login", json={"username": username, "password": password})


def test_me_requires_login(client):
    assert client.get("/api/me").status_code == 401


def test_login_success(client):
    response = login(client)
    assert response.status_code == 200
    assert response.json() == {"username": "user"}
    assert client.get("/api/me").json() == {"username": "user"}


def test_login_wrong_password(client):
    assert login(client, password="wrong").status_code == 401
    assert client.get("/api/me").status_code == 401


def test_login_wrong_username(client):
    assert login(client, username="other").status_code == 401


def test_logout_clears_session(client):
    login(client)
    assert client.post("/api/logout").status_code == 200
    assert client.get("/api/me").status_code == 401
