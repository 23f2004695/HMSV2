"""Every one of these used to succeed for the wrong user."""
from conftest import TOMORROW


def setup_two_patients(api, admin):
    drx, doctor_id = api.create_doctor(admin, 'drx')
    alice, alice_id = api.register_patient('alice')
    bob, bob_id = api.register_patient('bob')
    appt = api.book(alice, doctor_id).get_json()
    return drx, doctor_id, alice, alice_id, bob, bob_id, appt


def test_patient_cannot_read_another_patients_records(api, admin):
    *_, alice_id, bob, _, _ = setup_two_patients(api, admin)
    assert api.get(f'/patients/{alice_id}', as_=bob).status_code == 403
    assert api.get(f'/patients/{alice_id}/history', as_=bob).status_code == 403
    assert api.post(f'/patients/{alice_id}/export/sync', as_=bob).status_code == 403


def test_patient_cannot_touch_another_patients_appointment(api, admin):
    *_, bob, _, appt = setup_two_patients(api, admin)
    assert api.put(f"/appointments/{appt['id']}/cancel", as_=bob).status_code == 403
    assert api.put(f"/appointments/{appt['id']}", as_=bob, json={'status': 'Completed'}).status_code == 403


def test_patient_cannot_mark_own_appointment_completed(api, admin):
    _, _, alice, *_, appt = setup_two_patients(api, admin)
    assert api.put(f"/appointments/{appt['id']}", as_=alice, json={'status': 'Completed'}).status_code == 403


def test_patient_cannot_edit_another_patient(api, admin):
    *_, alice_id, bob, _, _ = setup_two_patients(api, admin)
    assert api.put(f'/patients/{alice_id}', as_=bob, json={'name': 'Hacked'}).status_code == 403


def test_doctor_cannot_edit_patient_profiles(api, admin):
    drx, _, _, alice_id, *_ = setup_two_patients(api, admin)
    assert api.put(f'/patients/{alice_id}', as_=drx, json={'name': 'Changed'}).status_code == 403


def test_other_doctor_cannot_treat_or_view(api, admin):
    _, _, _, alice_id, _, _, appt = setup_two_patients(api, admin)
    other, _ = api.create_doctor(admin, 'drother', available_on=None)
    assert api.post(f"/appointments/{appt['id']}/treatment", as_=other, json={'diagnosis': 'x'}).status_code == 403
    assert api.get(f'/patients/{alice_id}/history', as_=other).status_code == 403


def test_doctor_sees_only_own_patients(api, admin):
    drx, *_ = setup_two_patients(api, admin)
    names = [p['name'] for p in api.get('/patients', as_=drx).get_json()]
    assert names == ['Alice']


def test_treating_doctor_can_view_history(api, admin):
    drx, _, _, alice_id, *_ = setup_two_patients(api, admin)
    assert api.get(f'/patients/{alice_id}/history', as_=drx).status_code == 200


def test_only_owner_doctor_or_admin_can_set_availability(api, admin):
    _, doctor_id, alice, *_ = setup_two_patients(api, admin)
    other, _ = api.create_doctor(admin, 'drother', available_on=None)
    slot = {'slots': [{'date': TOMORROW, 'start_time': '18:00', 'end_time': '19:00'}]}
    assert api.post(f'/doctors/{doctor_id}/availability', as_=alice, json=slot).status_code == 403
    assert api.post(f'/doctors/{doctor_id}/availability', as_=other, json=slot).status_code == 403
    assert api.post(f'/doctors/{doctor_id}/availability', as_=admin, json=slot).status_code == 200


def test_availability_validation(api, admin):
    drx, doctor_id = api.create_doctor(admin, 'drx', available_on=None)

    def add(start, end, day=TOMORROW):
        return api.post(f'/doctors/{doctor_id}/availability', as_=drx, json={
            'slots': [{'date': day, 'start_time': start, 'end_time': end}]
        }).status_code

    assert add('10:00', '09:00') == 400          # ends before it starts
    assert add('09:00', '10:00', '2020-01-01') == 400  # in the past
    assert add('09:00', '12:00') == 200
    assert add('11:00', '13:00') == 409          # overlaps
    assert add('12:00', '13:00') == 200          # touching is fine


def test_download_requires_login_and_access(api, admin):
    *_, alice, alice_id, bob, _, _ = setup_two_patients(api, admin)
    filename = api.post(f'/patients/{alice_id}/export/sync', as_=alice).get_json()['filename']
    assert api.get(f'/download/{filename}').status_code == 401
    assert api.get(f'/download/{filename}', as_=bob).status_code == 403
    assert api.get(f'/download/{filename}', as_=admin).status_code == 200
    assert api.get('/download/..%2Fconfig.py', as_=admin).status_code == 404


def test_search_is_admin_only(api, admin):
    *_, bob, _, _ = setup_two_patients(api, admin)
    assert api.get('/search?q=a', as_=bob).status_code == 403
    assert api.get('/search?q=alice', as_=admin).get_json()['patients'][0]['name'] == 'Alice'


def test_patients_never_see_deactivated_doctors_from_admin_cache(api, admin):
    _, doctor_id, alice, *_ = setup_two_patients(api, admin)
    api.delete(f'/doctors/{doctor_id}', as_=admin)
    assert len(api.get('/doctors', as_=admin).get_json()) == 1   # admin still sees it
    assert api.get('/doctors', as_=alice).get_json() == []


def test_admin_only_endpoints(api, admin):
    *_, bob, _, _ = setup_two_patients(api, admin)
    assert api.get('/admin/stats', as_=bob).status_code == 403
    assert api.post('/departments', as_=bob, json={'name': 'X'}).status_code == 403
    assert api.post('/doctors', as_=bob, json={}).status_code == 403


def test_department_validation(api, admin):
    assert api.post('/departments', as_=admin, json={}).status_code == 400
    assert api.post('/departments', as_=admin, json={'name': 'cardiology'}).status_code == 409
    assert api.post('/departments', as_=admin, json={'name': 'Oncology'}).status_code == 201


def test_doctor_form_validation(api, admin):
    base = {'username': 'dry', 'email': 'dry@example.com', 'password': 'secret123', 'name': 'Dr Y'}
    # the admin form sends "" when no department is picked; that used to be saved as-is
    res = api.post('/doctors', as_=admin, json={**base, 'department_id': '', 'experience_years': ''})
    assert res.status_code == 201
    assert res.get_json()['department_id'] is None
    doctor_id = res.get_json()['id']

    assert api.put(f'/doctors/{doctor_id}', as_=admin, json={'experience_years': '4 years'}).status_code == 400
    assert api.put(f'/doctors/{doctor_id}', as_=admin, json={'consultation_fee': -1}).status_code == 400
    assert api.put(f'/doctors/{doctor_id}', as_=admin, json={'department_id': 999}).status_code == 400
    assert api.put(f'/doctors/{doctor_id}', as_=admin, json={'email': 'admin@hospital.com'}).status_code == 409
