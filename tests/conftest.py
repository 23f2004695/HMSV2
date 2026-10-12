import os
import sys
from datetime import date, timedelta

import pytest

# Keep tests away from any real Redis: in-memory broker, tasks run inline
os.environ['CELERY_BROKER_URL'] = 'memory://'
os.environ['CELERY_RESULT_BACKEND'] = 'cache+memory://'
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app  # noqa: E402
from config import TestConfig  # noqa: E402
from extensions import cache  # noqa: E402
from models import db  # noqa: E402

TOMORROW = (date.today() + timedelta(days=1)).isoformat()


@pytest.fixture
def app(tmp_path):
    class Cfg(TestConfig):
        UPLOAD_FOLDER = str(tmp_path / 'uploads')

    app = create_app(Cfg)
    yield app
    with app.app_context():
        cache.clear()
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


class Api:
    """Small helper so tests read like 'api.post(url, as_=alice, json=...)'."""

    def __init__(self, client):
        self.client = client

    def _call(self, method, url, as_=None, **kwargs):
        headers = {'Authorization': f'Bearer {as_}'} if as_ else {}
        return getattr(self.client, method)('/api' + url, headers=headers, **kwargs)

    def get(self, url, as_=None, **kw):
        return self._call('get', url, as_, **kw)

    def post(self, url, as_=None, **kw):
        return self._call('post', url, as_, **kw)

    def put(self, url, as_=None, **kw):
        return self._call('put', url, as_, **kw)

    def delete(self, url, as_=None, **kw):
        return self._call('delete', url, as_, **kw)

    def login(self, username, password):
        res = self.post('/auth/login', json={'username': username, 'password': password})
        assert res.status_code == 200, res.get_json()
        return res.get_json()['token']

    def register_patient(self, username):
        res = self.post('/auth/register', json={
            'username': username, 'email': f'{username}@example.com',
            'password': 'secret123', 'name': username.title()
        })
        assert res.status_code == 201, res.get_json()
        token = res.get_json()['token']
        patient_id = self.get('/auth/me', as_=token).get_json()['patient']['id']
        return token, patient_id

    def create_doctor(self, admin, username, available_on=TOMORROW, start='09:00', end='17:00'):
        res = self.post('/doctors', as_=admin, json={
            'username': username, 'email': f'{username}@example.com', 'password': 'secret123',
            'name': f'{username.title()}', 'department_id': 1, 'specialization': 'General'
        })
        assert res.status_code == 201, res.get_json()
        doctor_id = res.get_json()['id']
        token = self.login(username, 'secret123')
        if available_on:
            res = self.post(f'/doctors/{doctor_id}/availability', as_=token, json={
                'slots': [{'date': available_on, 'start_time': start, 'end_time': end}]
            })
            assert res.status_code == 200, res.get_json()
        return token, doctor_id

    def book(self, patient, doctor_id, day=TOMORROW, time='10:00'):
        return self.post('/appointments', as_=patient, json={'doctor_id': doctor_id, 'date': day, 'time': time})


@pytest.fixture
def api(client):
    return Api(client)


@pytest.fixture
def admin(api):
    return api.login('admin', 'admin123')
