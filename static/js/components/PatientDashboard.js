window.PatientDashboard = {
    template: `
        <div>
            <h3 class="mb-4">Welcome, {{ store.user.name }}</h3>
            <div class="row g-3 mb-4">
                <div class="col-md-8">
                    <!-- Departments -->
                    <div class="card shadow-sm mb-3">
                        <div class="card-header bg-primary text-white">
                            <h5 class="mb-0"><i class="bi bi-building"></i> Departments</h5>
                        </div>
                        <div class="card-body">
                            <div class="row g-2">
                                <div class="col-md-4 col-6" v-for="dept in store.departments" :key="dept.id">
                                    <div class="card border-primary h-100 dept-card" @click="$emit('find-doctor-dept', dept.id)">
                                        <div class="card-body text-center py-3">
                                            <i class="bi bi-heart-pulse fs-3 text-primary"></i>
                                            <h6 class="mt-2 mb-0">{{ dept.name }}</h6>
                                            <small class="text-muted">{{ dept.doctors_count }} {{ dept.doctors_count === 1 ? 'doctor' : 'doctors' }}</small>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <!-- Upcoming Appointments -->
                    <div class="card shadow-sm">
                        <div class="card-header bg-info text-white d-flex justify-content-between align-items-center">
                            <h5 class="mb-0"><i class="bi bi-calendar-check"></i> Upcoming Appointments</h5>
                            <button class="btn btn-sm btn-light" @click="store.navigate('find-doctor')">Book New</button>
                        </div>
                        <div class="card-body p-0">
                            <div class="table-responsive" v-if="upcomingAppointments.length">
                            <table class="table table-hover mb-0">
                                <thead><tr><th>Doctor</th><th>Department</th><th>Date</th><th>Time</th><th>Status</th><th>Actions</th></tr></thead>
                                <tbody>
                                    <tr v-for="a in upcomingAppointments" :key="a.id">
                                        <td>Dr. {{ a.doctor_name }}</td><td>{{ a.department }}</td>
                                        <td>{{ a.date }}</td><td>{{ a.time }}</td>
                                        <td><span class="badge" :class="store.statusBadge(a.status)">{{ a.status }}</span></td>
                                        <td>
                                            <button class="btn btn-sm btn-warning me-1" @click="$emit('reschedule', a)" v-if="a.status==='Booked'" title="Reschedule">
                                                <i class="bi bi-arrow-repeat"></i>
                                            </button>
                                            <button class="btn btn-sm btn-danger" @click="cancelAppointment(a.id)" v-if="a.status==='Booked'" title="Cancel">
                                                <i class="bi bi-x-circle"></i>
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                            </div>
                            <p class="p-3 text-muted mb-0" v-else>No upcoming appointments. <a href="#" @click.prevent="store.navigate('find-doctor')">Book one now!</a></p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <!-- Profile Card -->
                    <div class="card shadow-sm mb-3">
                        <div class="card-header bg-secondary text-white">
                            <h5 class="mb-0"><i class="bi bi-person"></i> My Profile</h5>
                        </div>
                        <div class="card-body">
                            <p><strong>Name:</strong> {{ store.user.name }}</p>
                            <p><strong>Email:</strong> {{ store.user.email }}</p>
                            <p><strong>Phone:</strong> {{ store.user.phone || '-' }}</p>
                            <button class="btn btn-sm btn-outline-primary" @click="store.navigate('profile')">Edit Profile</button>
                        </div>
                    </div>
                    <!-- Recent History -->
                    <div class="card shadow-sm">
                        <div class="card-header bg-dark text-white">
                            <h5 class="mb-0"><i class="bi bi-clock-history"></i> Recent History</h5>
                        </div>
                        <div class="card-body p-0">
                            <div class="list-group list-group-flush">
                                <div class="list-group-item text-muted" v-if="!pastAppointments.length">No past visits yet.</div>
                                <div class="list-group-item" v-for="a in pastAppointments.slice(0, 5)" :key="a.id">
                                    <div class="d-flex justify-content-between">
                                        <strong>Dr. {{ a.doctor_name }}</strong>
                                        <span class="badge" :class="store.statusBadge(a.status)">{{ a.status === 'Booked' ? 'Missed' : a.status }}</span>
                                    </div>
                                    <small class="text-muted">{{ a.date }} | {{ a.time }}</small>
                                    <div v-if="a.treatment"><small class="text-success">Diagnosis: {{ a.treatment.diagnosis }}</small></div>
                                </div>
                            </div>
                            <div class="p-2 text-center">
                                <button class="btn btn-sm btn-outline-dark" @click="store.navigate('my-history')">View Full History</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    emits: ['find-doctor-dept', 'reschedule'],
    data() {
        return { store: window.store };
    },
    computed: {
        upcomingAppointments() {
            return this.store.appointments
                .filter(a => this.store.isUpcoming(a))
                .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
        },
        pastAppointments() {
            return this.store.appointments.filter(a => !this.store.isUpcoming(a));
        }
    },
    async created() {
        await Promise.all([
            this.store.loadDepartments(),
            this.store.loadAppointments()
        ]);
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
