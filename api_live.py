"""Queue tokens, the lobby screen, slot heatmaps and weekly availability painting."""
from datetime import date, datetime, timedelta

from flask import g, jsonify

from api import (api_bp, ApiError, get_body, get_or_404, parse_date, parse_time, roles_required,
                 login_required, can_manage_appointment, commit, AVAILABILITY_DAYS)
from extensions import cache
from models import db, Appointment, Doctor, DoctorAvailability, User

SLOT_MINUTES = 30
AVG_CONSULT_MINUTES = 15


# HELPERS

def _minutes(hhmm):
    h, m = hhmm.split(':')
    return int(h) * 60 + int(m)


def _hhmm(minutes):
    return f'{minutes // 60:02d}:{minutes % 60:02d}'


def assign_token(appointment):
    """Give the appointment a queue number like C-04: department letter + order of booking that day."""
    doctor = appointment.doctor or db.session.get(Doctor, appointment.doctor_id)
    prefix = (doctor.department.name[0] if doctor.department else 'G').upper()
    taken = Appointment.query.filter(
        Appointment.doctor_id == appointment.doctor_id,
        Appointment.date == appointment.date,
        Appointment.id != appointment.id,
        Appointment.token.isnot(None),
    ).count()
    appointment.token = f'{prefix}-{taken + 1:02d}'


def free_slots(doctor_id, day, now=None):
    """30-minute start times inside the doctor's availability that aren't booked or already past."""
    now = now or datetime.now()
    windows = DoctorAvailability.query.filter_by(doctor_id=doctor_id, date=day, is_available=True)\
        .order_by(DoctorAvailability.start_time).all()
    booked = {a.time for a in Appointment.query.filter(
        Appointment.doctor_id == doctor_id, Appointment.date == day, Appointment.status != 'Cancelled')}

    slots = []
    for w in windows:
        t, end = _minutes(w.start_time), _minutes(w.end_time)
        while t + SLOT_MINUTES <= end:
            label = _hhmm(t)
            starts = datetime.combine(day, datetime.strptime(label, '%H:%M').time())
            if label not in booked and starts > now:
                slots.append(label)
            t += SLOT_MINUTES
    return slots, [[w.start_time, w.end_time] for w in windows]


def _room_number(room):
    digits = ''.join(ch for ch in room if ch.isdigit())
    return (int(digits) if digits else 0, room)


def _clear_availability_cache(doctor_id):
    cache.delete(f'availability_{doctor_id}_{date.today().isoformat()}')


# SLOTS HEATMAP

@api_bp.route('/doctors/<int:doctor_id>/slots', methods=['GET'])
@login_required
def get_free_slots(doctor_id):
    doctor = get_or_404(Doctor, doctor_id, 'Doctor')
    today = date.today()
    days = []
    for offset in range(AVAILABILITY_DAYS + 1):
        day = today + timedelta(days=offset)
        slots, windows = free_slots(doctor.id, day)
        days.append({'date': day.isoformat(), 'slots': slots, 'windows': windows})
    return jsonify({'doctor': doctor.to_dict(), 'slot_minutes': SLOT_MINUTES, 'days': days})


# PAINT YOUR WEEK

def _merge(ranges):
    merged = []
    for start, end in sorted(ranges):
        if merged and start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return merged


@api_bp.route('/doctors/<int:doctor_id>/availability/week', methods=['PUT'])
@roles_required('doctor', 'admin')
def paint_week(doctor_id):
    """Replace whole days of availability at once: {"days": {"2026-10-14": [["09:00", "13:00"], ...]}}"""
    doctor = get_or_404(Doctor, doctor_id, 'Doctor')
    if g.user.role == 'doctor' and doctor.user_id != g.user.id:
        raise ApiError('You can only manage your own availability', 403)

    days = get_body().get('days')
    if not isinstance(days, dict) or not days:
        raise ApiError('Nothing to save')

    today = date.today()
    plan = {}
    for raw_day, ranges in days.items():
        day = parse_date(raw_day)
        if not today <= day <= today + timedelta(days=AVAILABILITY_DAYS):
            raise ApiError(f'Availability can only be set for the next {AVAILABILITY_DAYS} days')
        if not isinstance(ranges, list):
            raise ApiError('Each day needs a list of time ranges')
        cleaned = []
        for pair in ranges:
            if not isinstance(pair, (list, tuple)) or len(pair) != 2:
                raise ApiError('Each range needs a start and an end time')
            start, end = parse_time(pair[0], 'Start time'), parse_time(pair[1], 'End time')
            if end <= start:
                raise ApiError('End time must be after start time')
            cleaned.append([start, end])
        plan[day] = _merge(cleaned)

    for day, ranges in plan.items():
        DoctorAvailability.query.filter_by(doctor_id=doctor.id, date=day).delete()
        for start, end in ranges:
            db.session.add(DoctorAvailability(doctor_id=doctor.id, date=day, start_time=start, end_time=end))
    commit()
    _clear_availability_cache(doctor.id)
    return jsonify({'message': 'Availability saved', 'days': {d.isoformat(): r for d, r in plan.items()}})


# QUEUE

def _todays_queue(doctor_id):
    return Appointment.query.filter(
        Appointment.doctor_id == doctor_id,
        Appointment.date == date.today(),
        Appointment.status != 'Cancelled',
    ).order_by(Appointment.time).all()


def _now_serving(queue):
    called = [a for a in queue if a.called_at]
    return max(called, key=lambda a: a.called_at) if called else None


@api_bp.route('/queue/next', methods=['POST'])
@roles_required('doctor')
def call_next_patient():
    """Call the next patient in today's queue (or a specific one) into the doctor's room."""
    doctor = g.user.doctor_profile
    queue = _todays_queue(doctor.id)
    appointment_id = get_body().get('appointment_id')

    if appointment_id:
        target = next((a for a in queue if a.id == appointment_id and a.status == 'Booked'), None)
        if not target:
            raise ApiError('That patient is not in your queue today', 404)
    else:
        target = next((a for a in queue if a.status == 'Booked' and not a.called_at), None)
        if not target:
            raise ApiError('Nobody else is waiting today', 404)

    target.called_at = datetime.now()
    commit()
    return jsonify(target.to_dict())


@api_bp.route('/appointments/<int:appt_id>/queue', methods=['GET'])
@login_required
def appointment_queue(appt_id):
    """Live status for a ticket: place in line, who's being seen now and a rough wait."""
    appointment = get_or_404(Appointment, appt_id, 'Appointment')
    if not can_manage_appointment(g.user, appointment):
        raise ApiError("You don't have access to this appointment", 403)

    result = {'token': appointment.token, 'status': appointment.status, 'today': appointment.date == date.today(),
              'called': appointment.called_at is not None, 'room': appointment.doctor.room_label}
    if result['today'] and appointment.status == 'Booked':
        queue = _todays_queue(appointment.doctor_id)
        serving = _now_serving(queue)
        ahead = [a for a in queue if a.status == 'Booked' and not a.called_at and a.time < appointment.time]
        result.update({
            'ahead': len(ahead),
            'now_serving': serving.token if serving else None,
            'estimated_wait_minutes': len(ahead) * AVG_CONSULT_MINUTES,
        })
    return jsonify(result)


# LOBBY SCREEN (public, no patient names)

@api_bp.route('/lobby', methods=['GET'])
def lobby():
    boards = []
    doctors = Doctor.query.join(User).filter(User.is_active.is_(True)).all()
    for doctor in doctors:
        queue = _todays_queue(doctor.id)
        if not queue:
            continue
        serving = _now_serving(queue)
        waiting = [a for a in queue if a.status == 'Booked' and not a.called_at]
        boards.append({
            'doctor': doctor.user.name,
            'department': doctor.department.name if doctor.department else '',
            'room': doctor.room_label,
            'now_serving': serving.token if serving else None,
            'called_at': serving.called_at.isoformat() if serving else None,
            'up_next': [a.token for a in waiting[:3]],
            'waiting': len(waiting),
        })
    boards.sort(key=lambda b: (b['now_serving'] is None, _room_number(b['room'])))
    return jsonify({'time': datetime.now().strftime('%H:%M'), 'date': date.today().isoformat(), 'boards': boards})
