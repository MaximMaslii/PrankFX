from app.repositories.user_repository import UserRepository


class AuthService:

    def __init__(self):
        self.users = UserRepository()
