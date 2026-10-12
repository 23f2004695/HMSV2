window.AppointmentsList = {
    emits: ['open-treatment', 'view-treatment', 'reschedule'],
    template: `
        <div>
            <h3 class="mb-3">Appointments</h3>
            <div class="btn-group mb-3">
                <button class="btn" :class="filter === '' ? 'btn-primary' : 'btn-outline-primary'" @click="setFilter('')">All</button>
                <button class="btn" :class="filter === 'Booked' ? 'btn-warning' : 'btn-outline-warning'" @click="setFilter('Booked')">Booked</button>
                <button class="btn" :class="filter === 'Completed' ? 'btn-success' : 'btn-outline-success'" @click="setFilter('Completed')">Completed</button>
                <button class="btn" :class="filter === 'Cancelled' ? 'btn-danger' : 'btn-outline-danger'" @click="setFilter('Cancelled')">Cancelled</button>
            </div>
            <div class="card shadow-sm">
                <div class="card-body p-0">
                    <table class="table table-hover mb-0">
                        <thead><tr><th>ID</th><th>Patient</th><th>Doctor</th><th>Date</th><th>Time</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody>
                            <tr v-for="a in store.appointments" :key="a.id">
                                <td>{{ a.id }}</td><td>{{ a.patient_name }}</td><td>Dr. {{ a.doctor_name }}</td>
                                <td>{{ a.date }}</td><td>{{ a.time }}</td>
                                <td><span class="badge" :class="store.statusBadge(a.status)">{{ a.status }}</span></td>
                                <td>
                                    <button class="btn btn-sm btn-success me-1" v-if="a.status==='Booked' && canComplete" @click="$emit('open-treatment', a)" title="Complete">
                                        <i class="bi bi-check-circle"></i>
                                    </button>
                                    <button class="btn btn-sm btn-warning me-1" v-if="a.status==='Booked' && store.user.role==='patient'" @click="$emit('reschedule', a)" title="Reschedule">
                                        <i class="bi bi-arrow-repeat"></i>
                                    </button>
                                    <button class="btn btn-sm btn-danger me-1" v-if="a.status==='Booked'" @click="cancel(a.id)" title="Cancel">
                                        <i class="bi bi-x-circle"></i>
                                    </button>
                                    <button class="btn btn-sm btn-info" v-if="a.treatment" @click="$emit('view-treatment', a)" title="View Treatment">
                                        <i class="bi bi-file-medical"></i>
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `,
    data() {
        return { store: window.store, filter: '' };
    },
    computed: {
        canComplete() {
            return this.store.user.role === 'doctor' || this.store.user.role === 'admin';
        }
    },
    async created() {
        await this.store.loadAppointments(this.filter);
    },
    methods: {
        async setFilter(f) {
            this.filter = f;
            await this.store.loadAppointments(f);
        },
        async cancel(id) {
            if (!confirm('Cancel this appointment?')) return;
            try {
                await this.store.api('/appointments/' + id + '/cancel', 'PUT');
                this.store.showAlert('Appointment cancelled');
                await this.store.loadAppointments(this.filter);
            } catch (e) { this.store.showAlert(e.message, 'danger'); }
        }
    }
};
