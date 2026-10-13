# 🏥 QueueCare: Real-Time Hospital Intake & Ticketing System

[![tests](https://github.com/23f2004695/HMSV2/actions/workflows/tests.yml/badge.svg)](https://github.com/23f2004695/HMSV2/actions/workflows/tests.yml)
![Python](https://img.shields.io/badge/Python-3.11%20%7C%203.12-3776AB?logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-3.1-000000?logo=flask)
![Vue.js](https://img.shields.io/badge/Vue.js-3-4FC08D?logo=vuedotjs&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-cache%20%2B%20broker-DC382D?logo=redis&logoColor=white)
![Celery](https://img.shields.io/badge/Celery-background%20jobs-37814A?logo=celery&logoColor=white)

A hospital app that follows a visit from **symptom to seat**. A patient taps where it hurts, books a free slot, gets a boarding-pass style ticket with a QR code, and watches their place in the queue live. On the day, the waiting-room TV flips their token up like an airport board when the doctor calls them in.

It has three roles. **Patients** book and track visits, **doctors** paint their weekly hours, run their queue and write prescriptions, and **admins** manage everyone. The frontend is a Vue 3 single-page app talking to a Flask REST API, with JWT auth, Redis caching and Celery jobs for reminders, monthly reports and CSV exports.

<p align="center">
  <img src="docs/demo/booking-flow.gif" alt="Booking from the body map to the boarding pass" width="880">
</p>

## 🔑 Demo logins

Run `python seed_demo.py` once (see [Getting started](#getting-started)) and log in with any of these:

| Role | Username | Password | Good for trying |
|---|---|---|---|
| Admin | `admin` | `admin123` | Dashboard, managing doctors and patients, Ctrl+K "patient meera" |
| Doctor | `dr.mehta` | `demo123` | Today's queue, **Call next patient**, prescriptions, My Week |
| Patient | `rahul` | `demo123` | Live tickets, body map booking, health journey |

More demo accounts, all with password `demo123`:
- **Doctors:** `dr.sharma`, `dr.iyer`, `dr.khan`, `dr.gill`, `dr.nair`
- **Patients:** `sneha`, `amit`, `priya`, `kiran`, `meera`, `vikram`, `ananya`

The admin account is created automatically on first run. You can change its password with `ADMIN_PASSWORD` in `.env`.

## Highlights

| | |
|---|---|
| 🧑‍⚕️ **A cast of 3D characters** | Every department has its own mascot. Each role gets a scene in its greeting, and empty pages, loaders and confirmations all have a character. They tilt toward your cursor, float, and pop up a speech bubble with a tip when you click or hover them. |
| 🧍 **"Where does it hurt?"** | Patients tap a glowing point on a 3D character and pick a symptom, and the app suggests the right department (knee → Orthopedics, chest pain → Cardiology, anything for a child → Pediatrics). That department's mascot pops up, with the doctors who are free. |
| 🎫 **Boarding-pass tickets** | Every booking gets a token like `C-04`, a QR code and a gate (room). Tap the pass to flip it for prep notes. On the day it shows *"Now serving C-02 · 1 ahead of you · ~15 min"* and lights up when it's your turn. |
| 📺 **Lobby "Now Serving" screen** | A full-screen board for the waiting-room TV at `/lobby`. When a doctor calls the next patient, a waving nurse announces the token, and then the board flips it into place split-flap style. There's an optional chime and spoken announcement, and no patient names are shown. |
| 🗓️ **My week** | Doctors paint their hours with a brush and rub them out with an eraser, guided by a character and three numbered steps. They can add whole shifts in one tap, copy a day to every weekday, and see booked patients and a "now" line on the grid. Patients see each doctor's week as a heatmap of free slots, and a slot booked by someone else while you're looking fades out as *just taken*. |
| ℞ **Prescription pad** | Treatments are written on a letterhead pad. Signing draws the doctor's signature in handwriting, and patients can open any prescription and save it as a PDF. |
| 🚇 **Health journey map** | A patient's history is a subway-style line with one station per visit, coloured by department. Tap a station to see the diagnosis and prescription. |
| ⌨️ **Command palette + voice** | Press <kbd>Ctrl</kbd>+<kbd>K</kbd> and type (or say) things like *"book cardiology tomorrow at 2pm"*, *"cancel my next"*, *"call next"*, *"add slot friday 9-1"* or *"patient meera"*. |
| ✨ **Small touches** | A time-of-day greeting (*"Good afternoon, Dr. Mehta. 4 patients today, first at 09:30"*), count-up stats, toast notifications, springy page transitions, a logo heart that beats when something happens, and confetti when a doctor finishes their last patient. All motion switches off for people who prefer reduced motion. |

<p align="center">
  <img src="docs/demo/lobby-screen.gif" alt="Doctor calls the next patient and the lobby board flips" width="880">
</p>

## Screenshots

| Patient dashboard with live tickets | Where does it hurt? |
|---|---|
| ![Patient dashboard](docs/screenshots/patient-dashboard.png) | ![Body map](docs/screenshots/body-map.png) |
| **Week heatmap and slot picker** | **A slot taken by someone else, live** |
| ![Slot picker](docs/screenshots/slot-picker.png) | ![Just taken](docs/screenshots/just-taken.png) |
| **Doctor's queue** | **End of the day** |
| ![Doctor dashboard](docs/screenshots/doctor-dashboard.png) | ![Doctor done](docs/screenshots/doctor-done.png) |
| **Signing a prescription** | **Booking confirmed** |
| ![Prescription](docs/screenshots/rx-signing.png) | ![Booked](docs/screenshots/booked.png) |
| **Health journey** | **My week** |
| ![Journey](docs/screenshots/journey.png) | ![My week](docs/screenshots/paint-week.png) |
| **Lobby screen** | **Admin dashboard** |
| ![Lobby](docs/screenshots/lobby.png) | ![Admin dashboard](docs/screenshots/admin-dashboard.png) |
| **Departments, each with a mascot** | **Ctrl+K command palette** |
| ![Departments](docs/screenshots/departments.png) | ![Palette](docs/screenshots/palette.png) |

### More screenshots

<details>
<summary><b>Patient</b>: sign up, browse doctors, appointments, ticket, journey list, profile</summary>

| Sign up | Browse doctors |
|---|---|
| ![Register](docs/screenshots/register.png) | ![Browse doctors](docs/screenshots/browse-doctors.png) |
| **Appointments** | **Boarding pass** |
| ![Appointments](docs/screenshots/patient-appointments.png) | ![Ticket](docs/screenshots/ticket-modal.png) |
| **Booking confirmed** | **Back of the pass (prep notes)** |
| ![Booked](docs/screenshots/booked.png) | ![Ticket back](docs/screenshots/ticket-back.png) |
| **Journey as a list** | **Profile** |
| ![Journey list](docs/screenshots/journey-list.png) | ![Profile](docs/screenshots/profile.png) |
| **Opening a prescription** | **Login** |
| ![Prescription view](docs/screenshots/rx-view.png) | ![Login](docs/screenshots/login.png) |

</details>

<details>
<summary><b>Doctor</b>: writing a prescription, appointments, My week</summary>

| Writing a prescription | Appointments |
|---|---|
| ![Prescription](docs/screenshots/rx-write.png) | ![Doctor appointments](docs/screenshots/doctor-appointments.png) |
| **My week: empty, with the drag hint** | **My week: painting a shift** |
| ![Week empty](docs/screenshots/week-empty.png) | ![Week dragging](docs/screenshots/week-dragging.png) |

</details>

<details>
<summary><b>Admin</b>: doctors, adding a doctor, patients, appointments, search</summary>

| Doctors | Adding a doctor |
|---|---|
| ![Admin doctors](docs/screenshots/admin-doctors.png) | ![Add doctor](docs/screenshots/admin-add-doctor.png) |
| **Patients** | **All appointments** |
| ![Admin patients](docs/screenshots/admin-patients.png) | ![Admin appointments](docs/screenshots/admin-appointments.png) |
| **Search** | **Lobby callout** |
| ![Admin search](docs/screenshots/admin-search.png) | ![Lobby callout](docs/screenshots/lobby-callout.png) |

</details>

<details>
<summary><b>Mobile</b></summary>

<p>
  <img src="docs/screenshots/mobile-login.png" alt="Mobile login" width="200">
  <img src="docs/screenshots/mobile-dashboard.png" alt="Mobile patient dashboard" width="200">
  <img src="docs/screenshots/mobile-bodymap.png" alt="Mobile body map" width="200">
  <img src="docs/screenshots/mobile-doctor.png" alt="Mobile doctor dashboard" width="200">
  <img src="docs/screenshots/week-mobile.png" alt="Mobile My week" width="200">
</p>
</details>

## Everything each role can do

**Patient**
- Register, log in, edit their profile and change their password
- Find a doctor from the body map or browse by department, with each doctor's next free slot shown on their card
- Book, reschedule and cancel, with clash checks on both the doctor's and the patient's side
- Live tickets with queue position and QR code, a health journey map, prescriptions as PDF, and a CSV export of their history (runs as a Celery job)
- A reminder email on the morning of an appointment

**Doctor**
- A live queue for today: call the next patient (or a specific one), finish visits with a prescription, and see how much of the day is done
- Paint availability for the next 7 days and see booked appointments on the same grid
- Open the full history of any patient who has booked with them
- A monthly activity report by email on the 1st of every month

**Admin**
- Dashboard with live counts and status breakdowns
- Add, edit, deactivate and reactivate doctors (including their room)
- Search doctors, patients and departments, open any patient's journey, and deactivate accounts

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | Vue 3 (CDN, no build step), Bootstrap 5, Bootstrap Icons, Nunito, 3D illustrations (WebP), qrcodejs, canvas-confetti, Web Speech API |
| Backend | Flask 3, Flask-SQLAlchemy, Flask-JWT-Extended, Flask-Caching, Flask-Mail |
| Database | SQLite by default (any SQLAlchemy URL works through `DATABASE_URL`) |
| Cache | Redis, with an automatic in-memory fallback when Redis isn't running |
| Background jobs | Celery + Celery Beat with Redis as the broker |
| Tests | pytest (53 tests), run on every push with GitHub Actions |

## How it fits together

```mermaid
flowchart LR
    UI["Vue 3 SPA<br/>(static/js)"] -- "REST + JWT" --> API["Flask API<br/>(api.py, api_live.py)"]
    TV["Lobby screen<br/>(/lobby)"] -- "polls /api/lobby" --> API
    API --> DB[("SQLite<br/>SQLAlchemy")]
    API <--> C[("Redis<br/>cache")]
    API -- "export job" --> Q[("Redis<br/>broker")]
    Q --> W["Celery worker<br/>(tasks.py)"]
    B["Celery beat"] -- "8 AM reminders<br/>monthly reports" --> Q
    W --> DB
    W --> M["Email<br/>(Flask-Mail)"]
```

The live parts (tickets, the doctor's queue, the slot picker and the lobby board) poll small JSON endpoints every few seconds, so they work without WebSockets.

## Getting started

You need Python 3.11+. Redis is optional for trying it out.

```bash
git clone https://github.com/23f2004695/HMSV2.git
cd HMSV2
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

python seed_demo.py               # demo doctors, patients, a live queue for today and past visits
python app.py                     # http://localhost:5000  (lobby screen at /lobby)
```

The database and the default admin account are created on first run. Older databases get the new columns added automatically.

Log in with the accounts listed under [Demo logins](#-demo-logins).

**Try this:**
1. Open `/lobby` in one window.
2. Log in as `dr.mehta` in another window and press **Call next patient**. The board flips.
3. Log in as `rahul` to see his ticket update to *"It's your turn"*.

### With Redis and Celery

To get Redis caching and the background jobs, start Redis and run the worker and scheduler in two more terminals:

```bash
redis-server
celery -A celery_worker.celery worker --loglevel=info
celery -A celery_worker.celery beat --loglevel=info
```

If no worker is running, the CSV export still works because the app falls back to exporting directly.

### Configuration

Copy `.env.example` to `.env` to change secrets, the admin password, the database or the Redis URL. To actually send reminder and report emails, set `MAIL_USERNAME` and `MAIL_PASSWORD` (a Gmail app password works). Without them the emails are just logged.

## Running the tests

```bash
pip install -r requirements-dev.txt
pytest
```

The tests cover:
- login and registration
- booking rules (availability, double booking, past dates, rescheduling)
- queue tokens and calling patients in
- the lobby feed (including that it never exposes patient names)
- free-slot and weekly availability endpoints
- role permissions for every endpoint
- cache invalidation and the background tasks

They use an in-memory database and never touch your real Redis.

## API overview

All routes are under `/api`. Apart from login, register and the lobby feed, they need an `Authorization: Bearer <token>` header.

| Method | Route | Who |
|---|---|---|
| POST | `/auth/login`, `/auth/register` | anyone |
| GET, PUT | `/auth/me` | logged in (own profile and password) |
| GET | `/departments` | logged in |
| POST | `/departments` | admin |
| GET | `/doctors?search=&department_id=` | logged in |
| POST, PUT, DELETE | `/doctors`, `/doctors/<id>` | admin |
| GET | `/doctors/<id>/availability` | logged in |
| GET | `/doctors/<id>/slots` | logged in (free 30-minute slots for the next week) |
| POST, DELETE | `/doctors/<id>/availability[/<slot_id>]` | that doctor or admin |
| PUT | `/doctors/<id>/availability/week` | that doctor or admin (replace whole days) |
| GET | `/patients` | admin, or a doctor (only their own patients) |
| GET | `/patients/<id>`, `/patients/<id>/history` | that patient, their doctor, or admin |
| GET, POST | `/appointments` | patients see and book their own, doctors see theirs |
| PUT | `/appointments/<id>`, `/appointments/<id>/cancel` | people involved in the appointment, or admin |
| GET | `/appointments/<id>/queue` | people involved (live place in line) |
| POST | `/queue/next` | doctor (call the next patient, or a specific one) |
| GET | `/lobby` | anyone (tokens and rooms only, no names) |
| POST | `/appointments/<id>/treatment` | the appointment's doctor or admin |
| POST | `/patients/<id>/export` | that patient, their doctor, or admin |
| GET | `/tasks/<task_id>`, `/download/<filename>` | whoever is allowed to see that export |
| GET | `/admin/stats`, `/search` | admin |

## Project structure

```
HMSV2/
├── app.py              # app factory, error handlers, schema upgrades, /lobby page
├── api.py              # REST endpoints, validation and permission checks
├── api_live.py         # queue tokens, call-next, lobby feed, slots, weekly availability
├── models.py           # SQLAlchemy models
├── config.py           # settings, all overridable from .env
├── extensions.py       # cache, JWT and mail instances
├── exports.py          # CSV export shared by the API and Celery
├── celery_worker.py    # Celery app + beat schedule
├── tasks.py            # reminders, monthly reports, CSV export job
├── seed_demo.py        # demo data, including a live queue for today
├── templates/
│   ├── index.html      # the SPA shell
│   └── lobby.html      # the waiting-room screen
├── static/
│   ├── css/style.css   # colours, character interactions, animations
│   ├── js/
│   │   ├── store.js    # shared state, API helper, toasts
│   │   ├── app.js      # root component and routing
│   │   └── components/ # characters, body map, boarding pass, slot picker, palette, Rx pad...
│   └── img/illos/      # the 3D character illustrations
├── tests/              # pytest suite
└── docs/
    ├── project-report.pdf
    ├── demo/           # GIFs
    └── screenshots/
```

## Project report

The original write-up for this project is in [`docs/project-report.pdf`](docs/project-report.pdf).
