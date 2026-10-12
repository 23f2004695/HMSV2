from datetime import date, timedelta

from conftest import TOMORROW



def queue_doctor(api, admin, username='drx'):
    return api.create_doctor(admin, username, available_on=None)


def add_today(app, patient_id, doctor_id, time):
    """Insert today's appointment directly, so queue tests don't depend on the current time of day."""
    from api_live import assign_token
    from models import db, Appointment
    with app.app_context():
        appt = Appointment(patient_id=patient_id, doctor_id=doctor_id, date=date.today(), time=time, status='Booked')
        db.session.add(appt)
        assign_token(appt)
        db.session.commit()
        return appt.to_dict()


def test_booking_gets_a_queue_token(api, admin):
    _, doctor_id = api.create_doctor(admin, 'drx')
    alice, _ = api.register_patient('alice')
    bob, _ = api.register_patient('bob')
    first = api.book(alice, doctor_id, time='10:00').get_json()
    second = api.book(bob, doctor_id, time='10:30').get_json()
    assert first['token'] == 'G-01'   # General Medicine
    assert second['token'] == 'G-02'
    assert first['room'].startswith('Room')


def test_free_slots_skip_booked_times(api, admin):
    _, doctor_id = api.create_doctor(admin, 'drx', start='09:00', end='11:00')
    alice, _ = api.register_patient('alice')
    api.book(alice, doctor_id, time='09:30')
    days = api.get(f'/doctors/{doctor_id}/slots', as_=alice).get_json()['days']
    tomorrow = next(d for d in days if d['date'] == TOMORROW)
    assert tomorrow['slots'] == ['09:00', '10:00', '10:30']


def test_paint_week_replaces_whole_days(api, admin):
    drx, doctor_id = api.create_doctor(admin, 'drx', start='09:00', end='10:00')
    res = api.put(f'/doctors/{doctor_id}/availability/week', as_=drx, json={'days': {
        TOMORROW: [['14:00', '15:00'], ['09:00', '10:00'], ['09:30', '11:00']]
    }})
    assert res.status_code == 200
    assert res.get_json()['days'][TOMORROW] == [['09:00', '11:00'], ['14:00', '15:00']]

    slots = api.get(f'/doctors/{doctor_id}/slots', as_=drx).get_json()['days']
    tomorrow = next(d for d in slots if d['date'] == TOMORROW)
    assert tomorrow['windows'] == [['09:00', '11:00'], ['14:00', '15:00']]


def test_paint_week_validation_and_permissions(api, admin):
    drx, doctor_id = api.create_doctor(admin, 'drx', available_on=None)
    other, _ = api.create_doctor(admin, 'dry', available_on=None)
    url = f'/doctors/{doctor_id}/availability/week'
    assert api.put(url, as_=other, json={'days': {TOMORROW: []}}).status_code == 403
    assert api.put(url, as_=drx, json={'days': {TOMORROW: [['10:00', '09:00']]}}).status_code == 400
    assert api.put(url, as_=drx, json={'days': {'2020-01-01': []}}).status_code == 400
    assert api.put(url, as_=drx, json={}).status_code == 400
    # clearing a day is allowed
    assert api.put(url, as_=drx, json={'days': {TOMORROW: []}}).status_code == 200


def test_call_next_and_ticket_queue(app, api, admin):
    drx, doctor_id = queue_doctor(api, admin)
    _, alice_id = api.register_patient('alice')
    bob, bob_id = api.register_patient('bob')
    a = add_today(app, alice_id, doctor_id, '10:00')
    b = add_today(app, bob_id, doctor_id, '10:30')

    q = api.get(f"/appointments/{b['id']}/queue", as_=bob).get_json()
    assert q['today'] and q['ahead'] == 1 and q['now_serving'] is None

    called = api.post('/queue/next', as_=drx).get_json()
    assert called['id'] == a['id'] and called['called_at']

    q = api.get(f"/appointments/{b['id']}/queue", as_=bob).get_json()
    assert q['ahead'] == 0 and q['now_serving'] == a['token']

    api.post('/queue/next', as_=drx)
    assert api.post('/queue/next', as_=drx).status_code == 404   # nobody left


def test_queue_permissions(app, api, admin):
    drx, doctor_id = queue_doctor(api, admin)
    alice, alice_id = api.register_patient('alice')
    bob, _ = api.register_patient('bob')
    a = add_today(app, alice_id, doctor_id, '10:00')
    assert api.get(f"/appointments/{a['id']}/queue", as_=bob).status_code == 403
    assert api.post('/queue/next', as_=alice).status_code == 403


def test_lobby_is_public_and_hides_patient_names(app, api, admin):
    drx, doctor_id = queue_doctor(api, admin)
    _, alice_id = api.register_patient('alice')
    add_today(app, alice_id, doctor_id, '10:00')
    api.post('/queue/next', as_=drx)

    res = api.get('/lobby')
    assert res.status_code == 200
    board = res.get_json()['boards'][0]
    assert board['now_serving'] == 'G-01'
    assert board['doctor'] == 'Drx'
    assert 'Alice' not in res.get_data(as_text=True)


def test_reschedule_to_another_day_gets_new_token(api, admin):
    _, doctor_id = api.create_doctor(admin, 'drx')
    day_after = (date.today() + timedelta(days=2)).isoformat()
    api.post(f'/doctors/{doctor_id}/availability', as_=api.login('drx', 'secret123'), json={
        'slots': [{'date': day_after, 'start_time': '09:00', 'end_time': '17:00'}]})
    alice, _ = api.register_patient('alice')
    bob, _ = api.register_patient('bob')
    api.book(bob, doctor_id, day=day_after, time='09:00')
    appt = api.book(alice, doctor_id, time='10:00').get_json()
    moved = api.put(f"/appointments/{appt['id']}", as_=alice, json={'date': day_after, 'time': '11:00'}).get_json()
    assert moved['token'] == 'G-02'


def test_admin_sets_doctor_room(api, admin):
    _, doctor_id = api.create_doctor(admin, 'drx', available_on=None)
    assert api.get(f'/doctors/{doctor_id}', as_=admin).get_json()['room'] == f'Room {100 + doctor_id}'
    res = api.put(f'/doctors/{doctor_id}', as_=admin, json={'room': 'Room 7'})
    assert res.get_json()['room'] == 'Room 7'


def test_login_returns_role_profile(api, admin):
    api.create_doctor(admin, 'drx', available_on=None)
    user = api.post('/auth/login', json={'username': 'drx', 'password': 'secret123'}).get_json()['user']
    assert user['doctor']['room'].startswith('Room')
