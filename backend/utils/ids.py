import uuid


def generate_user_id() -> str:
    return str(uuid.uuid4())
