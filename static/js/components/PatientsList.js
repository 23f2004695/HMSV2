window.PatientsList = {
    emits: ['view-history'],
    template: `
        <div>
            <div class="page-head mb-3">
                <illo name="nurse-clipboard" :tips="['Search by name, phone or email.']" pop></illo>
                <div class="flex-grow-1">
                    <h3 class="fw-bold mb-0">Patients</h3>
                    <div class="text-muted">{{ patients.length }} registered &middot; open anyone's journey or deactivate an account</div>
                </div>
            </div>
            <div class="input-group mb-3" style="max-width:420px;">
                <span class="input-group-text bg-white"><i class="bi bi-search"></i></span>
                <input type="text" class="form-control" placeholder="Search patients..." v-model="searchText" @keyup.enter="search">
                <button class="btn btn-primary" @click="search">Search</button>
            </div>
            <div class="card">
                <div class="card-body p-0">
                    <div class="table-responsive">
                    <table class="table table-hover mb-0 align-middle">
                        <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Gender</th><th>Blood Group</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody>
                            <tr v-for="p in patients" :key="p.id" :class="{'table-secondary': !p.is_active}">
                                <td class="text-muted">#{{ p.id }}</td>
                                <td>
                                    <div class="d-flex align-items-center gap-2">
                                        <span class="avatar" style="width:36px;height:36px;font-size:0.78rem" :style="{ background: store.avatarColor(p.name) }">{{ store.initials(p.name) }}</span>
                                        <span class="fw-semibold">{{ p.name }}</span>
                                    </div>
                                </td>
                                <td>{{ p.email }}</td><td>{{ p.phone }}</td>
                                <td>{{ p.gender || '-' }}</td><td><span v-if="p.blood_group" class="blood-pill">{{ p.blood_group }}</span><span v-else>-</span></td>
                                <td>
                                    <span class="badge bg-success" v-if="p.is_active">Active</span>
                                    <span class="badge bg-secondary" v-else>Inactive</span>
                                </td>
                                <td class="text-nowrap">
                                    <button class="btn btn-sm btn-outline-primary me-1" @click="$emit('view-history', p.id)" title="View journey"><i class="bi bi-signpost-split"></i></button>
                                    <button class="btn btn-sm btn-outline-danger me-1" @click="deactivate(p.id)" v-if="p.is_active" title="Deactivate"><i class="bi bi-person-x"></i></button>
                                    <button class="btn btn-sm btn-outline-success" @click="activate(p.id)" v-else title="Activate"><i class="bi bi-person-check"></i></button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    </div>
                    <p class="p-3 text-muted mb-0" v-if="!patients.length">No patients found.</p>
                </div>
            </div>
        </div>
    `,
    data() {
        return { store: window.store, patients: [], searchText: '' };
    },
    async created() {
        await this.search();
    },
    methods: {
        async search() {
            try {
                let url = '/patients';
                if (this.searchText) url += '?search=' + encodeURIComponent(this.searchText);
                this.patients = await this.store.api(url);
            } catch (e) { this.store.showAlert(e.message, 'danger'); }
        },
        async deactivate(id) {
            if (!confirm('Deactivate this patient?')) return;
            try {
                await this.store.api('/patients/' + id + '/deactivate', 'PUT');
                this.store.showAlert('Patient deactivated');
                await this.search();
            } catch (e) { this.store.showAlert(e.message, 'danger'); }
        },
        async activate(id) {
            if (!confirm('Activate this patient?')) return;
            try {
                await this.store.api('/patients/' + id + '/activate', 'PUT');
                this.store.showAlert('Patient activated');
                await this.search();
            } catch (e) { this.store.showAlert(e.message, 'danger'); }
        }
    }
};
