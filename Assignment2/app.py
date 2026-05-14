from flask import Flask, render_template
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_mail import Mail
from config import Config
from models import db, User, Department
from api import cache
import os

jwt = JWTManager()
mail = Mail()


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)
    jwt.init_app(app)
    mail.init_app(app)
    CORS(app)

    cache.init_app(app)

    from api import api_bp
    app.register_blueprint(api_bp, url_prefix='/api')

    @app.route('/')
    def index():
        return render_template('index.html')

    with app.app_context():
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        db.create_all()
        _seed_admin_and_departments()

    return app


def _seed_admin_and_departments():
    """Create admin user and default departments programmatically."""
    if not User.query.filter_by(role='admin').first():
        admin = User(
            username='admin',
            email='admin@hospital.com',
            role='admin',
            name='Hospital Admin',
            phone='9999999999'
        )
        admin.set_password('admin123')
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


app = create_app()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
