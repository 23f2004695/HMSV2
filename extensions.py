from flask_caching import Cache
from flask_jwt_extended import JWTManager
from flask_mail import Mail

cache = Cache()
jwt = JWTManager()
mail = Mail()
