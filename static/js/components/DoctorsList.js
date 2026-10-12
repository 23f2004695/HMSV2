window.DoctorsList = {
    template: `
        <div>
            <div class="page-head mb-3">
                <illo name="doctor-heart" :tips="['Add a doctor and they can set their hours straight away.']" pop></illo>
                <div class="flex-grow-1">
                    <h3 class="fw-bold mb-0">Doctors</h3>
                    <div class="text-muted">{{ store.doctors.length }} on the team &middot; click the pencil to edit, or deactivate someone on leave</div>
                </div>
                <button class="btn btn-primary" @click="$refs.doctorModal.show()"><i class="bi bi-plus-circle"></i> Add Doctor</button>
            </div>
            <div class="card">
                <div class="card-body p-0">
                    <div class="table-responsive">
                    <table class="table table-hover mb-0 align-middle">
                        <thead><tr><th>Name</th><th>Specialization</th><th>Department</th><th>Qualification</th><th>Experience</th><th>Fee</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody>
                            <tr v-for="d in store.doctors" :key="d.id" :class="{'table-secondary': !d.is_active}">
                                <td>
                                    <div class="d-flex align-items-center gap-2">
                                        <span class="avatar" style="width:36px;height:36px;font-size:0.78rem" :style="{ background: store.avatarColor(d.name) }">{{ store.initials(d.name) }}</span>
                                        <div><div class="fw-semibold">Dr. {{ d.name }}</div><div class="small text-muted">{{ d.room }}</div></div>
                                    </div>
                                </td>
                                <td>{{ d.specialization }}</td>
                                <td><span class="dept-pill"><img :src="'/static/img/illos/' + deptArt(d.department_name).img + '.webp'" alt="">{{ d.department_name || '-' }}</span></td>
                                <td>{{ d.qualification || '-' }}</td><td>{{ d.experience_years }} yrs</td><td>&#8377;{{ d.consultation_fee }}</td>
                                <td>
                                    <span class="badge bg-success" v-if="d.is_active">Active</span>
                                    <span class="badge bg-secondary" v-else>Inactive</span>
                                </td>
                                <td class="text-nowrap">
                                    <button class="btn btn-sm btn-outline-primary me-1" @click="$refs.doctorModal.show(d)" title="Edit"><i class="bi bi-pencil"></i></button>
                                    <button class="btn btn-sm btn-outline-danger me-1" @click="deactivate(d.id)" v-if="d.is_active" title="Deactivate"><i class="bi bi-person-x"></i></button>
                                    <button class="btn btn-sm btn-outline-success" @click="activate(d.id)" v-else title="Activate"><i class="bi bi-person-check"></i></button>
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
        deptArt(name) {
            return window.deptIllo(name);
        },
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
