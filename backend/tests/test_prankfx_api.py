"""PrankFX backend API integration tests."""
import time
import requests
import pytest



# ---------- Health ----------
class TestHealth:
    def test_root(self, api_url):
        r = requests.get(f"{api_url}/", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "ok"
        assert "PrankFX" in data.get("service", "")


# ---------- Auth: Email/Password ----------
class TestAuthEmail:
    reg_state = {}

    def test_register_new_user(self, api_url, unique_email):
        payload = {"email": unique_email, "password": "SecurePass123!", "name": "TEST User"}
        r = requests.post(f"{api_url}/auth/register", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and "user" in data
        u = data["user"]
        assert u["email"] == unique_email.lower()
        assert u["provider"] == "email"
        assert u["is_premium"] is False
        assert "_id" not in u
        assert "password_hash" not in u
        TestAuthEmail.reg_state["token"] = data["token"]
        TestAuthEmail.reg_state["user_id"] = u["user_id"]
        TestAuthEmail.reg_state["email"] = unique_email

    def test_register_duplicate_returns_409(self, api_url):
        email = TestAuthEmail.reg_state.get("email")
        assert email, "prior test must have set email"
        r = requests.post(f"{api_url}/auth/register", json={"email": email, "password": "Whatever123!"}, timeout=30)
        assert r.status_code == 409, r.text

    def test_login_registered_user(self, api_url):
        email = TestAuthEmail.reg_state.get("email")
        assert email, "prior registration test must have set email"

        password = "SecurePass123!"

        r = requests.post(
            f"{api_url}/auth/login",
            json={
                "email": email,
                "password": password,
            },
            timeout=30,
        )

        assert r.status_code == 200, r.text

        data = r.json()

        assert data["user"]["email"] == email.lower()
        assert "token" in data

    def test_login_wrong_password(self, api_url, demo_credentials):
        r = requests.post(f"{api_url}/auth/login", json={"email": demo_credentials["email"], "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_forgot_returns_200_for_existing(self, api_url, demo_credentials):
        r = requests.post(f"{api_url}/auth/forgot", json={"email": demo_credentials["email"]}, timeout=15)
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_forgot_returns_200_for_nonexistent(self, api_url):
        r = requests.post(f"{api_url}/auth/forgot", json={"email": "nobody-xyz@nowhere-xyz-example.com"}, timeout=15)
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_me_with_jwt(self, api_url):
        token = TestAuthEmail.reg_state["token"]
        r = requests.get(f"{api_url}/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r.status_code == 200, r.text
        u = r.json()
        assert u["user_id"] == TestAuthEmail.reg_state["user_id"]
        assert "_id" not in u

    def test_me_missing_bearer(self, api_url):
        r = requests.get(f"{api_url}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_me_invalid_token(self, api_url):
        r = requests.get(f"{api_url}/auth/me", headers={"Authorization": "Bearer invalidtoken.xxx.yyy"}, timeout=15)
        assert r.status_code == 401

    def test_logout(self, api_url):
        token = TestAuthEmail.reg_state["token"]
        r = requests.post(f"{api_url}/auth/logout", headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r.status_code == 200
        # JWT still valid because logout only deletes session (google) tokens
        r2 = requests.get(f"{api_url}/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r2.status_code == 200  # JWT still valid by design


# ---------- Effects ----------
class TestEffects:
    def test_catalog_structure(self, api_url):
        r = requests.get(f"{api_url}/effects", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "categories" in data
        cats = data["categories"]
        cat_ids = {c["id"] for c in cats}
        assert cat_ids == {"face", "vehicle", "house", "object"}
        for c in cats:
            assert "effects" in c and len(c["effects"]) > 0
            for e in c["effects"]:
                assert "id" in e and "name" in e
                # No raw prompts leaked
                assert "prompt" not in e


# ---------- Premium gating & Generate ----------
class TestPremiumGating:
    """Requires a fresh user with no premium."""

    def test_generate_denied_without_premium(self, api_url, small_image_b64):
        # Register a fresh throwaway user
        email = f"TEST_gate_{int(time.time()*1000)}@prankfxtest.com"
        r = requests.post(f"{api_url}/auth/register", json={"email": email, "password": "GateTest123!"}, timeout=30)
        assert r.status_code == 200, r.text
        token = r.json()["token"]
        # Try a face effect (requires face_effects tier)
        r2 = requests.post(
            f"{api_url}/generate",
            json={"image_base64": small_image_b64, "effect_id": "movie_bruises", "save_to_history": False},
            headers={"Authorization": f"Bearer {token}"},
            timeout=60,
        )
        assert r2.status_code == 402, f"expected 402, got {r2.status_code}: {r2.text}"
        # cleanup — delete the throwaway
        requests.delete(f"{api_url}/auth/account", headers={"Authorization": f"Bearer {token}"}, timeout=15)

    def test_generate_unknown_effect(self, api_url, demo_token, small_image_b64):
        r = requests.post(
            f"{api_url}/generate",
            json={"image_base64": small_image_b64, "effect_id": "does_not_exist", "save_to_history": False},
            headers={"Authorization": f"Bearer {demo_token}"},
            timeout=30,
        )
        assert r.status_code == 404


# ---------- Subscription (Mock) ----------
class TestSubscription:
    sub_state = {}

    def test_setup_new_user(self, api_url):
        email = f"TEST_sub_{int(time.time()*1000)}@prankfxtest.com"
        r = requests.post(f"{api_url}/auth/register", json={"email": email, "password": "SubTest123!"}, timeout=30)
        assert r.status_code == 200
        TestSubscription.sub_state["token"] = r.json()["token"]

    def test_restore_before_activate(self, api_url):
        token = TestSubscription.sub_state["token"]
        r = requests.post(f"{api_url}/subscription/restore", headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["is_premium"] is False
        assert data["premium_tier"] is None

    def test_mock_activate_face_effects(self, api_url):
        token = TestSubscription.sub_state["token"]
        r = requests.post(
            f"{api_url}/subscription/mock-activate",
            json={"tier": "face_effects", "interval": "month"},
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["tier"] == "face_effects"
        # verify via /auth/me
        me = requests.get(f"{api_url}/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=15).json()
        assert me["is_premium"] is True
        assert me["premium_tier"] == "face_effects"

    def test_face_tier_cannot_access_ultimate_effect(self, api_url, small_image_b64):
        token = TestSubscription.sub_state["token"]
        r = requests.post(
            f"{api_url}/generate",
            json={"image_base64": small_image_b64, "effect_id": "broken_windshield", "save_to_history": False},
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        assert r.status_code == 402, r.text

    def test_mock_activate_ultimate(self, api_url):
        token = TestSubscription.sub_state["token"]
        r = requests.post(
            f"{api_url}/subscription/mock-activate",
            json={"tier": "ultimate", "interval": "year"},
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["tier"] == "ultimate"

    def test_cancel(self, api_url):
        token = TestSubscription.sub_state["token"]
        r = requests.post(f"{api_url}/subscription/cancel", headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r.status_code == 200
        r2 = requests.post(f"{api_url}/subscription/restore", headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["is_premium"] is False

    def test_cleanup(self, api_url):
        token = TestSubscription.sub_state.get("token")
        if token:
            requests.delete(f"{api_url}/auth/account", headers={"Authorization": f"Bearer {token}"}, timeout=15)


# ---------- Nano Banana Real Generate (single call) ----------
class TestAIGeneration:
    ai_state = {}

    def test_real_generate_with_demo_premium(self, api_url, demo_token, small_image_b64):
        # Ensure demo is ultimate
        requests.post(
            f"{api_url}/subscription/mock-activate",
            json={"tier": "ultimate", "interval": "month"},
            headers={"Authorization": f"Bearer {demo_token}"},
            timeout=15,
        )
        r = requests.post(
            f"{api_url}/generate",
            json={"image_base64": small_image_b64, "effect_id": "black_eye", "save_to_history": True},
            headers={"Authorization": f"Bearer {demo_token}"},
            timeout=180,  # Nano Banana is slow
        )
        assert r.status_code == 200, f"generate failed: {r.status_code} {r.text[:500]}"
        data = r.json()
        assert data["effect_id"] == "black_eye"
        assert data["category"] == "face"
        assert len(data["result_image"]) > 100
        assert len(data["original_image"]) > 100
        assert "_id" not in data
        TestAIGeneration.ai_state["project_id"] = data["project_id"]


# ---------- Projects ----------
class TestProjects:
    def test_list_projects(self, api_url, demo_token):
        r = requests.get(f"{api_url}/projects", headers={"Authorization": f"Bearer {demo_token}"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "items" in data
        assert isinstance(data["items"], list)
        for it in data["items"]:
            assert "_id" not in it
            assert "thumbnail" in it

    def test_get_project_full(self, api_url, demo_token):
        pid = TestAIGeneration.ai_state.get("project_id")
        if not pid:
            pytest.skip("no project created earlier")
        r = requests.get(f"{api_url}/projects/{pid}", headers={"Authorization": f"Bearer {demo_token}"}, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["project_id"] == pid
        assert "original_image" in d and "result_image" in d
        assert "_id" not in d

    def test_favorite_toggle(self, api_url, demo_token):
        pid = TestAIGeneration.ai_state.get("project_id")
        if not pid:
            pytest.skip("no project created earlier")
        r = requests.patch(
            f"{api_url}/projects/{pid}/favorite",
            json={"is_favorite": True},
            headers={"Authorization": f"Bearer {demo_token}"},
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["is_favorite"] is True
        # verify via favorites filter
        fav = requests.get(f"{api_url}/projects?favorites=true", headers={"Authorization": f"Bearer {demo_token}"}, timeout=15)
        assert fav.status_code == 200
        ids = [i["project_id"] for i in fav.json()["items"]]
        assert pid in ids
        # toggle off
        r2 = requests.patch(
            f"{api_url}/projects/{pid}/favorite",
            json={"is_favorite": False},
            headers={"Authorization": f"Bearer {demo_token}"},
            timeout=15,
        )
        assert r2.status_code == 200
        assert r2.json()["is_favorite"] is False

    def test_search_projects(self, api_url, demo_token):
        r = requests.get(
            f"{api_url}/projects?search=Black",
            headers={"Authorization": f"Bearer {demo_token}"},
            timeout=15,
        )
        assert r.status_code == 200
        # Best effort — we don't require a hit, just proper shape
        assert "items" in r.json()

    def test_delete_project(self, api_url, demo_token):
        pid = TestAIGeneration.ai_state.get("project_id")
        if not pid:
            pytest.skip("no project created earlier")
        r = requests.delete(f"{api_url}/projects/{pid}", headers={"Authorization": f"Bearer {demo_token}"}, timeout=15)
        assert r.status_code == 200
        # verify 404 afterwards
        r2 = requests.get(f"{api_url}/projects/{pid}", headers={"Authorization": f"Bearer {demo_token}"}, timeout=15)
        assert r2.status_code == 404


# ---------- Account deletion cleanup ----------
class TestAccountDeletion:
    def test_delete_registered_user(self, api_url):
        token = TestAuthEmail.reg_state.get("token")
        if not token:
            pytest.skip("no test user")
        r = requests.delete(f"{api_url}/auth/account", headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r.status_code == 200
        # JWT should now be invalid since user is gone
        r2 = requests.get(f"{api_url}/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r2.status_code == 401
