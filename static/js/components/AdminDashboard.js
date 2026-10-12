window.AdminDashboard = {
    template: `
        <div>
            <hero-greeting :subtitle="subtitle"></hero-greeting>

            <div class="row g-3 mb-3 stagger">
                <div class="col-6 col-lg-3"><stat-tile label="Doctors" :value="store.stats.total_doctors || 0" illo="doctor-standing" tip="The whole team, active and on leave."></stat-tile></div>
                <div class="col-6 col-lg-3"><stat-tile label="Patients" :value="store.stats.total_patients || 0" illo="patient-cheer" tip="Everyone registered with us."></stat-tile></div>
                <div class="col-6 col-lg-3"><stat-tile label="Appointments" :value="store.stats.total_appointments || 0" illo="records-scene" tip="All bookings, past and future."></stat-tile></div>
                <div class="col-6 col-lg-3"><stat-tile label="Waiting today" :value="waitingToday" illo="nurse-notes" tip="Patients still in the waiting room."></stat-tile></div>
            </div>
            <div class="row g-3 mb-4 stagger">
                <div class="col-md-4"><stat-tile label="Booked" :value="store.stats.booked_appointments || 0" :total="store.stats.total_appointments || 0" icon="bi-calendar-event" color="#f5b544"></stat-tile></div>
                <div class="col-md-4"><stat-tile label="Completed" :value="store.stats.completed_appointments || 0" :total="store.stats.total_appointments || 0" icon="bi-check2-circle" color="#3fb56b"></stat-tile></div>
                <div class="col-md-4"><stat-tile label="Cancelled" :value="store.stats.cancelled_appointments || 0" :total="store.stats.total_appointments || 0" icon="bi-x-circle" color="#ec4c56"></stat-tile></div>
            </div>

            <!-- Search -->
            <div class="card mb-4">
                <div class="card-body">
                    <div class="input-group">
                        <span class="input-group-text bg-transparent"><i class="bi bi-search"></i></span>
                        <input type="text" class="form-control" placeholder="Search doctors, patients, departments..."
                               v-model="searchQuery" @keyup.enter="doSearch">
                        <button class="btn btn-primary" @click="doSearch">Search</button>
                    </div>
                </div>
            </div>

            <!-- Search Results -->
            <transition name="page">
            <div v-if="searchResults" class="card mb-4">
                <div class="card-header d-flex justify-content-between align-items-center">
                    Search Results
                    <button class="btn btn-sm btn-outline-secondary" @click="searchResults = null">Clear</button>
                </div>
                <div class="card-body">
                    <div v-if="searchResults.doctors.length">
                        <h6>Doctors</h6>
                        <div class="table-responsive">
                        <table class="table table-sm align-middle">
                            <thead><tr><th>Name</th><th>Specialization</th><th>Department</th></tr></thead>
                            <tbody>
                                <tr v-for="d in searchResults.doctors" :key="d.id"><td>Dr. {{ d.name }}</td><td>{{ d.specialization }}</td><td>{{ d.department_name }}</td></tr>
                            </tbody>
                        </table>
                        </div>
                    </div>
                    <div v-if="searchResults.patients.length">
                        <h6>Patients</h6>
                        <div class="table-responsive">
                        <table class="table table-sm align-middle">
                            <thead><tr><th>Name</th><th>Email</th><th>Phone</th></tr></thead>
                            <tbody>
                                <tr v-for="p in searchResults.patients" :key="p.id"><td>{{ p.name }}</td><td>{{ p.email }}</td><td>{{ p.phone }}</td></tr>
                            </tbody>
                        </table>
                        </div>
                    </div>
                    <div v-if="searchResults.departments.length">
                        <h6>Departments</h6>
                        <div class="table-responsive">
                        <table class="table table-sm align-middle">
                            <thead><tr><th>Name</th><th>Description</th><th>Doctors</th></tr></thead>
                            <tbody>
                                <tr v-for="d in searchResults.departments" :key="d.id"><td>{{ d.name }}</td><td>{{ d.description }}</td><td>{{ d.doctors_count }}</td></tr>
                            </tbody>
                        </table>
                        </div>
                    </div>
                    <p v-if="!searchResults.doctors.length && !searchResults.patients.length && !searchResults.departments.length" class="text-muted mb-0">No results found.</p>
                </div>
            </div>
            </transition>

            <!-- Recent Appointments -->
            <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <span><i class="bi bi-clock-history me-1"></i> Recent Appointments</span>
                    <button class="btn btn-sm btn-outline-primary" @click="store.navigate('appointments')">View All</button>
                </div>
                <div class="card-body p-0">
                    <app-loader v-if="loading" text="Loading appointments..."></app-loader>
                    <empty-state v-else-if="!store.appointments.length" illo="records-scene" title="No appointments yet" text="They'll show up here as patients book."></empty-state>
                    <div class="table-responsive" v-else>
                    <table class="table table-hover align-middle mb-0">
                        <thead><tr><th>Patient</th><th>Doctor</th><th>Date</th><th>Token</th><th>Status</th></tr></thead>
                        <tbody class="stagger">
                            <tr v-for="a in store.appointments.slice(0, 8)" :key="a.id">
                                <td>
                                    <div class="d-flex align-items-center gap-2">
                                        <span class="avatar" style="width:32px;height:32px;font-size:0.75rem" :style="{ background: store.avatarColor(a.patient_name) }">{{ store.initials(a.patient_name) }}</span>
                                        {{ a.patient_name }}
                                    </div>
                                </td>
                                <td>Dr. {{ a.doctor_name }}<div class="small text-muted">{{ a.department }}</div></td>
                                <td>{{ a.date }}<div class="small text-muted">{{ a.time }}</div></td>
                                <td><code>{{ a.token }}</code></td>
                                <td><span class="badge" :class="store.statusBadge(a.status)">{{ a.status }}</span></td>
                            </tr>
                        </tbody>
                    </table>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            store: window.store,
            searchQuery: '',
            searchResults: null,
            loading: true
        };
    },
    computed: {
        waitingToday() {
            return this.store.appointments.filter(a => a.date === this.store.todayStr && a.status === 'Booked' && !a.called_at).length;
        },
        subtitle() {
            const today = this.store.appointments.filter(a => a.date === this.store.todayStr && a.status !== 'Cancelled').length;
            return today
                ? `${today} appointment${today === 1 ? '' : 's'} on the books today, ${this.waitingToday} still waiting.`
                : 'No appointments today yet. A quiet day at the hospital.';
        }
    },
    async created() {
        await Promise.all([
            this.store.loadStats(),
            this.store.loadAppointments()
        ]);
        this.loading = false;
    },
    methods: {
        async doSearch() {
            if (!this.searchQuery.trim()) return;
            try {
                this.searchResults = await this.store.api('/search?q=' + encodeURIComponent(this.searchQuery));
            } catch (e) {
                this.store.showAlert(e.message, 'danger');
            }
        }
    }
};
