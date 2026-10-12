window.PatientDashboard = {
    emits: ['find-doctor-dept', 'reschedule'],
    template: `
        <div>
            <hero-greeting :subtitle="subtitle"></hero-greeting>

            <div class="d-flex justify-content-between align-items-center mb-2">
                <h5 class="fw-bold mb-0"><i class="bi bi-ticket-perforated me-1"></i> My tickets</h5>
                <button class="btn btn-sm btn-primary" @click="store.navigate('find-doctor')"><i class="bi bi-plus-lg"></i> Book new</button>
            </div>
            <ecg-loader v-if="loading" text="Fetching your tickets..."></ecg-loader>
            <div v-else-if="!upcoming.length" class="card mb-4">
                <div class="empty-state">
                    <i class="bi bi-ticket-perforated"></i>
                    No upcoming appointments.
                    <div class="mt-3"><button class="btn btn-primary" @click="store.navigate('find-doctor')">Book one now</button></div>
                </div>
            </div>
            <div v-else class="ticket-rail mb-4">
                <transition-group name="list">
                    <div v-for="a in upcoming" :key="a.id" class="ticket-slot">
                        <boarding-pass :appointment="a"></boarding-pass>
                        <div class="d-flex gap-2 mt-2">
                            <button class="btn btn-sm btn-outline-secondary" @click="$emit('reschedule', a)"><i class="bi bi-arrow-repeat"></i> Reschedule</button>
                            <button class="btn btn-sm btn-outline-danger" @click="cancelAppointment(a)"><i class="bi bi-x-lg"></i> Cancel</button>
                        </div>
                    </div>
                </transition-group>
            </div>

            <div class="row g-4">
                <div class="col-lg-8">
                    <div class="card body-cta mb-4" @click="store.navigate('find-doctor')" role="button">
                        <div class="card-body d-flex align-items-center gap-3">
                            <span class="cta-icon"><i class="bi bi-person-arms-up"></i></span>
                            <div>
                                <h5 class="mb-1 fw-bold">Not feeling well?</h5>
                                <div class="text-muted">Tap where it hurts and we'll find the right doctor for you.</div>
                            </div>
                            <i class="bi bi-arrow-right ms-auto fs-4"></i>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header"><i class="bi bi-building me-1"></i> Departments</div>
                        <div class="card-body">
                            <div class="row g-2 stagger">
                                <div class="col-md-4 col-6" v-for="dept in store.departments" :key="dept.id">
                                    <div class="card h-100 dept-card" @click="$emit('find-doctor-dept', dept.id)">
                                        <div class="card-body text-center py-3">
                                            <i class="bi fs-3 text-primary" :class="deptIcon(dept.name)"></i>
                                            <h6 class="mt-2 mb-0">{{ dept.name }}</h6>
                                            <small class="text-muted">{{ dept.doctors_count }} {{ dept.doctors_count === 1 ? 'doctor' : 'doctors' }}</small>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-lg-4">
                    <div class="card mb-4">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <span><i class="bi bi-signpost-split me-1"></i> Recent visits</span>
                            <a href="#" class="small" @click.prevent="store.navigate('my-history')">My journey</a>
                        </div>
                        <div class="list-group list-group-flush">
                            <div class="list-group-item text-muted small" v-if="!past.length">No past visits yet.</div>
                            <div class="list-group-item" v-for="a in past.slice(0, 5)" :key="a.id">
                                <div class="d-flex justify-content-between">
                                    <strong>Dr. {{ a.doctor_name }}</strong>
                                    <span class="badge" :class="store.statusBadge(a.status)">{{ a.status === 'Booked' ? 'Missed' : a.status }}</span>
                                </div>
                                <small class="text-muted">{{ a.date }} &middot; {{ a.department }}</small>
                                <div v-if="a.treatment"><small class="text-success">{{ a.treatment.diagnosis }}</small></div>
                            </div>
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-body d-flex align-items-center gap-3">
                            <span class="avatar avatar-lg" :style="{ background: store.avatarColor(store.user.name) }">{{ store.initials(store.user.name) }}</span>
                            <div>
                                <div class="fw-semibold">{{ store.user.name }}</div>
                                <div class="small text-muted">{{ store.user.email }}</div>
                                <a href="#" class="small" @click.prevent="store.navigate('profile')">Edit profile</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return { store: window.store, loading: true };
    },
    computed: {
        upcoming() {
            return this.store.appointments
                .filter(a => this.store.isUpcoming(a))
                .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
        },
        past() {
            return this.store.appointments.filter(a => !this.store.isUpcoming(a));
        },
        subtitle() {
            const next = this.upcoming[0];
            if (!next) return 'No visits coming up. Hope you are feeling well!';
            const when = next.date === this.store.todayStr ? 'today' : new Date(next.date + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
            return `Your next visit is ${when} at ${next.time} with Dr. ${next.doctor_name} (token ${next.token}).`;
        }
    },
    async created() {
        await Promise.all([this.store.loadDepartments(), this.store.loadAppointments()]);
        this.loading = false;
    },
    methods: {
        deptIcon(name) {
            return {
                'Cardiology': 'bi-heart-pulse', 'Orthopedics': 'bi-person-walking', 'Dermatology': 'bi-droplet-half',
                'Pediatrics': 'bi-balloon-heart', 'Neurology': 'bi-lightning', 'ENT': 'bi-ear',
                'Ophthalmology': 'bi-eye', 'General Medicine': 'bi-capsule'
            }[name] || 'bi-hospital';
        },
        async cancelAppointment(a) {
            if (!confirm('Cancel your appointment with Dr. ' + a.doctor_name + ' on ' + a.date + ' at ' + a.time + '?')) return;
            try {
                await this.store.api('/appointments/' + a.id + '/cancel', 'PUT');
                this.store.showAlert('Appointment cancelled', 'info');
                await this.store.loadAppointments();
            } catch (e) {
                this.store.showAlert(e.message, 'danger');
            }
        }
    }
};
