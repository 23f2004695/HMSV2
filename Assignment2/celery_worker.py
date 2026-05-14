from celery import Celery
from celery.schedules import crontab

def make_celery(app_name=__name__):
    celery = Celery(
        app_name,
        broker='redis://localhost:6379/1',
        backend='redis://localhost:6379/1'
    )

    celery.conf.update(
        timezone='Asia/Kolkata',
        broker_connection_retry_on_startup=True,
        beat_schedule={
            'daily-reminders': {
                'task': 'tasks.send_daily_reminders',
                'schedule': crontab(hour=8, minute=0),
            },
            'monthly-report': {
                'task': 'tasks.send_monthly_report',
                'schedule': crontab(day_of_month=1, hour=9, minute=0),
            },
        }
    )

    return celery

celery = make_celery()


import tasks