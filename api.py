import os
import re
from datetime import datetime, date, timedelta
from functools import wraps

from flask import Blueprint, request, jsonify, send_from_directory, current_app, g
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from sqlalchemy.exc import IntegrityError

from extensions import cache
from exports import write_patient_csv, patient_id_from_export
from models import db, User, Doctor, Patient, Department, Appointment, Treatment, DoctorAvailability

api_bp = Blueprint('api', __name__)

STATUSES = ('Booked', 'Completed', 'Cancelled')
GENDERS = ('', 'Male', 'Female', 'Other')
BLOOD_GROUPS = ('', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')
EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
USERNAME_RE = re.compile(r'^[A-Za-z0-9_.-]{3,40}$')
TIME_RE = re.compile(r'^([01]\d|2[0-3]):[0-5]\d$')
AVAILABILITY_DAYS = 7
MIN_PASSWORD_LENGTH = 6


class ApiError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


@api_bp.errorhandler(ApiError)
def handle_api_error(e):
    db.session.rollback()
    return jsonify({'error': e.message}), e.status


# HELPERS

def get_body():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return {}
    return data


def text(data, key, max_len=255, required=False, label=None):
    value = data.get(key)
    value = '' if value is None else str(value).strip()
    label = label or key.replace('_', ' ').capitalize()
    if required and not value:
        raise ApiError(f'{label} is required')
    if len(value) > max_len:
        raise ApiError(f'{label} is too long (max {max_len} characters)')
    return value


def parse_date(value, label='Date'):
    if not value:
        raise ApiError(f'{label} is required')
    try:
        return datetime.strptime(str(value), '%Y-%m-%d').date()
    except ValueError:
        raise ApiError(f'{label} must be in YYYY-MM-DD format')


def parse_optional_date(value, label='Date'):
    return parse_date(value, label) if value else None


def parse_time(value, label='Time'):
    if not value:
        raise ApiError(f'{label} is required')
    value = str(value)[:5]
    if not TIME_RE.match(value):
        raise ApiError(f'{label} must be in HH:MM format')
    return value


def parse_number(value, label, cast=int, minimum=0):
    if value in (None, ''):
        return minimum
    try:
        number = cast(value)
    except (TypeError, ValueError):
        raise ApiError(f'{label} must be a number')
    if number < minimum:
        raise ApiError(f'{label} cannot be negative')
    return number


def parse_department(value):
    if value in (None, ''):
        return None
    try:
        dept = db.session.get(Department, int(value))
    except (TypeError, ValueError):
        dept = None
    if not dept:
        raise ApiError('Selected department does not exist')
    return dept.id


def validate_email(email):
    if not EMAIL_RE.match(email):
        raise ApiError('Please enter a valid email address')
    return email.lower()


def ensure_unique_user(username=None, email=None, exclude_user_id=None):
    if username:
        q = User.query.filter(db.func.lower(User.username) == username.lower())
        if exclude_user_id:
            q = q.filter(User.id != exclude_user_id)
        if q.first():
            raise ApiError('Username already taken', 409)
    if email:
        q = User.query.filter(db.func.lower(User.email) == email.lower())
        if exclude_user_id:
            q = q.filter(User.id != exclude_user_id)
        if q.first():
            raise ApiError('Email already registered', 409)


def commit():
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise ApiError('That conflicts with an existing record', 409)


def roles_required(*roles):
    """Require a valid token for an active user, optionally limited to some roles.

    The role is read from the database rather than the token, so deactivating a
    user takes effect immediately instead of when their token expires.
    """
    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            try:
                user = db.session.get(User, int(get_jwt_identity()))
            except (TypeError, ValueError):
                user = None
            if not user or not user.is_active:
                return jsonify({'error': 'Your account is inactive or no longer exists'}), 401
            if roles and user.role not in roles:
                return jsonify({'error': 'You do not have permission to do that'}), 403
            g.user = user
            return fn(*args, **kwargs)
        return wrapper
    return decorator


login_required = roles_required()


def get_or_404(model, obj_id, label):
    obj = db.session.get(model, obj_id)
    if not obj:
        raise ApiError(f'{label} not found', 404)
    return obj


def can_view_patient(user, patient):
    if user.role == 'admin':
        return True
    if user.role == 'patient':
        return patient.user_id == user.id
    if user.role == 'doctor' and user.doctor_profile:
        return Appointment.query.filter_by(
            patient_id=patient.id, doctor_id=user.doctor_profile.id
        ).first() is not None
    return False


def can_manage_appointment(user, appointment):
    if user.role == 'admin':
        return True
    if user.role == 'patient':
        return appointment.patient.user_id == user.id
    if user.role == 'doctor':
        return appointment.doctor.user_id == user.id
    return False


def doctor_is_available(doctor_id, day, time):
    return DoctorAvailability.query.filter(
        DoctorAvailability.doctor_id == doctor_id,
        DoctorAvailability.date == day,
        DoctorAvailability.is_available.is_(True),
        DoctorAvailability.start_time <= time,
        DoctorAvailability.end_time > time,
    ).first() is not None


def check_bookable(doctor, patient_id, day, time, exclude_id=None):
    """Raise ApiError if this doctor/patient/slot combination can't be booked."""
    if datetime.combine(day, datetime.strptime(time, '%H:%M').time()) < datetime.now():
        raise ApiError('You cannot book an appointment in the past')
    if not doctor.user.is_active:
        raise ApiError('This doctor is not currently taking appointments')
    if not doctor_is_available(doctor.id, day, time):
        raise ApiError(f'Dr. {doctor.user.name} is not available at that time. Please pick one of the available slots.')

    active = Appointment.query.filter(
        Appointment.date == day, Appointment.time == time, Appointment.status != 'Cancelled'
    )
    if exclude_id:
        active = active.filter(Appointment.id != exclude_id)
    if active.filter(Appointment.doctor_id == doctor.id).first():
        raise ApiError('This time slot is already booked for the selected doctor', 409)
    if active.filter(Appointment.patient_id == patient_id).first():
        raise ApiError('You already have another appointment at that time', 409)


def invalidate_patient(patient_id):
    cache.delete(f'patient_history_{patient_id}')
    cache.delete('admin_stats')


def invalidate_doctors():
    cache.delete('departments_list')
    cache.delete('admin_stats')
    # Doctor lists are cached per search/filter, so bump a version instead of tracking every key
    cache.set('doctors_version', (cache.get('doctors_version') or 0) + 1, timeout=0)


# AUTH ROUTES

@api_bp.route('/auth/login', methods=['POST'])
def login():
    data = get_body()
    username = text(data, 'username', required=True)
    password = data.get('password') or ''
    if not password:
        raise ApiError('Password is required')

    user = User.query.filter(db.func.lower(User.username) == username.lower()).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid username or password'}), 401
    if not user.is_active:
        return jsonify({'error': 'Your account has been deactivated. Please contact the hospital.'}), 403

    token = create_access_token(identity=str(user.id), additional_claims={'role': user.role, 'name': user.name})
    return jsonify({'token': token, 'user': user.to_dict()})


@api_bp.route('/auth/register', methods=['POST'])
def register():
    data = get_body()
    username = text(data, 'username', 40, required=True)
    email = validate_email(text(data, 'email', 120, required=True))
    password = data.get('password') or ''
    name = text(data, 'name', 120, required=True, label='Full name')
    phone = text(data, 'phone', 20)

    if not USERNAME_RE.match(username):
        raise ApiError('Username must be 3-40 characters: letters, numbers, dots, dashes or underscores')
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ApiError(f'Password must be at least {MIN_PASSWORD_LENGTH} characters')
    ensure_unique_user(username, email)

    patient_fields = _patient_fields(data)

    user = User(username=username, email=email, role='patient', name=name, phone=phone)
    user.set_password(password)
    db.session.add(user)
    db.session.flush()
    db.session.add(Patient(user_id=user.id, **patient_fields))
    commit()

    cache.delete('admin_stats')

    token = create_access_token(identity=str(user.id), additional_claims={'role': user.role, 'name': user.name})
    return jsonify({'token': token, 'user': user.to_dict()}), 201


def _patient_fields(data, partial=False):
    """Validate the patient-only profile fields. With partial=True only keys present in data are returned."""
    fields = {}
    if not partial or 'gender' in data:
        gender = text(data, 'gender', 10)
        if gender not in GENDERS:
            raise ApiError('Gender must be Male, Female or Other')
        fields['gender'] = gender
    if not partial or 'blood_group' in data:
        blood_group = text(data, 'blood_group', 5)
        if blood_group not in BLOOD_GROUPS:
            raise ApiError('Invalid blood group')
        fields['blood_group'] = blood_group
    if not partial or 'address' in data:
        fields['address'] = text(data, 'address', 500)
    if not partial or 'emergency_contact' in data:
        fields['emergency_contact'] = text(data, 'emergency_contact', 20)
    if not partial or 'date_of_birth' in data:
        dob = parse_optional_date(data.get('date_of_birth'), 'Date of birth')
        if dob and dob > date.today():
            raise ApiError('Date of birth cannot be in the future')
        fields['date_of_birth'] = dob
    return fields


def _apply_user_fields(user, data):
    if 'name' in data:
        user.name = text(data, 'name', 120, required=True, label='Full name')
    if 'email' in data:
        email = validate_email(text(data, 'email', 120, required=True))
        ensure_unique_user(email=email, exclude_user_id=user.id)
        user.email = email
    if 'phone' in data:
        user.phone = text(data, 'phone', 20)


def _user_payload(user):
    data = user.to_dict()
    if user.role == 'doctor' and user.doctor_profile:
        data['doctor'] = user.doctor_profile.to_dict()
    if user.role == 'patient' and user.patient_profile:
        data['patient'] = user.patient_profile.to_dict()
    return data


@api_bp.route('/auth/me', methods=['GET'])
@login_required
def get_current_user():
    return jsonify(_user_payload(g.user))


@api_bp.route('/auth/me', methods=['PUT'])
@login_required
def update_current_user():
    """Any user can update their own name/email/phone (and patients their medical profile)."""
    user = g.user
    data = get_body()
    _apply_user_fields(user, data)

    if data.get('new_password'):
        if not user.check_password(data.get('current_password') or ''):
            raise ApiError('Current password is incorrect', 403)
        if len(data['new_password']) < MIN_PASSWORD_LENGTH:
            raise ApiError(f'New password must be at least {MIN_PASSWORD_LENGTH} characters')
        user.set_password(data['new_password'])

    if user.role == 'patient' and user.patient_profile:
        for key, value in _patient_fields(data, partial=True).items():
            setattr(user.patient_profile, key, value)
        invalidate_patient(user.patient_profile.id)
    if user.role == 'doctor':
        invalidate_doctors()

    commit()
    return jsonify(_user_payload(user))


# DEPARTMENT ROUTES

@api_bp.route('/departments', methods=['GET'])
@login_required
def get_departments():
    cached = cache.get('departments_list')
    if cached is not None:
        return jsonify(cached)
    result = [d.to_dict() for d in Department.query.order_by(Department.name).all()]
    cache.set('departments_list', result, timeout=300)
    return jsonify(result)


@api_bp.route('/departments', methods=['POST'])
@roles_required('admin')
def create_department():
    data = get_body()
    name = text(data, 'name', 100, required=True)
    if Department.query.filter(db.func.lower(Department.name) == name.lower()).first():
        raise ApiError('A department with that name already exists', 409)
    dept = Department(name=name, description=text(data, 'description', 1000))
    db.session.add(dept)
    commit()
    cache.delete('departments_list')
    return jsonify(dept.to_dict()), 201


# ADMIN STATS

@api_bp.route('/admin/stats', methods=['GET'])
@roles_required('admin')
def get_stats():
    cached = cache.get('admin_stats')
    if cached is not None:
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


# DOCTORS

@api_bp.route('/doctors', methods=['GET'])
@login_required
def get_doctors():
    search = request.args.get('search', '').strip()
    dept_id = request.args.get('department_id', '').strip()
    if dept_id and not dept_id.isdigit():
        raise ApiError('department_id must be a number')

    # Admins also see deactivated doctors, so they get their own cache entry
    scope = 'all' if g.user.role == 'admin' else 'active'
    version = cache.get('doctors_version') or 0
    cache_key = f'doctors_v{version}_{scope}_{dept_id}_{search.lower()}'
    cached = cache.get(cache_key)
    if cached is not None:
        return jsonify(cached)

    query = Doctor.query.join(User)
    if search:
        query = query.filter(db.or_(
            User.name.ilike(f'%{search}%'),
            Doctor.specialization.ilike(f'%{search}%')
        ))
    if dept_id:
        query = query.filter(Doctor.department_id == int(dept_id))
    if scope == 'active':
        query = query.filter(User.is_active.is_(True))

    result = [d.to_dict() for d in query.order_by(User.name).all()]
    cache.set(cache_key, result, timeout=120)
    return jsonify(result)


@api_bp.route('/doctors/<int:doctor_id>', methods=['GET'])
@login_required
def get_doctor(doctor_id):
    doctor = get_or_404(Doctor, doctor_id, 'Doctor')
    if not doctor.user.is_active and g.user.role != 'admin':
        raise ApiError('Doctor not found', 404)
    return jsonify(doctor.to_dict())


def _doctor_fields(data, partial=False):
    fields = {}
    for key, max_len in (('specialization', 100), ('qualification', 200), ('bio', 2000), ('room', 20)):
        if not partial or key in data:
            fields[key] = text(data, key, max_len)
    if not partial or 'department_id' in data:
        fields['department_id'] = parse_department(data.get('department_id'))
    if not partial or 'experience_years' in data:
        fields['experience_years'] = parse_number(data.get('experience_years'), 'Experience', int)
    if not partial or 'consultation_fee' in data:
        fields['consultation_fee'] = parse_number(data.get('consultation_fee'), 'Consultation fee', float)
    return fields


@api_bp.route('/doctors', methods=['POST'])
@roles_required('admin')
def create_doctor():
    data = get_body()
    username = text(data, 'username', 40, required=True)
    email = validate_email(text(data, 'email', 120, required=True))
    password = data.get('password') or ''
    name = text(data, 'name', 120, required=True, label='Full name')

    if not USERNAME_RE.match(username):
        raise ApiError('Username must be 3-40 characters: letters, numbers, dots, dashes or underscores')
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ApiError(f'Password must be at least {MIN_PASSWORD_LENGTH} characters')
    ensure_unique_user(username, email)
    fields = _doctor_fields(data)

    user = User(username=username, email=email, role='doctor', name=name, phone=text(data, 'phone', 20))
    user.set_password(password)
    db.session.add(user)
    db.session.flush()
    doctor = Doctor(user_id=user.id, **fields)
    db.session.add(doctor)
    commit()

    invalidate_doctors()
    return jsonify(doctor.to_dict()), 201


@api_bp.route('/doctors/<int:doctor_id>', methods=['PUT'])
@roles_required('admin')
def update_doctor(doctor_id):
    doctor = get_or_404(Doctor, doctor_id, 'Doctor')
    data = get_body()
    _apply_user_fields(doctor.user, data)
    for key, value in _doctor_fields(data, partial=True).items():
        setattr(doctor, key, value)
    commit()
    invalidate_doctors()
    return jsonify(doctor.to_dict())


@api_bp.route('/doctors/<int:doctor_id>', methods=['DELETE'])
@roles_required('admin')
def delete_doctor(doctor_id):
    doctor = get_or_404(Doctor, doctor_id, 'Doctor')
    doctor.user.is_active = False
    commit()
    invalidate_doctors()
    return jsonify({'message': 'Doctor deactivated successfully'})


@api_bp.route('/doctors/<int:doctor_id>/activate', methods=['PUT'])
@roles_required('admin')
def activate_doctor(doctor_id):
    doctor = get_or_404(Doctor, doctor_id, 'Doctor')
    doctor.user.is_active = True
    commit()
    invalidate_doctors()
    return jsonify({'message': 'Doctor activated successfully'})


# DOCTOR AVAILABILITY

@api_bp.route('/doctors/<int:doctor_id>/availability', methods=['GET'])
@login_required
def get_doctor_availability(doctor_id):
    cache_key = f'availability_{doctor_id}_{date.today().isoformat()}'
    cached = cache.get(cache_key)
    if cached is not None:
        return jsonify(cached)

    today = date.today()
    avails = DoctorAvailability.query.filter(
        DoctorAvailability.doctor_id == doctor_id,
        DoctorAvailability.date >= today,
        DoctorAvailability.date <= today + timedelta(days=AVAILABILITY_DAYS),
        DoctorAvailability.is_available.is_(True)
    ).order_by(DoctorAvailability.date, DoctorAvailability.start_time).all()
    result = [a.to_dict() for a in avails]
    cache.set(cache_key, result, timeout=120)
    return jsonify(result)


def _check_availability_owner(doctor):
    if g.user.role == 'doctor' and doctor.user_id != g.user.id:
        raise ApiError('You can only manage your own availability', 403)


@api_bp.route('/doctors/<int:doctor_id>/availability', methods=['POST'])
@roles_required('doctor', 'admin')
def set_doctor_availability(doctor_id):
    doctor = get_or_404(Doctor, doctor_id, 'Doctor')
    _check_availability_owner(doctor)

    slots = get_body().get('slots')
    if not isinstance(slots, list) or not slots:
        raise ApiError('Please provide at least one slot')

    today = date.today()
    for slot in slots:
        if not isinstance(slot, dict):
            raise ApiError('Each slot must have a date, start time and end time')
        slot_date = parse_date(slot.get('date'))
        start = parse_time(slot.get('start_time'), 'Start time')
        end = parse_time(slot.get('end_time'), 'End time')
        is_available = bool(slot.get('is_available', True))

        if not today <= slot_date <= today + timedelta(days=AVAILABILITY_DAYS):
            raise ApiError(f'Availability can only be set for the next {AVAILABILITY_DAYS} days')
        if end <= start:
            raise ApiError('End time must be after start time')

        overlapping = DoctorAvailability.query.filter(
            DoctorAvailability.doctor_id == doctor_id,
            DoctorAvailability.date == slot_date,
            DoctorAvailability.is_available.is_(True),
            DoctorAvailability.start_time != start,
            DoctorAvailability.start_time < end,
            DoctorAvailability.end_time > start,
        ).first()
        if overlapping and is_available:
            raise ApiError(f'This overlaps your {overlapping.start_time}-{overlapping.end_time} slot on {slot_date}', 409)

        existing = DoctorAvailability.query.filter_by(doctor_id=doctor_id, date=slot_date, start_time=start).first()
        if existing:
            existing.end_time = end
            existing.is_available = is_available
        else:
            db.session.add(DoctorAvailability(
                doctor_id=doctor_id, date=slot_date, start_time=start, end_time=end, is_available=is_available
            ))

    commit()
    cache.delete(f'availability_{doctor_id}_{today.isoformat()}')
    return jsonify({'message': 'Availability updated'})


@api_bp.route('/doctors/<int:doctor_id>/availability/<int:slot_id>', methods=['DELETE'])
@roles_required('doctor', 'admin')
def delete_availability_slot(doctor_id, slot_id):
    doctor = get_or_404(Doctor, doctor_id, 'Doctor')
    _check_availability_owner(doctor)
    slot = DoctorAvailability.query.filter_by(id=slot_id, doctor_id=doctor_id).first()
    if not slot:
        raise ApiError('Slot not found', 404)
    db.session.delete(slot)
    commit()
    cache.delete(f'availability_{doctor_id}_{date.today().isoformat()}')
    return jsonify({'message': 'Slot removed'})


# PATIENTS

@api_bp.route('/patients', methods=['GET'])
@roles_required('admin', 'doctor')
def get_patients():
    search = request.args.get('search', '').strip()
    query = Patient.query.join(User)
    if g.user.role == 'doctor':
        # Doctors only see patients who have booked with them
        query = query.filter(Patient.id.in_(
            db.session.query(Appointment.patient_id).filter_by(doctor_id=g.user.doctor_profile.id)
        ))
    if search:
        query = query.filter(db.or_(
            User.name.ilike(f'%{search}%'),
            User.phone.ilike(f'%{search}%'),
            User.email.ilike(f'%{search}%')
        ))
    return jsonify([p.to_dict() for p in query.order_by(User.name).all()])


def _viewable_patient(patient_id):
    patient = get_or_404(Patient, patient_id, 'Patient')
    if not can_view_patient(g.user, patient):
        raise ApiError("You don't have access to this patient's records", 403)
    return patient


@api_bp.route('/patients/<int:patient_id>', methods=['GET'])
@login_required
def get_patient(patient_id):
    return jsonify(_viewable_patient(patient_id).to_dict())


@api_bp.route('/patients/<int:patient_id>', methods=['PUT'])
@roles_required('admin', 'patient')
def update_patient(patient_id):
    patient = get_or_404(Patient, patient_id, 'Patient')
    if g.user.role == 'patient' and patient.user_id != g.user.id:
        raise ApiError('You can only update your own profile', 403)

    data = get_body()
    _apply_user_fields(patient.user, data)
    for key, value in _patient_fields(data, partial=True).items():
        setattr(patient, key, value)
    commit()
    invalidate_patient(patient.id)
    return jsonify(patient.to_dict())


def _set_patient_active(patient_id, active):
    patient = get_or_404(Patient, patient_id, 'Patient')
    patient.user.is_active = active
    commit()
    invalidate_patient(patient.id)


@api_bp.route('/patients/<int:patient_id>/deactivate', methods=['PUT'])
@roles_required('admin')
def deactivate_patient(patient_id):
    _set_patient_active(patient_id, False)
    return jsonify({'message': 'Patient deactivated'})


@api_bp.route('/patients/<int:patient_id>/activate', methods=['PUT'])
@roles_required('admin')
def activate_patient(patient_id):
    _set_patient_active(patient_id, True)
    return jsonify({'message': 'Patient activated'})


# APPOINTMENTS

@api_bp.route('/appointments', methods=['GET'])
@login_required
def get_appointments():
    status = request.args.get('status', '')
    if status and status not in STATUSES:
        raise ApiError('Unknown status filter')

    query = Appointment.query
    if g.user.role == 'patient':
        query = query.filter_by(patient_id=g.user.patient_profile.id)
    elif g.user.role == 'doctor':
        query = query.filter_by(doctor_id=g.user.doctor_profile.id)
    if status:
        query = query.filter_by(status=status)

    appointments = query.order_by(Appointment.date.desc(), Appointment.time.desc()).all()
    return jsonify([a.to_dict() for a in appointments])


@api_bp.route('/appointments', methods=['POST'])
@roles_required('patient', 'admin')
def create_appointment():
    data = get_body()

    if g.user.role == 'patient':
        patient = g.user.patient_profile
    else:
        patient = get_or_404(Patient, parse_number(data.get('patient_id'), 'Patient'), 'Patient')
        if not patient.user.is_active:
            raise ApiError('This patient account is deactivated')

    doctor = get_or_404(Doctor, parse_number(data.get('doctor_id'), 'Doctor'), 'Doctor')
    appt_date = parse_date(data.get('date'))
    appt_time = parse_time(data.get('time'))
    check_bookable(doctor, patient.id, appt_date, appt_time)

    appointment = Appointment(
        patient_id=patient.id,
        doctor_id=doctor.id,
        date=appt_date,
        time=appt_time,
        status='Booked',
        reason=text(data, 'reason', 1000)
    )
    db.session.add(appointment)
    from api_live import assign_token
    assign_token(appointment)
    commit()

    invalidate_patient(patient.id)
    return jsonify(appointment.to_dict()), 201


def _managed_appointment(appt_id):
    appointment = get_or_404(Appointment, appt_id, 'Appointment')
    if not can_manage_appointment(g.user, appointment):
        raise ApiError("You don't have access to this appointment", 403)
    return appointment


@api_bp.route('/appointments/<int:appt_id>', methods=['PUT'])
@login_required
def update_appointment(appt_id):
    appointment = _managed_appointment(appt_id)
    data = get_body()

    if 'date' in data or 'time' in data:
        if appointment.status != 'Booked':
            raise ApiError(f'A {appointment.status.lower()} appointment cannot be rescheduled')
        new_date = parse_date(data.get('date'))
        new_time = parse_time(data.get('time'))
        check_bookable(appointment.doctor, appointment.patient_id, new_date, new_time, exclude_id=appointment.id)
        if new_date != appointment.date:
            from api_live import assign_token
            appointment.date = new_date
            assign_token(appointment)
        appointment.time = new_time
        appointment.called_at = None

    new_status = data.get('status')
    if new_status and new_status != appointment.status:
        if g.user.role == 'patient':
            raise ApiError('Patients can only reschedule or cancel appointments', 403)
        if new_status not in STATUSES:
            raise ApiError('Unknown status')
        if appointment.status != 'Booked':
            raise ApiError(f'This appointment is already {appointment.status.lower()}')
        appointment.status = new_status

    if 'notes' in data:
        if g.user.role == 'patient':
            raise ApiError('Only doctors can add notes', 403)
        appointment.notes = text(data, 'notes', 2000)

    commit()
    invalidate_patient(appointment.patient_id)
    return jsonify(appointment.to_dict())


@api_bp.route('/appointments/<int:appt_id>/cancel', methods=['PUT'])
@login_required
def cancel_appointment(appt_id):
    appointment = _managed_appointment(appt_id)
    if appointment.status != 'Booked':
        raise ApiError(f'This appointment is already {appointment.status.lower()}')
    appointment.status = 'Cancelled'
    commit()
    invalidate_patient(appointment.patient_id)
    return jsonify(appointment.to_dict())


# TREATMENTS

@api_bp.route('/appointments/<int:appt_id>/treatment', methods=['POST'])
@roles_required('doctor', 'admin')
def add_treatment(appt_id):
    appointment = _managed_appointment(appt_id)
    if appointment.status == 'Cancelled':
        raise ApiError('Cannot add a treatment to a cancelled appointment')

    data = get_body()
    diagnosis = text(data, 'diagnosis', 2000, required=True)
    prescription = text(data, 'prescription', 2000)
    notes = text(data, 'notes', 2000)
    next_visit = parse_optional_date(data.get('next_visit'), 'Next visit')
    if next_visit and next_visit < appointment.date:
        raise ApiError('Next visit must be after the appointment date')

    treatment = appointment.treatment
    if treatment:
        treatment.diagnosis = diagnosis
        treatment.prescription = prescription
        treatment.notes = notes
        treatment.next_visit = next_visit
    else:
        db.session.add(Treatment(
            appointment_id=appointment.id, diagnosis=diagnosis,
            prescription=prescription, notes=notes, next_visit=next_visit
        ))

    appointment.status = 'Completed'
    commit()
    invalidate_patient(appointment.patient_id)
    return jsonify(appointment.to_dict())


@api_bp.route('/patients/<int:patient_id>/history', methods=['GET'])
@login_required
def get_patient_history(patient_id):
    _viewable_patient(patient_id)

    cache_key = f'patient_history_{patient_id}'
    cached = cache.get(cache_key)
    if cached is not None:
        return jsonify(cached)

    appointments = Appointment.query.filter_by(patient_id=patient_id)\
        .order_by(Appointment.date.desc(), Appointment.time.desc()).all()
    result = [a.to_dict() for a in appointments]
    cache.set(cache_key, result, timeout=60)
    return jsonify(result)


# CSV EXPORT

@api_bp.route('/patients/<int:patient_id>/export', methods=['POST'])
@login_required
def export_patient_data(patient_id):
    """Start the export as a Celery job, or run it inline if no worker/broker is available."""
    _viewable_patient(patient_id)
    try:
        from tasks import export_patient_csv
        task = export_patient_csv.apply_async(args=[patient_id], retry=False)
        return jsonify({'task_id': task.id, 'message': 'Export started'}), 202
    except Exception:
        current_app.logger.warning('Celery unavailable, exporting patient %s synchronously', patient_id)
        return jsonify({'filename': write_patient_csv(patient_id), 'message': 'Export completed'})


@api_bp.route('/patients/<int:patient_id>/export/sync', methods=['POST'])
@login_required
def export_patient_data_sync(patient_id):
    _viewable_patient(patient_id)
    return jsonify({'filename': write_patient_csv(patient_id), 'message': 'Export completed'})


@api_bp.route('/tasks/<task_id>', methods=['GET'])
@login_required
def get_task_status(task_id):
    from celery_worker import celery
    result = celery.AsyncResult(task_id)
    if result.state == 'SUCCESS':
        payload = result.result or {}
        filename = payload.get('filename') if isinstance(payload, dict) else None
        patient_id = patient_id_from_export(filename or '')
        if patient_id is None:
            raise ApiError('Export failed', 500)
        _viewable_patient(patient_id)
        return jsonify({'state': 'SUCCESS', 'filename': filename})
    if result.state == 'FAILURE':
        return jsonify({'state': 'FAILURE', 'error': 'Export failed'})
    return jsonify({'state': result.state})


@api_bp.route('/download/<filename>', methods=['GET'])
@login_required
def download_file(filename):
    patient_id = patient_id_from_export(filename)
    if patient_id is None:
        raise ApiError('File not found', 404)
    _viewable_patient(patient_id)

    folder = current_app.config['UPLOAD_FOLDER']
    if not os.path.isfile(os.path.join(folder, filename)):
        raise ApiError('File not found', 404)
    return send_from_directory(folder, filename, as_attachment=True)


# SEARCH (admin)

@api_bp.route('/search', methods=['GET'])
@roles_required('admin')
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
        patients = Patient.query.join(User).filter(db.or_(
            User.name.ilike(f'%{q}%'),
            User.phone.ilike(f'%{q}%'),
            User.email.ilike(f'%{q}%')
        )).all()
        results['patients'] = [p.to_dict() for p in patients]

    if search_type in ('all', 'department'):
        depts = Department.query.filter(
            db.or_(Department.name.ilike(f'%{q}%'), Department.description.ilike(f'%{q}%'))
        ).all()
        results['departments'] = [d.to_dict() for d in depts]

    return jsonify(results)
