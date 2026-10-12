import logging
import os

from flask import Flask, jsonify, render_template, request
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from config import Config
from extensions import cache, jwt, mail
from models import db, User, Department

log = logging.getLogger(__name__)


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    jwt.init_app(app)
    mail.init_app(app)
    CORS(app)

    if not app.config.get('CACHE_TYPE'):
        app.config['CACHE_TYPE'] = 'RedisCache' if _redis_available(app.config['CACHE_REDIS_URL']) else 'SimpleCache'
    cache.init_app(app)
    log.info('Using %s for caching', app.config['CACHE_TYPE'])

    from api import api_bp
    import api_live  # noqa: F401  (adds the queue, lobby and slot routes to api_bp)
    app.register_blueprint(api_bp, url_prefix='/api')

    _register_error_handlers(app)

    @app.route('/')
    def index():
        return render_template('index.html')

    with app.app_context():
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        db.create_all()
        _upgrade_schema()
        _seed_admin_and_departments(app)

    return app


def _redis_available(url):
    try:
        import redis
        redis.Redis.from_url(url, socket_connect_timeout=0.5).ping()
        return True
    except Exception:
        log.warning('Redis not reachable at %s, falling back to in-memory cache', url)
        return False


def _register_error_handlers(app):
    # API clients always get JSON back, never an HTML error page
    @app.errorhandler(HTTPException)
    def http_error(e):
        if request.path.startswith('/api/'):
            return jsonify({'error': e.description}), e.code
        return e

    @app.errorhandler(Exception)
    def unhandled_error(e):
        db.session.rollback()
        log.exception('Unhandled error on %s', request.path)
        return jsonify({'error': 'Something went wrong on our side. Please try again.'}), 500

    @jwt.unauthorized_loader
    def missing_token(reason):
        return jsonify({'error': 'Please log in to continue'}), 401

    @jwt.invalid_token_loader
    def invalid_token(reason):
        return jsonify({'error': 'Your session is invalid. Please log in again.'}), 401

    @jwt.expired_token_loader
    def expired_token(header, payload):
        return jsonify({'error': 'Your session has expired. Please log in again.'}), 401


# Columns added after the first release. create_all() doesn't touch existing tables,
# so older databases get them added here.
NEW_COLUMNS = {
    'doctors': {'room': 'VARCHAR(20)'},
    'appointments': {'token': 'VARCHAR(10)', 'called_at': 'DATETIME'},
}


def _upgrade_schema():
    from sqlalchemy import inspect, text
    inspector = inspect(db.engine)
    with db.engine.begin() as conn:
        for table, columns in NEW_COLUMNS.items():
            existing = {c['name'] for c in inspector.get_columns(table)}
            for name, sql_type in columns.items():
                if name not in existing:
                    conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {name} {sql_type}'))

    from models import Appointment
    from api_live import assign_token
    missing = Appointment.query.filter(Appointment.token.is_(None))\
        .order_by(Appointment.date, Appointment.created_at, Appointment.id).all()
    for appointment in missing:
        assign_token(appointment)
        db.session.flush()
    if missing:
        db.session.commit()


def _seed_admin_and_departments(app):
    """Create the admin user and default departments on first run."""
    if not User.query.filter_by(role='admin').first():
        admin = User(
            username=app.config['ADMIN_USERNAME'],
            email=app.config['ADMIN_EMAIL'],
            role='admin',
            name='Hospital Admin',
            phone='9999999999'
        )
        admin.set_password(app.config['ADMIN_PASSWORD'])
        db.session.add(admin)

    default_departments = [
        ('General Medicine', 'General health consultations and treatments'),
        ('Cardiology', 'Heart and cardiovascular system'),
        ('Orthopedics', 'Bones, joints, and musculoskeletal system'),
        ('Dermatology', 'Skin, hair, and nail conditions'),
        ('Pediatrics', 'Medical care for infants, children, and adolescents'),
        ('Neurology', 'Brain and nervous system disorders'),
        ('ENT', 'Ear, nose, and throat conditions'),
        ('Ophthalmology', 'Eye care and vision disorders'),
    ]
    for name, desc in default_departments:
        if not Department.query.filter_by(name=name).first():
            db.session.add(Department(name=name, description=desc))

    db.session.commit()


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    create_app().run(debug=os.environ.get('FLASK_DEBUG') == '1', port=int(os.environ.get('PORT', 5000)))
