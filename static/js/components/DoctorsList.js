window.DoctorsList = {
    template: `
        <div>
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h3>Manage Doctors</h3>
                <button class="btn btn-primary" @click="$refs.doctorModal.show()"><i class="bi bi-plus-circle"></i> Add Doctor</button>
            </div>
            <div class="card shadow-sm">
                <div class="card-body p-0">
                    <div class="table-responsive">
                    <table class="table table-hover mb-0 align-middle">
                        <thead><tr><th>Name</th><th>Specialization</th><th>Department</th><th>Qualification</th><th>Experience</th><th>Fee</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody>
                            <tr v-for="d in store.doctors" :key="d.id" :class="{'table-secondary': !d.is_active}">
                                <td>{{ d.name }}</td><td>{{ d.specialization }}</td><td>{{ d.department_name }}</td>
                                <td>{{ d.qualification || '-' }}</td><td>{{ d.experience_years }} yrs</td><td>Rs. {{ d.consultation_fee }}</td>
                                <td>
                                    <span class="badge bg-success" v-if="d.is_active">Active</span>
                                    <span class="badge bg-secondary" v-else>Inactive</span>
                                </td>
                                <td>
                                    <button class="btn btn-sm btn-warning me-1" @click="$refs.doctorModal.show(d)" title="Edit"><i class="bi bi-pencil"></i></button>
                                    <button class="btn btn-sm btn-danger me-1" @click="deactivate(d.id)" v-if="d.is_active" title="Deactivate"><i class="bi bi-person-x"></i></button>
                                    <button class="btn btn-sm btn-success" @click="activate(d.id)" v-else title="Activate"><i class="bi bi-person-check"></i></button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    </div>
                    <p class="p-3 text-muted mb-0" v-if="!store.doctors.length">No doctors yet. Add the first one above.</p>
                </div>
            </div>

            <doctor-modal ref="doctorModal" :departments="store.departments" @saved="reload"></doctor-modal>
        </div>
    `,
    data() {
        return { store: window.store };
    },
    async created() {
        await Promise.all([
            this.store.loadDoctors(),
            this.store.loadDepartments()
        ]);
    },
    methods: {
        async reload() {
            await this.store.loadDoctors();
            await this.store.loadStats();
        },
        async deactivate(id) {
            if (!confirm('Deactivate this doctor?')) return;
            try {
                await this.store.api('/doctors/' + id, 'DELETE');
                this.store.showAlert('Doctor deactivated');
                await this.reload();
            } catch (e) { this.store.showAlert(e.message, 'danger'); }
        },
        async activate(id) {
            if (!confirm('Activate this doctor?')) return;
            try {
                await this.store.api('/doctors/' + id + '/activate', 'PUT');
                this.store.showAlert('Doctor activated');
                await this.reload();
            } catch (e) { this.store.showAlert(e.message, 'danger'); }
        }
    }
};
