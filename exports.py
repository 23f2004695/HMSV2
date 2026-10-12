import csv
import os
import re
from datetime import datetime

from flask import current_app

from models import db, Appointment, Patient

EXPORT_NAME = re.compile(r'^treatment_export_patient_(\d+)_\d{8}_\d{6}\.csv$')

CSV_HEADER = [
    'Patient ID', 'Patient Name', 'Consulting Doctor', 'Department', 'Specialization',
    'Appointment Date', 'Appointment Time', 'Status',
    'Diagnosis', 'Prescription', 'Notes', 'Next Visit'
]


def write_patient_csv(patient_id):
    """Write a patient's full treatment history to a CSV in the upload folder and return its filename."""
    patient = db.session.get(Patient, patient_id)
    if not patient:
        return None

    appointments = Appointment.query.filter_by(patient_id=patient_id)\
        .order_by(Appointment.date.desc(), Appointment.time.desc()).all()

    filename = f"treatment_export_patient_{patient_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    folder = current_app.config['UPLOAD_FOLDER']
    os.makedirs(folder, exist_ok=True)

    with open(os.path.join(folder, filename), 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(CSV_HEADER)
        for appt in appointments:
            t = appt.treatment
            writer.writerow([
                patient.id,
                patient.user.name,
                appt.doctor.user.name,
                appt.doctor.department.name if appt.doctor.department else '',
                appt.doctor.specialization or '',
                appt.date.isoformat(),
                appt.time,
                appt.status,
                t.diagnosis if t else '',
                t.prescription if t else '',
                t.notes if t else '',
                t.next_visit.isoformat() if t and t.next_visit else ''
            ])

    return filename


def patient_id_from_export(filename):
    match = EXPORT_NAME.match(filename)
    return int(match.group(1)) if match else None
