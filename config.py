import os
from datetime import timedelta

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

basedir = os.path.abspath(os.path.dirname(__file__))

REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379')


class Config:
    # Set real values for these in .env before deploying anywhere
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-only-secret-key-change-me-in-production')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'dev-only-jwt-secret-change-me-in-production')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)

    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL', 'sqlite:///' + os.path.join(basedir, 'hospital.db')
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Leave CACHE_TYPE unset to use Redis when it's running and an in-memory cache otherwise
    CACHE_TYPE = os.environ.get('CACHE_TYPE')
    CACHE_REDIS_URL = os.environ.get('CACHE_REDIS_URL', REDIS_URL + '/0')
    CACHE_KEY_PREFIX = 'hms:'
    CACHE_DEFAULT_TIMEOUT = 300

    CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', REDIS_URL + '/1')
    CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', REDIS_URL + '/1')
    TIMEZONE = os.environ.get('TIMEZONE', 'Asia/Kolkata')

    # Emails are only sent when MAIL_USERNAME is set, otherwise they're logged
    MAIL_SERVER = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
    MAIL_PORT = int(os.environ.get('MAIL_PORT', 587))
    MAIL_USE_TLS = True
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME', '')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD', '')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER') or MAIL_USERNAME or 'hms@hospital.local'

    UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', os.path.join(basedir, 'uploads'))

    # Default admin account, created on first run
    ADMIN_USERNAME = os.environ.get('ADMIN_USERNAME', 'admin')
    ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')
    ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'admin@hospital.com')


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite://'
    CACHE_TYPE = 'SimpleCache'
    MAIL_USERNAME = ''
