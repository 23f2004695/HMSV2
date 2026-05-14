window.FindDoctor = {
    emits: ['book-doctor', 'view-availability'],
    template: `
        <div>
            <h3 class="mb-3">Find a Doctor</h3>
            <div class="row mb-3">
                <div class="col-md-4">
                    <select class="form-select" v-model="deptFilter" @change="search">
                        <option value="">All Departments</option>
                        <option v-for="d in store.departments" :key="d.id" :value="d.id">{{ d.name }}</option>
                    </select>
                </div>
                <div class="col-md-4">
                    <div class="input-group">
                        <input type="text" class="form-control" v-model="nameSearch" placeholder="Search by name..." @keyup.enter="search">
                        <button class="btn btn-primary" @click="search">Search</button>
                    </div>
                </div>
            </div>
            <div class="row g-3">
                <div class="col-md-4" v-for="d in store.doctors" :key="d.id">
                    <div class="card shadow-sm h-100">
                        <div class="card-body">
                            <h5 class="card-title text-primary">Dr. {{ d.name }}</h5>
                            <p class="mb-1"><i class="bi bi-heart-pulse"></i> {{ d.specialization }}</p>
                            <p class="mb-1"><i class="bi bi-building"></i> {{ d.department_name }}</p>
                            <p class="mb-1"><i class="bi bi-award"></i> {{ d.qualification }}</p>
                            <p class="mb-1"><i class="bi bi-briefcase"></i> {{ d.experience_years }} years exp.</p>
                            <p class="mb-2"><i class="bi bi-currency-rupee"></i> Rs. {{ d.consultation_fee }}</p>
                            <div class="d-flex gap-2">
                                <button class="btn btn-sm btn-outline-info" @click="$emit('view-availability', d)">View Availability</button>
                                <button class="btn btn-sm btn-primary" @click="$emit('book-doctor', d)">Book Appointment</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <p class="text-muted mt-3" v-if="!store.doctors.length">No doctors found matching your criteria.</p>
        </div>
    `,
    props: {
        initialDeptId: { type: [Number, String], default: '' }
    },
    data() {
        return {
            store: window.store,
            deptFilter: this.initialDeptId || '',
            nameSearch: ''
        };
    },
    async created() {
        await this.store.loadDepartments();
        await this.search();
    },
    watch: {
        initialDeptId(val) {
            if (val) {
                this.deptFilter = val;
                this.search();
            }
        }
    },
    methods: {
        async search() {
            await this.store.loadDoctors(this.nameSearch, this.deptFilter);
        }
    }
};
