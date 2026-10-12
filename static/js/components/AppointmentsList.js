window.AppointmentsList = {
    emits: ['open-treatment', 'view-treatment', 'reschedule', 'view-ticket'],
    template: `
        <div>
            <h3 class="mb-3 fw-bold">Appointments</h3>
            <div class="btn-group mb-3 flex-wrap">
                <button class="btn" :class="filter === '' ? 'btn-primary' : 'btn-outline-primary'" @click="setFilter('')">All</button>
                <button class="btn" :class="filter === 'Booked' ? 'btn-warning' : 'btn-outline-warning'" @click="setFilter('Booked')">Booked</button>
                <button class="btn" :class="filter === 'Completed' ? 'btn-success' : 'btn-outline-success'" @click="setFilter('Completed')">Completed</button>
                <button class="btn" :class="filter === 'Cancelled' ? 'btn-danger' : 'btn-outline-danger'" @click="setFilter('Cancelled')">Cancelled</button>
            </div>
            <div class="card">
                <div class="card-body p-0">
                    <div class="table-responsive" v-if="store.appointments.length">
                    <table class="table table-hover mb-0 align-middle">
                        <thead><tr><th>Token</th><th>Patient</th><th>Doctor</th><th>Date</th><th>Time</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody class="stagger">
                            <tr v-for="a in store.appointments" :key="a.id">
                                <td><code>{{ a.token }}</code></td>
                                <td>
                                    <div class="d-flex align-items-center gap-2">
                                        <span class="avatar" style="width:30px;height:30px;font-size:0.7rem" :style="{ background: store.avatarColor(a.patient_name) }">{{ store.initials(a.patient_name) }}</span>
                                        {{ a.patient_name }}
                                    </div>
                                </td>
                                <td>Dr. {{ a.doctor_name }}<div class="small text-muted">{{ a.department }}</div></td>
                                <td>{{ a.date }}</td><td>{{ a.time }}</td>
                                <td><span class="badge" :class="store.statusBadge(a.status)">{{ a.status }}</span></td>
                                <td class="text-nowrap">
                                    <button class="btn btn-sm btn-outline-primary me-1" v-if="a.status==='Booked'" @click="$emit('view-ticket', a)" title="Ticket">
                                        <i class="bi bi-ticket-perforated"></i>
                                    </button>
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
                    <empty-state v-else illo="nurse-clipboard" title="Nothing here" text="No appointments match this filter."></empty-state>
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
