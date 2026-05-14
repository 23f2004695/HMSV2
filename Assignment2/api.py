from flask import Blueprint, request, jsonify, send_from_directory, current_app
from flask_caching import Cache
from flask_jwt_extended import (
    create_access_token, jwt_required, get_jwt_identity, get_jwt
)
from models import db, User, Doctor, Patient, Department, Appointment, Treatment, DoctorAvailability
from datetime import datetime, date, timedelta
import os

api_bp = Blueprint('api', __name__)




cache = Cache()



# AUTH ROUTES

@api_bp.route('/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '')

    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid username or password'}), 401
    if not user.is_active:
        return jsonify({'error': 'Your account has been deactivated'}), 403

    token = create_access_token(
        identity=str(user.id),
        additional_claims={'role': user.role, 'name': user.name}
    )
    return jsonify({
        'token': token,
        'user': user.to_dict()
    })


@api_bp.route('/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')
    name = data.get('name', '').strip()
    phone = data.get('phone', '').strip()

    if not all([username, email, password, name]):
        return jsonify({'error': 'All fields are required'}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already taken'}), 409
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 409

    user = User(username=username, email=email, role='patient', name=name, phone=phone)
    user.set_password(password)
    db.session.add(user)
    db.session.flush()

    patient = Patient(
        user_id=user.id,
        gender=data.get('gender', ''),
        blood_group=data.get('blood_group', ''),
        address=data.get('address', ''),
        date_of_birth=datetime.strptime(data['date_of_birth'], '%Y-%m-%d').date() if data.get('date_of_birth') else None,
        emergency_contact=data.get('emergency_contact', '')
    )
    db.session.add(patient)
    db.session.commit()

    cache.delete('admin_stats')

    token = create_access_token(
        identity=str(user.id),
        additional_claims={'role': user.role, 'name': user.name}
    )
    return jsonify({'token': token, 'user': user.to_dict()}), 201


@api_bp.route('/auth/me', methods=['GET'])
@jwt_required()
def get_current_user():
    user = User.query.get(int(get_jwt_identity()))
    if not user:
        return jsonify({'error': 'User not found'}), 404
    data = user.to_dict()
    if user.role == 'doctor' and user.doctor_profile:
        data['doctor'] = user.doctor_profile.to_dict()
    if user.role == 'patient' and user.patient_profile:
        data['patient'] = user.patient_profile.to_dict()
    return jsonify(data)



# DEPARTMENT ROUTES

@api_bp.route('/departments', methods=['GET'])
@jwt_required()
def get_departments():
    
    cached = cache.get('departments_list')
    if cached:
        return jsonify(cached)
    departments = Department.query.all()
    result = [d.to_dict() for d in departments]
    cache.set('departments_list', result, timeout=300)
    return jsonify(result)


@api_bp.route('/departments', methods=['POST'])
@jwt_required()
def create_department():
    claims = get_jwt()
    if claims.get('role') != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    data = request.get_json()
    dept = Department(name=data['name'], description=data.get('description', ''))
    db.session.add(dept)
    db.session.commit()
    cache.delete('departments_list')
    return jsonify(dept.to_dict()), 201



# ADMIN STATS

@api_bp.route('/admin/stats', methods=['GET'])
@jwt_required()
def get_stats():
    claims = get_jwt()
    if claims.get('role') != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    
    cached = cache.get('admin_stats')
    if cached:
        return jsonify(cached)

    stats = {
        'total_doctors': Doctor.query.count(),
        'total_patients': Patient.query.count(),
        'total_appointments': Appointment.query.count(),
        'booked_appointments': Appointment.query.filter_by(status='Booked').count(),
        'completed_appointments': Appointment.query.filter_by(status='Completed').count(),
        'cancelled_appointments': Appointment.query.filter_by(status='Cancelled').count(),
    }
    cache.set('admin_stats', stats, timeout=60)
    return jsonify(stats)



# DOCTOR MANAGEMENT (Admin)

@api_bp.route('/doctors', methods=['GET'])
@jwt_required()
def get_doctors():
    
    search = request.args.get('search', '').strip()
    dept_id = request.args.get('department_id', '')

    cache_key = f'doctors_{search}_{dept_id}'
    cached = cache.get(cache_key)
    if cached:
        return jsonify(cached)

    query = Doctor.query.join(User)
    if search:
        query = query.filter(
            db.or_(
                User.name.ilike(f'%{search}%'),
                Doctor.specialization.ilike(f'%{search}%')
            )
        )
    if dept_id:
        query = query.filter(Doctor.department_id == int(dept_id))

    claims = get_jwt()
    # Admin sees all doctors (including deactivated); others see only active
    if claims.get('role') != 'admin':
        query = query.filter(User.is_active == True)
    doctors = query.all()
    result = [d.to_dict() for d in doctors]
    cache.set(cache_key, result, timeout=120)
    return jsonify(result)


@api_bp.route('/doctors/<int:doctor_id>', methods=['GET'])
@jwt_required()
def get_doctor(doctor_id):
    doctor = Doctor.query.get_or_404(doctor_id)
    return jsonify(doctor.to_dict())


@api_bp.route('/doctors', methods=['POST'])
@jwt_required()
def create_doctor():
    claims = get_jwt()
    if claims.get('role') != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')
    name = data.get('name', '').strip()

    if not all([username, email, password, name]):
        return jsonify({'error': 'All fields are required'}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already taken'}), 409
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 409

    user = User(username=username, email=email, role='doctor', name=name, phone=data.get('phone', ''))
    user.set_password(password)
    db.session.add(user)
    db.session.flush()

    doctor = Doctor(
        user_id=user.id,
        department_id=data.get('department_id'),
        specialization=data.get('specialization', ''),
        qualification=data.get('qualification', ''),
        experience_years=data.get('experience_years', 0),
        consultation_fee=data.get('consultation_fee', 0),
        bio=data.get('bio', '')
    )
    db.session.add(doctor)
    db.session.commit()

    _invalidate_doctor_caches()
    return jsonify(doctor.to_dict()), 201


@api_bp.route('/doctors/<int:doctor_id>', methods=['PUT'])
@jwt_required()
def update_doctor(doctor_id):
    claims = get_jwt()
    if claims.get('role') != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    doctor = Doctor.query.get_or_404(doctor_id)
    data = request.get_json()

    if 'name' in data:
        doctor.user.name = data['name']
    if 'email' in data:
        doctor.user.email = data['email']
    if 'phone' in data:
        doctor.user.phone = data['phone']
    if 'department_id' in data:
        doctor.department_id = data['department_id']
    if 'specialization' in data:
        doctor.specialization = data['specialization']
    if 'qualification' in data:
        doctor.qualification = data['qualification']
    if 'experience_years' in data:
        doctor.experience_years = data['experience_years']
    if 'consultation_fee' in data:
        doctor.consultation_fee = data['consultation_fee']
    if 'bio' in data:
        doctor.bio = data['bio']

    db.session.commit()
    _invalidate_doctor_caches()
    return jsonify(doctor.to_dict())


@api_bp.route('/doctors/<int:doctor_id>', methods=['DELETE'])
@jwt_required()
def delete_doctor(doctor_id):
    claims = get_jwt()
    if claims.get('role') != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    doctor = Doctor.query.get_or_404(doctor_id)
    doctor.user.is_active = False
    db.session.commit()
    _invalidate_doctor_caches()
    return jsonify({'message': 'Doctor deactivated successfully'})


@api_bp.route('/doctors/<int:doctor_id>/activate', methods=['PUT'])
@jwt_required()
def activate_doctor(doctor_id):
    claims = get_jwt()
    if claims.get('role') != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    doctor = Doctor.query.get_or_404(doctor_id)
    doctor.user.is_active = True
    db.session.commit()
    _invalidate_doctor_caches()
    return jsonify({'message': 'Doctor activated successfully'})



# DOCTOR AVAILABILITY

@api_bp.route('/doctors/<int:doctor_id>/availability', methods=['GET'])
@jwt_required()
def get_doctor_availability(doctor_id):
    
    cache_key = f'availability_{doctor_id}'
    cached = cache.get(cache_key)
    if cached:
        return jsonify(cached)

    today = date.today()
    week_later = today + timedelta(days=7)
    avails = DoctorAvailability.query.filter(
        DoctorAvailability.doctor_id == doctor_id,
        DoctorAvailability.date >= today,
        DoctorAvailability.date <= week_later,
        DoctorAvailability.is_available == True
    ).order_by(DoctorAvailability.date, DoctorAvailability.start_time).all()
    result = [a.to_dict() for a in avails]
    cache.set(cache_key, result, timeout=120)
    return jsonify(result)


@api_bp.route('/doctors/<int:doctor_id>/availability', methods=['POST'])
@jwt_required()
def set_doctor_availability(doctor_id):
    claims = get_jwt()
    user_id = int(get_jwt_identity())
    doctor = Doctor.query.get_or_404(doctor_id)

    if claims.get('role') == 'doctor' and doctor.user_id != user_id:
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json()
    slots = data.get('slots', [])

    for slot in slots:
        slot_date = datetime.strptime(slot['date'], '%Y-%m-%d').date()
        existing = DoctorAvailability.query.filter_by(
            doctor_id=doctor_id, date=slot_date, start_time=slot['start_time']
        ).first()
        if existing:
            existing.end_time = slot['end_time']
            existing.is_available = slot.get('is_available', True)
        else:
            avail = DoctorAvailability(
                doctor_id=doctor_id,
                date=slot_date,
                start_time=slot['start_time'],
                end_time=slot['end_time'],
                is_available=slot.get('is_available', True)
            )
            db.session.add(avail)

    db.session.commit()
    cache.delete(f'availability_{doctor_id}')
    return jsonify({'message': 'Availability updated'}), 200



# PATIENT MANAGEMENT

@api_bp.route('/patients', methods=['GET'])
@jwt_required()
def get_patients():
    claims = get_jwt()
    if claims.get('role') not in ('admin', 'doctor'):
        return jsonify({'error': 'Unauthorized'}), 403

    search = request.args.get('search', '').strip()
    query = Patient.query.join(User)
    if search:
        query = query.filter(
            db.or_(
                User.name.ilike(f'%{search}%'),
                User.phone.ilike(f'%{search}%'),
                User.email.ilike(f'%{search}%')
            )
        )
    patients = query.all()
    return jsonify([p.to_dict() for p in patients])


@api_bp.route('/patients/<int:patient_id>', methods=['GET'])
@jwt_required()
def get_patient(patient_id):
    patient = Patient.query.get_or_404(patient_id)
    return jsonify(patient.to_dict())


@api_bp.route('/patients/<int:patient_id>', methods=['PUT'])
@jwt_required()
def update_patient(patient_id):
    user_id = int(get_jwt_identity())
    claims = get_jwt()
    patient = Patient.query.get_or_404(patient_id)

    if claims.get('role') == 'patient' and patient.user_id != user_id:
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json()
    if 'name' in data:
        patient.user.name = data['name']
    if 'email' in data:
        patient.user.email = data['email']
    if 'phone' in data:
        patient.user.phone = data['phone']
    if 'gender' in data:
        patient.gender = data['gender']
    if 'blood_group' in data:
        patient.blood_group = data['blood_group']
    if 'address' in data:
        patient.address = data['address']
    if 'date_of_birth' in data and data['date_of_birth']:
        patient.date_of_birth = datetime.strptime(data['date_of_birth'], '%Y-%m-%d').date()
    if 'emergency_contact' in data:
        patient.emergency_contact = data['emergency_contact']

    db.session.commit()
    return jsonify(patient.to_dict())


@api_bp.route('/patients/<int:patient_id>/deactivate', methods=['PUT'])
@jwt_required()
def deactivate_patient(patient_id):
    claims = get_jwt()
    if claims.get('role') != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    patient = Patient.query.get_or_404(patient_id)
    patient.user.is_active = False
    db.session.commit()
    return jsonify({'message': 'Patient deactivated'})


@api_bp.route('/patients/<int:patient_id>/activate', methods=['PUT'])
@jwt_required()
def activate_patient(patient_id):
    claims = get_jwt()
    if claims.get('role') != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    patient = Patient.query.get_or_404(patient_id)
    patient.user.is_active = True
    db.session.commit()
    return jsonify({'message': 'Patient activated'})



# APPOINTMENT ROUTES

@api_bp.route('/appointments', methods=['GET'])
@jwt_required()
def get_appointments():
    user_id = int(get_jwt_identity())
    claims = get_jwt()
    role = claims.get('role')
    status = request.args.get('status', '')

    query = Appointment.query

    if role == 'patient':
        patient = Patient.query.filter_by(user_id=user_id).first()
        if not patient:
            return jsonify([])
        query = query.filter_by(patient_id=patient.id)
    elif role == 'doctor':
        doctor = Doctor.query.filter_by(user_id=user_id).first()
        if not doctor:
            return jsonify([])
        query = query.filter_by(doctor_id=doctor.id)

    if status:
        query = query.filter_by(status=status)

    appointments = query.order_by(Appointment.date.desc(), Appointment.time.desc()).all()
    return jsonify([a.to_dict() for a in appointments])


@api_bp.route('/appointments', methods=['POST'])
@jwt_required()
def create_appointment():
    user_id = int(get_jwt_identity())
    claims = get_jwt()
    data = request.get_json()

    if claims.get('role') == 'patient':
        patient = Patient.query.filter_by(user_id=user_id).first()
        if not patient:
            return jsonify({'error': 'Patient profile not found'}), 404
        patient_id = patient.id
    else:
        patient_id = data.get('patient_id')

    doctor_id = data.get('doctor_id')
    appt_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
    appt_time = data['time']

    # Check  (same doctor, same date, same time)
    conflict = Appointment.query.filter_by(
        doctor_id=doctor_id, date=appt_date, time=appt_time
    ).filter(Appointment.status != 'Cancelled').first()

    if conflict:
        return jsonify({'error': 'This time slot is already booked for the selected doctor'}), 409

    appointment = Appointment(
        patient_id=patient_id,
        doctor_id=doctor_id,
        date=appt_date,
        time=appt_time,
        status='Booked',
        reason=data.get('reason', '')
    )
    db.session.add(appointment)
    db.session.commit()

    _invalidate_appointment_caches()
    return jsonify(appointment.to_dict()), 201


@api_bp.route('/appointments/<int:appt_id>', methods=['PUT'])
@jwt_required()
def update_appointment(appt_id):
    claims = get_jwt()
    appointment = Appointment.query.get_or_404(appt_id)
    data = request.get_json()

    new_status = data.get('status')
    if new_status:
        appointment.status = new_status

    if 'notes' in data:
        appointment.notes = data['notes']

    # Allow rescheduling
    if 'date' in data and 'time' in data:
        new_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        new_time = data['time']
        conflict = Appointment.query.filter_by(
            doctor_id=appointment.doctor_id, date=new_date, time=new_time
        ).filter(Appointment.status != 'Cancelled', Appointment.id != appt_id).first()
        if conflict:
            return jsonify({'error': 'This time slot is already booked'}), 409
        appointment.date = new_date
        appointment.time = new_time

    db.session.commit()
    _invalidate_appointment_caches()
    return jsonify(appointment.to_dict())


@api_bp.route('/appointments/<int:appt_id>/cancel', methods=['PUT'])
@jwt_required()
def cancel_appointment(appt_id):
    appointment = Appointment.query.get_or_404(appt_id)
    if appointment.status == 'Cancelled':
        return jsonify({'error': 'Already cancelled'}), 400
    appointment.status = 'Cancelled'
    db.session.commit()
    _invalidate_appointment_caches()
    return jsonify(appointment.to_dict())



# TREATMENT ROUTES

@api_bp.route('/appointments/<int:appt_id>/treatment', methods=['POST'])
@jwt_required()
def add_treatment(appt_id):
    claims = get_jwt()
    if claims.get('role') not in ('doctor', 'admin'):
        return jsonify({'error': 'Unauthorized'}), 403

    appointment = Appointment.query.get_or_404(appt_id)
    data = request.get_json()

    if appointment.treatment:
        appointment.treatment.diagnosis = data.get('diagnosis', appointment.treatment.diagnosis)
        appointment.treatment.prescription = data.get('prescription', appointment.treatment.prescription)
        appointment.treatment.notes = data.get('notes', appointment.treatment.notes)
        if data.get('next_visit'):
            appointment.treatment.next_visit = datetime.strptime(data['next_visit'], '%Y-%m-%d').date()
    else:
        treatment = Treatment(
            appointment_id=appt_id,
            diagnosis=data.get('diagnosis', ''),
            prescription=data.get('prescription', ''),
            notes=data.get('notes', ''),
            next_visit=datetime.strptime(data['next_visit'], '%Y-%m-%d').date() if data.get('next_visit') else None
        )
        db.session.add(treatment)

    appointment.status = 'Completed'
    db.session.commit()
    return jsonify(appointment.to_dict())


@api_bp.route('/patients/<int:patient_id>/history', methods=['GET'])
@jwt_required()
def get_patient_history(patient_id):
    
    cache_key = f'patient_history_{patient_id}'
    cached = cache.get(cache_key)
    if cached:
        return jsonify(cached)

    appointments = Appointment.query.filter_by(patient_id=patient_id)\
        .order_by(Appointment.date.desc()).all()
    result = [a.to_dict() for a in appointments]
    cache.set(cache_key, result, timeout=60)
    return jsonify(result)



# CSV EXPORT 

@api_bp.route('/patients/<int:patient_id>/export', methods=['POST'])
@jwt_required()
def export_patient_data(patient_id):
    try:
        from tasks import export_patient_csv
        task = export_patient_csv.delay(patient_id)
        return jsonify({'task_id': task.id, 'message': 'Export started. You will be notified when ready.'})
    except Exception:
        # Fallback: do synchronous export if Celery is not available
        return _sync_export(patient_id)


@api_bp.route('/patients/<int:patient_id>/export/sync', methods=['POST'])
@jwt_required()
def export_patient_data_sync(patient_id):
    return _sync_export(patient_id)


def _sync_export(patient_id):
    import csv
    patient = Patient.query.get_or_404(patient_id)
    appointments = Appointment.query.filter_by(patient_id=patient_id)\
        .order_by(Appointment.date.desc()).all()

    filename = f"treatment_export_patient_{patient_id}.csv"
    filepath = os.path.join(current_app.config.get('UPLOAD_FOLDER', 'uploads'), filename)

    with open(filepath, 'w', newline='') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow([
            'Patient ID', 'Patient Name', 'Consulting Doctor', 'Department',
            'Appointment Date', 'Time', 'Status', 'Diagnosis', 'Prescription', 'Notes', 'Next Visit'
        ])
        for appt in appointments:
            t = appt.treatment
            writer.writerow([
                patient.id, patient.user.name, appt.doctor.user.name,
                appt.doctor.specialization or '', appt.date.isoformat(), appt.time,
                appt.status, t.diagnosis if t else '', t.prescription if t else '',
                t.notes if t else '', t.next_visit.isoformat() if t and t.next_visit else ''
            ])

    return jsonify({'filename': filename, 'message': 'Export completed'})


@api_bp.route('/download/<filename>', methods=['GET'])
def download_file(filename):
    upload_folder = current_app.config.get('UPLOAD_FOLDER', 'uploads')
    return send_from_directory(upload_folder, filename, as_attachment=True)



# SEARCH

@api_bp.route('/search', methods=['GET'])
@jwt_required()
def search():
    q = request.args.get('q', '').strip()
    search_type = request.args.get('type', 'all')

    results = {'doctors': [], 'patients': [], 'departments': []}

    if search_type in ('all', 'doctor'):
        doctors = Doctor.query.join(User).filter(
            db.or_(User.name.ilike(f'%{q}%'), Doctor.specialization.ilike(f'%{q}%'))
        ).all()
        results['doctors'] = [d.to_dict() for d in doctors]

    if search_type in ('all', 'patient'):
        patients = Patient.query.join(User).filter(
            db.or_(
                User.name.ilike(f'%{q}%'),
                User.phone.ilike(f'%{q}%'),
                User.email.ilike(f'%{q}%')
            )
        ).all()
        results['patients'] = [p.to_dict() for p in patients]

    if search_type in ('all', 'department'):
        depts = Department.query.filter(
            db.or_(Department.name.ilike(f'%{q}%'), Department.description.ilike(f'%{q}%'))
        ).all()
        results['departments'] = [d.to_dict() for d in depts]

    return jsonify(results)



# CACHE INVALIDATION HELPERS

def _invalidate_doctor_caches():
    cache.delete('departments_list')
    cache.delete('admin_stats')
    cache.clear()


def _invalidate_appointment_caches():
    cache.delete('admin_stats')
