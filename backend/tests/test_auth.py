def login(client, username="Rakeshreddy", password="Rakeshreddy123"):
    return client.post("/api/login", json={"username": username, "password": password})


def test_me_requires_login(client):
    assert client.get("/api/me").status_code == 401


def test_login_success(client):
    response = login(client)
    assert response.status_code == 200
    assert response.json() == {"username": "Rakeshreddy"}
    assert client.get("/api/me").json() == {"username": "Rakeshreddy"}


def test_login_wrong_password(client):
    assert login(client, password="wrong").status_code == 401
    assert client.get("/api/me").status_code == 401


def test_login_wrong_username(client):
    assert login(client, username="other").status_code == 401


def test_logout_clears_session(client):
    login(client)
    assert client.post("/api/logout").status_code == 200
    assert client.get("/api/me").status_code == 401
