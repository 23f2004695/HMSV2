from datetime import date, timedelta

from conftest import TOMORROW


def test_patient_can_book_inside_availability(api, admin):
    _, doctor_id = api.create_doctor(admin, 'drx')
    alice, _ = api.register_patient('alice')
    res = api.book(alice, doctor_id)
    assert res.status_code == 201
    assert res.get_json()['status'] == 'Booked'
    assert res.get_json()['department'] == 'General Medicine'


def test_booking_outside_availability_is_rejected(api, admin):
    _, doctor_id = api.create_doctor(admin, 'drx', start='09:00', end='12:00')
    alice, _ = api.register_patient('alice')
    assert api.book(alice, doctor_id, time='14:00').status_code == 400
    assert api.book(alice, doctor_id, time='12:00').status_code == 400  # end time is exclusive


def test_booking_validates_input(api, admin):
    _, doctor_id = api.create_doctor(admin, 'drx')
    alice, _ = api.register_patient('alice')
    assert api.post('/appointments', as_=alice, json={'doctor_id': doctor_id, 'date': TOMORROW}).status_code == 400
    assert api.post('/appointments', as_=alice, json={'doctor_id': doctor_id, 'date': TOMORROW, 'time': '25:00'}).status_code == 400
    assert api.post('/appointments', as_=alice, json={'doctor_id': 999, 'date': TOMORROW, 'time': '10:00'}).status_code == 404
    assert api.book(alice, doctor_id, day='2020-01-01').status_code == 400


def test_same_slot_cannot_be_double_booked(api, admin):
    _, doctor_id = api.create_doctor(admin, 'drx')
    alice, _ = api.register_patient('alice')
    bob, _ = api.register_patient('bob')
    assert api.book(alice, doctor_id).status_code == 201
    assert api.book(bob, doctor_id).status_code == 409


def test_patient_cannot_be_in_two_places_at_once(api, admin):
    _, dr1 = api.create_doctor(admin, 'drone')
    _, dr2 = api.create_doctor(admin, 'drtwo')
    alice, _ = api.register_patient('alice')
    assert api.book(alice, dr1).status_code == 201
    assert api.book(alice, dr2).status_code == 409


def test_cancelled_slot_can_be_booked_again(api, admin):
    """Used to crash with a 500 because of a unique constraint that included cancelled rows."""
    _, doctor_id = api.create_doctor(admin, 'drx')
    alice, _ = api.register_patient('alice')
    bob, _ = api.register_patient('bob')
    appt = api.book(alice, doctor_id).get_json()
    assert api.put(f"/appointments/{appt['id']}/cancel", as_=alice).status_code == 200
    assert api.book(bob, doctor_id).status_code == 201


def test_cannot_book_deactivated_doctor(api, admin):
    _, doctor_id = api.create_doctor(admin, 'drx')
    alice, _ = api.register_patient('alice')
    api.delete(f'/doctors/{doctor_id}', as_=admin)
    assert api.book(alice, doctor_id).status_code == 400


def test_reschedule(api, admin):
    _, doctor_id = api.create_doctor(admin, 'drx')
    alice, _ = api.register_patient('alice')
    appt = api.book(alice, doctor_id).get_json()

    res = api.put(f"/appointments/{appt['id']}", as_=alice, json={'date': TOMORROW, 'time': '11:30'})
    assert res.status_code == 200
    assert res.get_json()['time'] == '11:30'

    # empty fields from the form used to crash the server
    assert api.put(f"/appointments/{appt['id']}", as_=alice, json={'date': '', 'time': ''}).status_code == 400
    assert api.put(f"/appointments/{appt['id']}", as_=alice, json={'date': TOMORROW, 'time': '20:00'}).status_code == 400


def test_cancelled_or_completed_appointments_cannot_change(api, admin):
    _, doctor_id = api.create_doctor(admin, 'drx')
    alice, _ = api.register_patient('alice')
    appt = api.book(alice, doctor_id).get_json()
    api.put(f"/appointments/{appt['id']}/cancel", as_=alice)

    assert api.put(f"/appointments/{appt['id']}/cancel", as_=alice).status_code == 400
    assert api.put(f"/appointments/{appt['id']}", as_=alice, json={'date': TOMORROW, 'time': '11:00'}).status_code == 400


def test_doctor_completes_appointment_with_treatment(api, admin):
    drx, doctor_id = api.create_doctor(admin, 'drx')
    alice, patient_id = api.register_patient('alice')
    appt = api.book(alice, doctor_id).get_json()

    assert api.post(f"/appointments/{appt['id']}/treatment", as_=drx, json={'diagnosis': ''}).status_code == 400

    res = api.post(f"/appointments/{appt['id']}/treatment", as_=drx, json={
        'diagnosis': 'Seasonal flu', 'prescription': 'Rest and fluids',
        'next_visit': (date.today() + timedelta(days=10)).isoformat()
    })
    assert res.status_code == 200
    assert res.get_json()['status'] == 'Completed'

    # history is fresh straight away, not served from a stale cache
    history = api.get(f'/patients/{patient_id}/history', as_=alice).get_json()
    assert history[0]['treatment']['diagnosis'] == 'Seasonal flu'


def test_cannot_treat_cancelled_appointment(api, admin):
    drx, doctor_id = api.create_doctor(admin, 'drx')
    alice, _ = api.register_patient('alice')
    appt = api.book(alice, doctor_id).get_json()
    api.put(f"/appointments/{appt['id']}/cancel", as_=alice)
    res = api.post(f"/appointments/{appt['id']}/treatment", as_=drx, json={'diagnosis': 'x'})
    assert res.status_code == 400


def test_admin_stats_update_after_booking(api, admin):
    _, doctor_id = api.create_doctor(admin, 'drx')
    alice, _ = api.register_patient('alice')
    assert api.get('/admin/stats', as_=admin).get_json()['booked_appointments'] == 0
    api.book(alice, doctor_id)
    assert api.get('/admin/stats', as_=admin).get_json()['booked_appointments'] == 1


def test_csv_export_and_download(api, admin):
    _, doctor_id = api.create_doctor(admin, 'drx')
    alice, patient_id = api.register_patient('alice')
    api.book(alice, doctor_id)

    res = api.post(f'/patients/{patient_id}/export/sync', as_=alice)
    assert res.status_code == 200
    filename = res.get_json()['filename']

    download = api.get(f'/download/{filename}', as_=alice)
    assert download.status_code == 200
    assert b'Patient Name' in download.data
    assert b'Alice' in download.data
