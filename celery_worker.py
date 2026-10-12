"""Celery app for background jobs.

Run a worker and the scheduler with:
    celery -A celery_worker.celery worker --loglevel=info
    celery -A celery_worker.celery beat --loglevel=info
"""
import os
import sys

from celery import Celery
from celery.schedules import crontab
from flask import has_app_context

# The celery CLI puts the project folder on sys.path only while it loads this module and
# removes it afterwards, so tasks importing the Flask app later would fail without this.
# Appended unconditionally because the entry celery added is about to be removed.
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config import Config  # noqa: E402

celery = Celery(
    'hms',
    broker=Config.CELERY_BROKER_URL,
    backend=Config.CELERY_RESULT_BACKEND,
    include=['tasks'],
)

celery.conf.update(
    timezone=Config.TIMEZONE,
    broker_connection_retry_on_startup=True,
    # Fail fast when the web app queues a job and Redis is down, so it can fall back
    broker_connection_timeout=1,
    broker_transport_options={'max_retries': 1, 'interval_start': 0, 'interval_step': 0.2, 'interval_max': 0.5},
    result_expires=3600,
    beat_schedule={
        'daily-reminders': {
            'task': 'tasks.send_daily_reminders',
            'schedule': crontab(hour=8, minute=0),
        },
        'monthly-report': {
            'task': 'tasks.send_monthly_report',
            'schedule': crontab(day_of_month=1, hour=9, minute=0),
        },
    },
)

_flask_app = None


def get_flask_app():
    # Build the Flask app once per worker process instead of once per task
    global _flask_app
    if _flask_app is None:
        from app import create_app
        _flask_app = create_app()
    return _flask_app


class FlaskTask(celery.Task):
    """Run every task inside a Flask app context so models and config work."""

    def __call__(self, *args, **kwargs):
        if has_app_context():
            return self.run(*args, **kwargs)
        with get_flask_app().app_context():
            return self.run(*args, **kwargs)


celery.Task = FlaskTask
