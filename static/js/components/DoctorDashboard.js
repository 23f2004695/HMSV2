window.DoctorDashboard = {
    template: `
        <div>
            <h3 class="mb-4">Welcome, Dr. {{ store.user.name }}</h3>
            <div class="row g-3 mb-4">
                <!-- Upcoming Appointments -->
                <div class="col-md-6">
                    <div class="card shadow-sm">
                        <div class="card-header bg-primary text-white">
                            <h5 class="mb-0"><i class="bi bi-calendar-week"></i> Upcoming Appointments</h5>
                        </div>
                        <div class="card-body p-0">
                            <table class="table table-hover mb-0" v-if="upcomingAppointments.length">
                                <thead><tr><th>Patient</th><th>Date</th><th>Time</th><th>Status</th><th>Actions</th></tr></thead>
                                <tbody>
                                    <tr v-for="a in upcomingAppointments" :key="a.id">
                                        <td>{{ a.patient_name }}</td><td>{{ a.date }}</td><td>{{ a.time }}</td>
                                        <td><span class="badge" :class="store.statusBadge(a.status)">{{ a.status }}</span></td>
                                        <td>
                                            <button class="btn btn-sm btn-success me-1" @click="$emit('open-treatment', a)" v-if="a.status==='Booked'" title="Complete & Add Treatment">
                                                <i class="bi bi-check-circle"></i>
                                            </button>
                                            <button class="btn btn-sm btn-danger" @click="cancelAppointment(a.id)" v-if="a.status==='Booked'" title="Cancel">
                                                <i class="bi bi-x-circle"></i>
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                            <p class="p-3 text-muted" v-else>No upcoming appointments.</p>
                        </div>
                    </div>
                </div>
                <!-- My Patients -->
                <div class="col-md-6">
                    <div class="card shadow-sm">
                        <div class="card-header bg-success text-white">
                            <h5 class="mb-0"><i class="bi bi-people"></i> My Patients</h5>
                        </div>
                        <div class="card-body p-0">
                            <table class="table table-hover mb-0" v-if="doctorPatients.length">
                                <thead><tr><th>Name</th><th>Last Visit</th><th>Actions</th></tr></thead>
                                <tbody>
                                    <tr v-for="p in doctorPatients" :key="p.patient_id">
                                        <td>{{ p.name }}</td><td>{{ p.last_visit || '-' }}</td>
                                        <td><button class="btn btn-sm btn-info" @click="$emit('view-history', p.patient_id)" title="View history"><i class="bi bi-clock-history"></i></button></td>
                                    </tr>
                                </tbody>
                            </table>
                            <p class="p-3 text-muted" v-else>No patients yet.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    emits: ['open-treatment', 'view-history'],
    data() {
        return { store: window.store };
    },
    computed: {
        upcomingAppointments() {
            return this.store.appointments
                .filter(a => this.store.isUpcoming(a))
                .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
        },
        doctorPatients() {
            const byPatient = {};
            for (const a of this.store.appointments) {
                const p = byPatient[a.patient_id] || (byPatient[a.patient_id] = { patient_id: a.patient_id, name: a.patient_name, last_visit: null });
                if (a.status === 'Completed' && (!p.last_visit || a.date > p.last_visit)) p.last_visit = a.date;
            }
            return Object.values(byPatient).sort((a, b) => a.name.localeCompare(b.name));
        }
    },
    async created() {
        await this.store.loadAppointments();
    },
    methods: {
        async cancelAppointment(id) {
            if (!confirm('Cancel this appointment?')) return;
            try {
                await this.store.api('/appointments/' + id + '/cancel', 'PUT');
                this.store.showAlert('Appointment cancelled');
                await this.store.loadAppointments();
            } catch (e) {
                this.store.showAlert(e.message, 'danger');
            }
        }
    }
};
