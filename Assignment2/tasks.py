import csv
import io
import os
from datetime import datetime, date, timedelta
from celery_worker import celery


@celery.task(name='tasks.send_daily_reminders')
def send_daily_reminders():
    """Send daily appointment reminders to patients."""
    from app import create_app
    from models import db, Appointment

    app = create_app()
    with app.app_context():
        today = date.today()
        appointments = Appointment.query.filter_by(date=today, status='Booked').all()
        reminders_sent = 0
        for appt in appointments:
            patient_name = appt.patient.user.name
            doctor_name = appt.doctor.user.name
            time = appt.time
            # Log the reminder (in production, send via email/Google Chat/SMS)
            print(f"REMINDER: {patient_name}, you have an appointment with Dr. {doctor_name} at {time} today.")
            reminders_sent += 1
        return f"Sent {reminders_sent} reminders for {today}"


@celery.task(name='tasks.send_monthly_report')
def send_monthly_report():
    """Generate and send monthly activity report for each doctor."""
    from app import create_app
    from models import db, Doctor, Appointment, Treatment

    app = create_app()
    with app.app_context():
        today = date.today()
        first_of_last_month = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
        last_of_last_month = today.replace(day=1) - timedelta(days=1)

        doctors = Doctor.query.all()
        for doctor in doctors:
            appointments = Appointment.query.filter(
                Appointment.doctor_id == doctor.id,
                Appointment.date >= first_of_last_month,
                Appointment.date <= last_of_last_month
            ).all()

            report_html = f"""
            <html>
            <head><style>
                body {{ font-family: Arial; padding: 20px; }}
                table {{ border-collapse: collapse; width: 100%; }}
                th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
                th {{ background-color: #0d6efd; color: white; }}
                h2 {{ color: #0d6efd; }}
            </style></head>
            <body>
                <h2>Monthly Activity Report - Dr. {doctor.user.name}</h2>
                <p>Period: {first_of_last_month.strftime('%B %d, %Y')} to {last_of_last_month.strftime('%B %d, %Y')}</p>
                <p>Total Appointments: {len(appointments)}</p>
                <p>Completed: {sum(1 for a in appointments if a.status == 'Completed')}</p>
                <p>Cancelled: {sum(1 for a in appointments if a.status == 'Cancelled')}</p>
                <table>
                    <tr><th>Date</th><th>Time</th><th>Patient</th><th>Status</th><th>Diagnosis</th><th>Treatment</th></tr>
            """
            for appt in appointments:
                diagnosis = appt.treatment.diagnosis if appt.treatment else '-'
                prescription = appt.treatment.prescription if appt.treatment else '-'
                report_html += f"""
                    <tr>
                        <td>{appt.date}</td><td>{appt.time}</td>
                        <td>{appt.patient.user.name}</td><td>{appt.status}</td>
                        <td>{diagnosis}</td><td>{prescription}</td>
                    </tr>"""
            report_html += "</table></body></html>"

            # Save report to uploads folder
            report_path = os.path.join(
                os.path.dirname(__file__), 'uploads',
                f"report_{doctor.id}_{first_of_last_month.strftime('%Y_%m')}.html"
            )
            with open(report_path, 'w') as f:
                f.write(report_html)

            print(f"Monthly report generated for Dr. {doctor.user.name}")

        return f"Generated reports for {len(doctors)} doctors"


@celery.task(name='tasks.export_patient_csv')
def export_patient_csv(patient_id):
    """Export treatment details for a patient as CSV."""
    from app import create_app
    from models import db, Patient, Appointment

    app = create_app()
    with app.app_context():
        patient = Patient.query.get(patient_id)
        if not patient:
            return None

        appointments = Appointment.query.filter_by(
            patient_id=patient_id
        ).order_by(Appointment.date.desc()).all()

        filename = f"treatment_export_patient_{patient_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        upload_dir = os.path.join(os.path.dirname(__file__), 'uploads')
        os.makedirs(upload_dir, exist_ok=True)

        filepath = os.path.join(upload_dir, filename)

        print(f"[EXPORT] Generating CSV for patient {patient_id}")
        print(f"[EXPORT] Total appointments: {len(appointments)}")

        with open(filepath, 'w', newline='') as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow([
                'Patient ID', 'Patient Name', 'Consulting Doctor', 'Department',
                'Appointment Date', 'Appointment Time', 'Status',
                'Diagnosis', 'Prescription', 'Notes', 'Next Visit'
            ])
            for appt in appointments:
                treatment = appt.treatment
                writer.writerow([
                    patient.id,
                    patient.user.name,
                    appt.doctor.user.name,
                    appt.doctor.specialization or '',
                    appt.date.isoformat() if appt.date else '',
                    appt.time,
                    appt.status,
                    treatment.diagnosis if treatment else '',
                    treatment.prescription if treatment else '',
                    treatment.notes if treatment else '',
                    treatment.next_visit.isoformat() if treatment and treatment.next_visit else ''
                ])

        return {'filename': filename, 'filepath': filepath}
    

__all__ = ['send_daily_reminders', 'send_monthly_report', 'export_patient_csv']
