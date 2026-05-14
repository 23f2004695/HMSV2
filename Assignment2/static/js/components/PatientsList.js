window.PatientsList = {
    emits: ['view-history'],
    template: `
        <div>
            <h3 class="mb-3">Manage Patients</h3>
            <div class="input-group mb-3" style="max-width:400px;">
                <input type="text" class="form-control" placeholder="Search patients..." v-model="searchText" @keyup.enter="search">
                <button class="btn btn-primary" @click="search">Search</button>
            </div>
            <div class="card shadow-sm">
                <div class="card-body p-0">
                    <table class="table table-hover mb-0">
                        <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Gender</th><th>Blood Group</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody>
                            <tr v-for="p in patients" :key="p.id" :class="{'table-secondary': !p.is_active}">
                                <td>{{ p.id }}</td><td>{{ p.name }}</td><td>{{ p.email }}</td><td>{{ p.phone }}</td>
                                <td>{{ p.gender }}</td><td>{{ p.blood_group }}</td>
                                <td>
                                    <span class="badge bg-success" v-if="p.is_active">Active</span>
                                    <span class="badge bg-secondary" v-else>Inactive</span>
                                </td>
                                <td>
                                    <button class="btn btn-sm btn-info me-1" @click="$emit('view-history', p.id)" title="View History"><i class="bi bi-clock-history"></i></button>
                                    <button class="btn btn-sm btn-danger me-1" @click="deactivate(p.id)" v-if="p.is_active" title="Deactivate"><i class="bi bi-person-x"></i></button>
                                    <button class="btn btn-sm btn-success" @click="activate(p.id)" v-else title="Activate"><i class="bi bi-person-check"></i></button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
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
            } catch (e) { console.error(e); }
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
