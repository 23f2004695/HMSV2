from datetime import date, timedelta

from models import db, Appointment, Doctor


def test_daily_reminders_runs_without_mail_configured(app, api, admin):
    _, doctor_id = api.create_doctor(admin, 'drx', available_on=date.today().isoformat(), start='23:58', end='23:59')
    with app.app_context():
        from tasks import send_daily_reminders
        assert send_daily_reminders.run().startswith('0 reminders')


def test_monthly_report_escapes_html(app, api, admin):
    drx, doctor_id = api.create_doctor(admin, 'drx')
    alice, _ = api.register_patient('alice')
    appt = api.book(alice, doctor_id).get_json()
    api.post(f"/appointments/{appt['id']}/treatment", as_=drx, json={'diagnosis': '<script>alert(1)</script>'})

    with app.app_context():
        from tasks import build_monthly_report
        doctor = db.session.get(Doctor, doctor_id)
        day = db.session.get(Appointment, appt['id']).date
        report = build_monthly_report(doctor, day - timedelta(days=1), day + timedelta(days=1))
        assert '<script>' not in report
        assert '&lt;script&gt;' in report


def test_async_export_returns_a_task_or_a_file(api, admin):
    _, doctor_id = api.create_doctor(admin, 'drx')
    alice, patient_id = api.register_patient('alice')
    api.book(alice, doctor_id)

    res = api.post(f'/patients/{patient_id}/export', as_=alice)
    assert res.status_code in (200, 202)
    body = res.get_json()
    assert body.get('task_id') or body.get('filename')
