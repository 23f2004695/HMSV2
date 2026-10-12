window.AdminDashboard = {
    template: `
        <div>
            <h3 class="mb-4">Welcome, Admin</h3>
            <!-- Stats Cards -->
            <div class="row g-3 mb-4">
                <div class="col-md-4">
                    <div class="card text-white bg-primary shadow">
                        <div class="card-body text-center">
                            <i class="bi bi-person-badge fs-1"></i>
                            <h3>{{ store.stats.total_doctors || 0 }}</h3>
                            <p class="mb-0">Registered Doctors</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card text-white bg-success shadow">
                        <div class="card-body text-center">
                            <i class="bi bi-people fs-1"></i>
                            <h3>{{ store.stats.total_patients || 0 }}</h3>
                            <p class="mb-0">Registered Patients</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card text-white bg-info shadow">
                        <div class="card-body text-center">
                            <i class="bi bi-calendar-check fs-1"></i>
                            <h3>{{ store.stats.total_appointments || 0 }}</h3>
                            <p class="mb-0">Total Appointments</p>
                        </div>
                    </div>
                </div>
            </div>
            <div class="row g-3 mb-4">
                <div class="col-md-4">
                    <div class="card border-warning shadow-sm">
                        <div class="card-body text-center">
                            <h4 class="text-warning">{{ store.stats.booked_appointments || 0 }}</h4>
                            <p class="mb-0">Booked</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card border-success shadow-sm">
                        <div class="card-body text-center">
                            <h4 class="text-success">{{ store.stats.completed_appointments || 0 }}</h4>
                            <p class="mb-0">Completed</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card border-danger shadow-sm">
                        <div class="card-body text-center">
                            <h4 class="text-danger">{{ store.stats.cancelled_appointments || 0 }}</h4>
                            <p class="mb-0">Cancelled</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Search -->
            <div class="card shadow-sm mb-4">
                <div class="card-body">
                    <div class="input-group">
                        <span class="input-group-text"><i class="bi bi-search"></i></span>
                        <input type="text" class="form-control" placeholder="Search doctors, patients, departments..."
                               v-model="searchQuery" @keyup.enter="doSearch">
                        <button class="btn btn-primary" @click="doSearch">Search</button>
                    </div>
                </div>
            </div>

            <!-- Search Results -->
            <div v-if="searchResults" class="card mb-4">
                <div class="card-header d-flex justify-content-between align-items-center">
                    Search Results
                    <button class="btn btn-sm btn-outline-secondary" @click="searchResults = null">Clear</button>
                </div>
                <div class="card-body">
                    <div v-if="searchResults.doctors.length">
                        <h6>Doctors</h6>
                        <table class="table table-sm table-striped">
                            <thead><tr><th>Name</th><th>Specialization</th><th>Department</th></tr></thead>
                            <tbody>
                                <tr v-for="d in searchResults.doctors" :key="d.id"><td>{{ d.name }}</td><td>{{ d.specialization }}</td><td>{{ d.department_name }}</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div v-if="searchResults.patients.length">
                        <h6>Patients</h6>
                        <table class="table table-sm table-striped">
                            <thead><tr><th>Name</th><th>Email</th><th>Phone</th></tr></thead>
                            <tbody>
                                <tr v-for="p in searchResults.patients" :key="p.id"><td>{{ p.name }}</td><td>{{ p.email }}</td><td>{{ p.phone }}</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div v-if="searchResults.departments.length">
                        <h6>Departments</h6>
                        <table class="table table-sm table-striped">
                            <thead><tr><th>Name</th><th>Description</th><th>Doctors</th></tr></thead>
                            <tbody>
                                <tr v-for="d in searchResults.departments" :key="d.id"><td>{{ d.name }}</td><td>{{ d.description }}</td><td>{{ d.doctors_count }}</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <p v-if="!searchResults.doctors.length && !searchResults.patients.length && !searchResults.departments.length" class="text-muted mb-0">No results found.</p>
                </div>
            </div>

            <!-- Recent Appointments -->
            <div class="card shadow-sm">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h5 class="mb-0">Recent Appointments</h5>
                    <button class="btn btn-sm btn-outline-primary" @click="store.navigate('appointments')">View All</button>
                </div>
                <div class="card-body p-0">
                    <p class="p-3 text-muted mb-0" v-if="!store.appointments.length">No appointments yet.</p>
                    <div class="table-responsive" v-else>
                    <table class="table table-hover mb-0">
                        <thead><tr><th>Patient</th><th>Doctor</th><th>Date</th><th>Time</th><th>Status</th></tr></thead>
                        <tbody>
                            <tr v-for="a in store.appointments.slice(0, 10)" :key="a.id">
                                <td>{{ a.patient_name }}</td><td>{{ a.doctor_name }}</td>
                                <td>{{ a.date }}</td><td>{{ a.time }}</td>
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
            searchResults: null
        };
    },
    async created() {
        await Promise.all([
            this.store.loadStats(),
            this.store.loadAppointments()
        ]);
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
