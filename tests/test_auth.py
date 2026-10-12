def test_admin_is_seeded_and_can_log_in(api):
    res = api.post('/auth/login', json={'username': 'admin', 'password': 'admin123'})
    assert res.status_code == 200
    assert res.get_json()['user']['role'] == 'admin'


def test_wrong_password_is_rejected(api):
    res = api.post('/auth/login', json={'username': 'admin', 'password': 'nope'})
    assert res.status_code == 401


def test_login_with_empty_body_returns_400_not_500(api):
    res = api.post('/auth/login', data='not json', content_type='text/plain')
    assert res.status_code == 400


def test_register_creates_patient(api):
    token, patient_id = api.register_patient('alice')
    me = api.get('/auth/me', as_=token).get_json()
    assert me['role'] == 'patient'
    assert me['patient']['id'] == patient_id


def test_register_validates_input(api):
    base = {'username': 'bob', 'email': 'bob@example.com', 'password': 'secret123', 'name': 'Bob'}
    assert api.post('/auth/register', json={**base, 'email': 'not-an-email'}).status_code == 400
    assert api.post('/auth/register', json={**base, 'password': '123'}).status_code == 400
    assert api.post('/auth/register', json={**base, 'date_of_birth': '31-12-2000'}).status_code == 400
    assert api.post('/auth/register', json={**base, 'blood_group': 'Z+'}).status_code == 400


def test_register_rejects_duplicates_case_insensitively(api):
    api.register_patient('alice')
    res = api.post('/auth/register', json={
        'username': 'ALICE', 'email': 'other@example.com', 'password': 'secret123', 'name': 'A'
    })
    assert res.status_code == 409


def test_requests_without_token_get_json_401(api):
    res = api.get('/appointments')
    assert res.status_code == 401
    assert 'error' in res.get_json()


def test_deactivated_patient_is_locked_out_immediately(api, admin):
    token, patient_id = api.register_patient('alice')
    api.put(f'/patients/{patient_id}/deactivate', as_=admin)
    # The old token stops working straight away, not after it expires
    assert api.get('/appointments', as_=token).status_code == 401
    assert api.post('/auth/login', json={'username': 'alice', 'password': 'secret123'}).status_code == 403


def test_user_can_update_own_profile_and_password(api):
    token, _ = api.register_patient('alice')
    res = api.put('/auth/me', as_=token, json={'name': 'Alice Smith', 'blood_group': 'O+'})
    assert res.status_code == 200
    assert res.get_json()['name'] == 'Alice Smith'
    assert res.get_json()['patient']['blood_group'] == 'O+'

    assert api.put('/auth/me', as_=token, json={'current_password': 'wrong', 'new_password': 'newpass1'}).status_code == 403
    assert api.put('/auth/me', as_=token, json={'current_password': 'secret123', 'new_password': 'newpass1'}).status_code == 200
    api.login('alice', 'newpass1')


def test_doctor_can_update_own_profile(api, admin):
    token, _ = api.create_doctor(admin, 'drhouse', available_on=None)
    res = api.put('/auth/me', as_=token, json={'phone': '9876543210'})
    assert res.status_code == 200
    assert api.get('/auth/me', as_=token).get_json()['phone'] == '9876543210'


def test_unknown_api_route_returns_json(api):
    res = api.get('/does-not-exist')
    assert res.status_code == 404
    assert res.get_json()['error']
