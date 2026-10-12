import logging
import os
from datetime import date, timedelta
from html import escape

from flask import current_app
from flask_mail import Message

from celery_worker import celery
from exports import write_patient_csv
from extensions import mail
from models import Appointment, Doctor

log = logging.getLogger(__name__)


def send_email(to, subject, body, html=None):
    """Send an email if mail is configured, otherwise just log it. Returns True if it was sent."""
    if not current_app.config.get('MAIL_USERNAME') or not to:
        log.info('Email not sent (mail not configured) to=%s subject=%s', to, subject)
        return False
    try:
        mail.send(Message(subject=subject, recipients=[to], body=body, html=html))
        return True
    except Exception:
        log.exception('Failed to send email to %s', to)
        return False


@celery.task(name='tasks.send_daily_reminders')
def send_daily_reminders():
    """Remind every patient who has an appointment today."""
    today = date.today()
    appointments = Appointment.query.filter_by(date=today, status='Booked').all()
    sent = 0
    for appt in appointments:
        body = (
            f"Hi {appt.patient.user.name},\n\n"
            f"This is a reminder that you have an appointment with Dr. {appt.doctor.user.name} "
            f"today at {appt.time}.\n\nPlease arrive 10 minutes early.\n"
        )
        log.info('Reminder for %s: Dr. %s at %s', appt.patient.user.name, appt.doctor.user.name, appt.time)
        if send_email(appt.patient.user.email, 'Appointment reminder', body):
            sent += 1
    return f'{len(appointments)} reminders for {today} ({sent} emailed)'


def build_monthly_report(doctor, start, end):
    appointments = Appointment.query.filter(
        Appointment.doctor_id == doctor.id,
        Appointment.date >= start,
        Appointment.date <= end
    ).order_by(Appointment.date, Appointment.time).all()

    rows = []
    for appt in appointments:
        t = appt.treatment
        rows.append(
            '<tr>'
            f'<td>{appt.date}</td><td>{escape(appt.time)}</td>'
            f'<td>{escape(appt.patient.user.name)}</td><td>{appt.status}</td>'
            f'<td>{escape(t.diagnosis) if t else "-"}</td>'
            f'<td>{escape(t.prescription or "-") if t else "-"}</td>'
            '</tr>'
        )

    completed = sum(1 for a in appointments if a.status == 'Completed')
    cancelled = sum(1 for a in appointments if a.status == 'Cancelled')
    return f"""<html>
<head><meta charset="utf-8"><style>
    body {{ font-family: Arial, sans-serif; padding: 20px; }}
    table {{ border-collapse: collapse; width: 100%; }}
    th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
    th {{ background-color: #0d6efd; color: white; }}
    h2 {{ color: #0d6efd; }}
</style></head>
<body>
    <h2>Monthly Activity Report - Dr. {escape(doctor.user.name)}</h2>
    <p>Period: {start.strftime('%B %d, %Y')} to {end.strftime('%B %d, %Y')}</p>
    <p>Total appointments: {len(appointments)} &middot; Completed: {completed} &middot; Cancelled: {cancelled}</p>
    <table>
        <tr><th>Date</th><th>Time</th><th>Patient</th><th>Status</th><th>Diagnosis</th><th>Prescription</th></tr>
        {''.join(rows) or '<tr><td colspan="6">No appointments this month.</td></tr>'}
    </table>
</body>
</html>"""


@celery.task(name='tasks.send_monthly_report')
def send_monthly_report():
    """Build last month's activity report for each active doctor, save it and email it."""
    end = date.today().replace(day=1) - timedelta(days=1)
    start = end.replace(day=1)
    folder = current_app.config['UPLOAD_FOLDER']
    os.makedirs(folder, exist_ok=True)

    doctors = Doctor.query.all()
    for doctor in doctors:
        if not doctor.user.is_active:
            continue
        report = build_monthly_report(doctor, start, end)
        path = os.path.join(folder, f"report_{doctor.id}_{start.strftime('%Y_%m')}.html")
        with open(path, 'w', encoding='utf-8') as f:
            f.write(report)
        send_email(
            doctor.user.email,
            f"Your activity report for {start.strftime('%B %Y')}",
            'Your monthly report is attached as HTML.',
            html=report,
        )
        log.info('Monthly report generated for Dr. %s', doctor.user.name)

    return f'Generated reports for {len(doctors)} doctors'


@celery.task(name='tasks.export_patient_csv')
def export_patient_csv(patient_id):
    """Export a patient's treatment history as CSV (triggered from the UI)."""
    filename = write_patient_csv(patient_id)
    return {'filename': filename} if filename else None
