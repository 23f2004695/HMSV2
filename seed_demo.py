"""Fill the database with demo doctors, patients, availability and appointments.

    python seed_demo.py

Every demo account uses the password "demo123". Safe to run more than once.
"""
from datetime import date, datetime, timedelta

from api_live import assign_token
from app import create_app
from models import db, User, Doctor, Patient, Department, DoctorAvailability, Appointment, Treatment

PASSWORD = 'demo123'

DOCTORS = [
    # username, name, department, specialization, qualification, years, fee, room
    ('dr.mehta', 'Anika Mehta', 'Cardiology', 'Interventional Cardiology', 'MBBS, MD, DM (Cardiology)', 12, 900, 'Room 12'),
    ('dr.sharma', 'Rohan Sharma', 'Orthopedics', 'Sports Injuries', 'MBBS, MS (Ortho)', 8, 700, 'Room 7'),
    ('dr.iyer', 'Kavya Iyer', 'Pediatrics', 'Child Development', 'MBBS, DCH', 6, 500, 'Room 3'),
    ('dr.khan', 'Imran Khan', 'Dermatology', 'Clinical Dermatology', 'MBBS, MD (Dermatology)', 10, 600, 'Room 9'),
    ('dr.gill', 'Harpreet Gill', 'General Medicine', 'Family Medicine', 'MBBS, MD (Medicine)', 15, 400, 'Room 1'),
    ('dr.nair', 'Arjun Nair', 'Neurology', 'Headache & Epilepsy', 'MBBS, DM (Neurology)', 9, 1000, 'Room 15'),
]

PATIENTS = [
    # username, name, gender, blood group, date of birth
    ('rahul', 'Rahul Verma', 'Male', 'B+', date(1994, 3, 12)),
    ('sneha', 'Sneha Kapoor', 'Female', 'O+', date(1999, 7, 25)),
    ('amit', 'Amit Joshi', 'Male', 'A-', date(1987, 11, 2)),
    ('priya', 'Priya Das', 'Female', 'AB+', date(2001, 1, 18)),
    ('kiran', 'Kiran Rao', 'Male', 'O-', date(1979, 5, 30)),
    ('meera', 'Meera Pillai', 'Female', 'B-', date(1990, 9, 14)),
    ('vikram', 'Vikram Sethi', 'Male', 'A+', date(1968, 12, 3)),
    ('ananya', 'Ananya Bose', 'Female', 'O+', date(2004, 4, 22)),
]

# Today's clinic queue, so the tickets and the lobby screen have something to show.
# (patient, doctor, time, already called in?)
TODAY_QUEUE = [
    ('kiran', 'dr.mehta', '09:30', True),
    ('rahul', 'dr.mehta', '10:00', False),
    ('meera', 'dr.mehta', '10:30', False),
    ('vikram', 'dr.mehta', '11:00', False),
    ('ananya', 'dr.sharma', '09:00', True),
    ('amit', 'dr.sharma', '09:30', False),
    ('sneha', 'dr.iyer', '11:30', False),
    ('priya', 'dr.gill', '10:00', True),
]

PAST_VISITS = [
    # patient, doctor, days ago, diagnosis, prescription
    ('rahul', 'dr.gill', 20, 'Viral fever', 'Paracetamol 650mg twice a day for 3 days, plenty of fluids'),
    ('rahul', 'dr.mehta', 9, 'Mild hypertension', 'Amlodipine 5mg once daily, reduce salt intake'),
    ('sneha', 'dr.khan', 14, 'Contact dermatitis', 'Hydrocortisone cream 1% twice daily for a week'),
    ('amit', 'dr.sharma', 6, 'Grade 1 ankle sprain', 'Rest, ice, compression. Ibuprofen 400mg if needed'),
    ('priya', 'dr.nair', 3, 'Tension-type headache', 'Regular sleep, screen breaks, Naproxen 250mg if needed'),
]

UPCOMING = [
    # patient, doctor, days ahead, time, reason
    ('rahul', 'dr.mehta', 1, '10:00', 'Blood pressure follow-up'),
    ('sneha', 'dr.iyer', 2, '11:30', "Vaccination schedule for my nephew"),
    ('amit', 'dr.sharma', 3, '15:00', 'Ankle still swells after running'),
    ('priya', 'dr.gill', 1, '16:30', 'Annual check-up'),
]


def get_or_create_user(username, name, role):
    user = User.query.filter_by(username=username).first()
    if user:
        return user, False
    phone = '98' + str(sum(ord(c) * 7919 for c in username) % 10**8).zfill(8)
    user = User(username=username, email=f'{username}@example.com', role=role, name=name, phone=phone)
    user.set_password(PASSWORD)
    db.session.add(user)
    db.session.flush()
    return user, True


def seed():
    today = date.today()
    doctors = {}
    for username, name, dept_name, spec, qual, years, fee, room in DOCTORS:
        user, created = get_or_create_user(username, name, 'doctor')
        if created:
            dept = Department.query.filter_by(name=dept_name).first()
            db.session.add(Doctor(user_id=user.id, department_id=dept.id if dept else None, specialization=spec,
                                  qualification=qual, experience_years=years, consultation_fee=fee, room=room,
                                  bio=f'{years} years of experience in {spec.lower()}.'))
            db.session.flush()
        doctors[username] = user.doctor_profile

    patients = {}
    for username, name, gender, blood, dob in PATIENTS:
        user, created = get_or_create_user(username, name, 'patient')
        if created:
            db.session.add(Patient(user_id=user.id, gender=gender, blood_group=blood, date_of_birth=dob,
                                   address='Chennai, Tamil Nadu'))
            db.session.flush()
        patients[username] = user.patient_profile

    # Morning and afternoon clinics for the next week
    for doctor in doctors.values():
        for offset in range(0, 8):
            day = today + timedelta(days=offset)
            for start, end in (('09:00', '13:00'), ('14:00', '18:00')):
                if not DoctorAvailability.query.filter_by(doctor_id=doctor.id, date=day, start_time=start).first():
                    db.session.add(DoctorAvailability(doctor_id=doctor.id, date=day, start_time=start, end_time=end))

    for p, d, days_ago, diagnosis, prescription in PAST_VISITS:
        day = today - timedelta(days=days_ago)
        if Appointment.query.filter_by(patient_id=patients[p].id, doctor_id=doctors[d].id, date=day).first():
            continue
        appt = Appointment(patient_id=patients[p].id, doctor_id=doctors[d].id, date=day, time='10:30',
                           status='Completed', reason='Consultation')
        db.session.add(appt)
        db.session.flush()
        assign_token(appt)
        db.session.add(Treatment(appointment_id=appt.id, diagnosis=diagnosis, prescription=prescription,
                                 notes='Patient advised to return if symptoms persist.'))

    for p, d, days_ahead, time, reason in UPCOMING:
        day = today + timedelta(days=days_ahead)
        if not Appointment.query.filter_by(doctor_id=doctors[d].id, date=day, time=time).first():
            appt = Appointment(patient_id=patients[p].id, doctor_id=doctors[d].id, date=day,
                               time=time, status='Booked', reason=reason)
            db.session.add(appt)
            db.session.flush()
            assign_token(appt)

    called_at = datetime.now() - timedelta(minutes=len(TODAY_QUEUE))
    for p, d, time, called in TODAY_QUEUE:
        if Appointment.query.filter_by(doctor_id=doctors[d].id, date=today, time=time).first():
            continue
        appt = Appointment(patient_id=patients[p].id, doctor_id=doctors[d].id, date=today, time=time,
                           status='Booked', reason='Consultation')
        db.session.add(appt)
        db.session.flush()
        assign_token(appt)
        if called:
            called_at += timedelta(minutes=1)
            appt.called_at = called_at

    db.session.commit()
    print(f'Demo data ready. Log in as any doctor or patient below with password "{PASSWORD}":')
    print('  doctors :', ', '.join(doctors))
    print('  patients:', ', '.join(patients))


if __name__ == '__main__':
    with create_app().app_context():
        seed()
