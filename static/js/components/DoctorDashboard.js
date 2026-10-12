window.DoctorDashboard = {
    emits: ['open-treatment', 'view-history'],
    template: `
        <div>
            <hero-greeting :subtitle="subtitle"></hero-greeting>

            <div class="row g-4 mb-4">
                <!-- Now serving -->
                <div class="col-lg-4">
                    <div class="card now-serving h-100">
                        <div class="card-body d-flex flex-column">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <span class="text-muted small text-uppercase fw-semibold">Now serving &middot; {{ room }}</span>
                                <span v-if="current" class="badge bg-success-subtle text-success"><span class="live-dot"></span>In room</span>
                            </div>
                            <illo class="serving-illo" :key="'nurse-' + (current ? current.token : 'none')" :name="current ? 'nurse-wave' : 'nurse-notes'"
                                  :tips="current ? ['Calling ' + current.token + ' to ' + room + '!'] : ['Ready when you are, doctor.']" pop></illo>
                            <transition name="flip-token" mode="out-in">
                                <div :key="current ? current.token : 'none'" class="serving-token">{{ current ? current.token : '--' }}</div>
                            </transition>
                            <div class="text-center mb-3" style="min-height: 3rem">
                                <template v-if="current">
                                    <div class="fw-semibold">{{ current.patient_name }}</div>
                                    <div class="small text-muted">{{ current.reason || 'Consultation' }} &middot; booked for {{ current.time }}</div>
                                </template>
                                <div v-else-if="todayQueue.length && doneCount === todayQueue.length" class="small text-success fw-semibold"><i class="bi bi-check2-all me-1"></i>That's everyone for today.</div>
                                <div v-else class="small text-muted">Nobody in the room yet.</div>
                            </div>
                            <div class="d-grid gap-2 mt-auto">
                                <button v-if="current" class="btn btn-success" @click="$emit('open-treatment', current)">
                                    <i class="bi bi-prescription2 me-1"></i> Write prescription &amp; finish
                                </button>
                                <button class="btn btn-primary btn-lg call-next" :disabled="!waiting.length || calling" @click="callNext()">
                                    <span v-if="calling" class="spinner-border spinner-border-sm me-1"></span>
                                    <i v-else class="bi bi-megaphone-fill me-1"></i>
                                    {{ waiting.length ? 'Call next patient' : 'No one waiting' }}
                                </button>
                                <a href="/lobby" target="_blank" class="btn btn-link btn-sm">Open lobby screen <i class="bi bi-box-arrow-up-right"></i></a>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Today's queue -->
                <div class="col-lg-8">
                    <div class="card h-100">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <span><i class="bi bi-people me-1"></i> Today's queue</span>
                            <span class="small text-muted">{{ doneCount }} of {{ todayQueue.length }} done</span>
                        </div>
                        <div class="progress rounded-0" style="height: 4px">
                            <div class="progress-bar bg-success" :style="{ width: progress + '%', transition: 'width 0.8s ease' }"></div>
                        </div>
                        <app-loader v-if="loading" text="Loading today's queue..."></app-loader>
                        <empty-state v-else-if="!todayQueue.length" illo="heart-present" title="No appointments today" text="Enjoy the quiet day!"></empty-state>
                        <transition-group v-else name="list" tag="ul" class="list-group list-group-flush queue-list position-relative">
                            <li v-for="a in todayQueue" :key="a.id" class="list-group-item d-flex align-items-center gap-3" :class="'q-' + stateOf(a)">
                                <code class="q-token">{{ a.token }}</code>
                                <span class="avatar" style="width:36px;height:36px;font-size:0.8rem" :style="{ background: store.avatarColor(a.patient_name) }">{{ store.initials(a.patient_name) }}</span>
                                <div class="flex-grow-1 min-w-0">
                                    <div class="fw-semibold text-truncate">{{ a.patient_name }}</div>
                                    <div class="small text-muted text-truncate">{{ a.time }} &middot; {{ a.reason || 'Consultation' }}</div>
                                </div>
                                <span class="q-state">{{ stateLabel(a) }}</span>
                                <div class="d-flex gap-1">
                                    <button v-if="stateOf(a) === 'waiting'" class="btn btn-sm btn-outline-primary" @click="callNext(a)" title="Call in now"><i class="bi bi-megaphone"></i></button>
                                    <button v-if="stateOf(a) === 'in-room'" class="btn btn-sm btn-success" @click="$emit('open-treatment', a)" title="Finish visit"><i class="bi bi-check2"></i></button>
                                    <button class="btn btn-sm btn-outline-secondary" @click="$emit('view-history', a.patient_id)" title="History"><i class="bi bi-clock-history"></i></button>
                                </div>
                            </li>
                        </transition-group>
                    </div>
                </div>
            </div>

            <div class="row g-4">
                <div class="col-lg-6">
                    <div class="card">
                        <div class="card-header"><i class="bi bi-calendar-week me-1"></i> Coming up</div>
                        <div class="list-group list-group-flush">
                            <div class="list-group-item text-muted small" v-if="!comingUp.length">Nothing booked for the coming days yet.</div>
                            <div class="list-group-item d-flex justify-content-between align-items-center" v-for="a in comingUp.slice(0, 6)" :key="a.id">
                                <div>
                                    <strong>{{ dayLabel(a.date) }}</strong> at {{ a.time }}
                                    <div class="small text-muted">{{ a.patient_name }} &middot; <code>{{ a.token }}</code></div>
                                </div>
                                <button class="btn btn-sm btn-outline-danger" @click="cancelAppointment(a.id)" title="Cancel"><i class="bi bi-x-lg"></i></button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-6">
                    <div class="card">
                        <div class="card-header"><i class="bi bi-person-lines-fill me-1"></i> My patients</div>
                        <div class="list-group list-group-flush">
                            <div class="list-group-item text-muted small" v-if="!doctorPatients.length">No patients yet.</div>
                            <a href="#" class="list-group-item list-group-item-action d-flex align-items-center gap-2" v-for="p in doctorPatients.slice(0, 6)" :key="p.patient_id" @click.prevent="$emit('view-history', p.patient_id)">
                                <span class="avatar" style="width:32px;height:32px;font-size:0.75rem" :style="{ background: store.avatarColor(p.name) }">{{ store.initials(p.name) }}</span>
                                <span class="flex-grow-1">{{ p.name }}</span>
                                <span class="small text-muted">last visit {{ p.last_visit || '-' }}</span>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return { store: window.store, loading: true, calling: false, timer: null };
    },
    computed: {
        room() {
            const d = this.store.user.doctor;
            return (d && d.room) || 'your room';
        },
        todayQueue() {
            return this.store.appointments
                .filter(a => a.date === this.store.todayStr && a.status !== 'Cancelled')
                .sort((a, b) => a.time.localeCompare(b.time));
        },
        waiting() {
            return this.todayQueue.filter(a => this.stateOf(a) === 'waiting');
        },
        current() {
            const inRoom = this.todayQueue.filter(a => this.stateOf(a) === 'in-room');
            return inRoom.sort((a, b) => (b.called_at || '').localeCompare(a.called_at || ''))[0] || null;
        },
        doneCount() {
            return this.todayQueue.filter(a => a.status === 'Completed').length;
        },
        progress() {
            return this.todayQueue.length ? Math.round(this.doneCount / this.todayQueue.length * 100) : 0;
        },
        comingUp() {
            return this.store.appointments
                .filter(a => a.date > this.store.todayStr && a.status === 'Booked')
                .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
        },
        doctorPatients() {
            const byPatient = {};
            for (const a of this.store.appointments) {
                const p = byPatient[a.patient_id] || (byPatient[a.patient_id] = { patient_id: a.patient_id, name: a.patient_name, last_visit: null });
                if (a.status === 'Completed' && (!p.last_visit || a.date > p.last_visit)) p.last_visit = a.date;
            }
            return Object.values(byPatient).sort((a, b) => (b.last_visit || '').localeCompare(a.last_visit || ''));
        },
        subtitle() {
            const n = this.todayQueue.length;
            if (!n) return 'No patients booked today.';
            const left = this.waiting.length;
            const first = this.todayQueue[0].time;
            return `${n} patient${n === 1 ? '' : 's'} today, first at ${first}. ${left ? left + ' still waiting.' : 'Everyone has been seen.'}`;
        }
    },
    watch: {
        // Confetti when the last patient of the day is finished
        doneCount(now, before) {
            if (now > before && now === this.todayQueue.length && now > 0) {
                this.store.celebrate();
                this.store.showAlert("That's everyone for today. Great work!", 'success');
            }
        }
    },
    async created() {
        await this.store.loadAppointments();
        this.loading = false;
        // Pick up new bookings while the dashboard is open
        this.timer = setInterval(() => this.store.loadAppointments(), 20000);
    },
    unmounted() {
        clearInterval(this.timer);
    },
    methods: {
        stateOf(a) {
            if (a.status === 'Completed') return 'done';
            return a.called_at ? 'in-room' : 'waiting';
        },
        stateLabel(a) {
            return { done: 'Done', 'in-room': 'In room', waiting: 'Waiting' }[this.stateOf(a)];
        },
        dayLabel(iso) {
            return new Date(iso + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
        },
        async callNext(appointment = null) {
            this.calling = true;
            try {
                const called = await this.store.api('/queue/next', 'POST', appointment ? { appointment_id: appointment.id } : {});
                this.store.showAlert(`Calling ${called.token} (${called.patient_name}) to ${called.room}`, 'info');
                this.store.pulse();
                await this.store.loadAppointments();
            } catch (e) {
                this.store.showAlert(e.message, 'warning');
            } finally {
                this.calling = false;
            }
        },
        async cancelAppointment(id) {
            if (!confirm('Cancel this appointment?')) return;
            try {
                await this.store.api('/appointments/' + id + '/cancel', 'PUT');
                this.store.showAlert('Appointment cancelled', 'info');
                await this.store.loadAppointments();
            } catch (e) {
                this.store.showAlert(e.message, 'danger');
            }
        }
    }
};
