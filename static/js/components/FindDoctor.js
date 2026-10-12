window.FindDoctor = {
    emits: ['book-doctor', 'view-availability'],
    props: {
        initialDeptId: { type: [Number, String], default: '' }
    },
    template: `
        <div>
            <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                <h3 class="mb-0 fw-bold">Book an appointment</h3>
                <div class="btn-group" role="tablist">
                    <button class="btn text-nowrap" :class="mode === 'body' ? 'btn-primary' : 'btn-outline-primary'" @click="setMode('body')">
                        <i class="bi bi-person-arms-up me-1"></i> <span class="d-none d-sm-inline">Where does it hurt?</span><span class="d-sm-none">Body map</span>
                    </button>
                    <button class="btn text-nowrap" :class="mode === 'browse' ? 'btn-primary' : 'btn-outline-primary'" @click="setMode('browse')">
                        <i class="bi bi-grid me-1"></i> <span class="d-none d-sm-inline">Browse doctors</span><span class="d-sm-none">Browse</span>
                    </button>
                </div>
            </div>

            <transition name="page" mode="out-in">
                <div v-if="mode === 'body'" key="body" class="card mb-4">
                    <div class="card-body p-4">
                        <body-map @pick="onPick"></body-map>
                    </div>
                </div>
                <div v-else key="browse" class="row g-2 mb-4">
                    <div class="col-md-4">
                        <select class="form-select" v-model="deptFilter" @change="search">
                            <option value="">All Departments</option>
                            <option v-for="d in store.departments" :key="d.id" :value="d.id">{{ d.name }}</option>
                        </select>
                    </div>
                    <div class="col-md-5">
                        <div class="input-group">
                            <input type="text" class="form-control" v-model="nameSearch" placeholder="Search by name or specialty..." @keyup.enter="search">
                            <button class="btn btn-primary" @click="search">Search</button>
                        </div>
                    </div>
                </div>
            </transition>

            <div v-if="mode === 'body' && picked" class="d-flex align-items-center gap-2 mb-3">
                <h5 class="mb-0">{{ picked.department }} doctors</h5>
                <span class="badge bg-primary-subtle text-primary">{{ shownDoctors.length }}</span>
            </div>

            <app-loader v-if="loading" text="Finding doctors..."></app-loader>
            <div v-else-if="mode === 'body' && !picked" class="text-center text-muted small fw-semibold">Pick a symptom above and matching doctors will appear here.</div>
            <transition-group v-else name="list" tag="div" class="row g-3 position-relative">
                <div class="col-md-6 col-xl-4" v-for="d in shownDoctors" :key="d.id">
                    <div class="card doctor-card h-100">
                        <div class="card-body">
                            <illo class="card-mascot" :name="deptArt(d.department_name).img" :tips="[deptArt(d.department_name).tip]"></illo>
                            <div class="d-flex gap-3 align-items-center mb-3" style="padding-right: 80px">
                                <span class="avatar avatar-lg" :style="{ background: store.avatarColor(d.name) }">{{ d.initials || store.initials(d.name) }}</span>
                                <div>
                                    <h5 class="mb-0">Dr. {{ d.name }}</h5>
                                    <div class="text-muted small">{{ d.specialization }}</div>
                                    <span class="badge dept-tag mt-1">{{ d.department_name }}</span>
                                </div>
                            </div>
                            <div class="d-flex flex-wrap gap-3 small text-muted mb-3">
                                <span v-if="d.qualification"><i class="bi bi-award me-1"></i>{{ d.qualification }}</span>
                                <span><i class="bi bi-briefcase me-1"></i>{{ d.experience_years }} yrs</span>
                                <span><i class="bi bi-currency-rupee"></i>{{ d.consultation_fee }}</span>
                                <span><i class="bi bi-door-open me-1"></i>{{ d.room }}</span>
                            </div>
                            <p class="small text-muted" v-if="d.bio">{{ d.bio }}</p>
                            <div class="next-slot mb-3" :class="{ none: nextFree[d.id] === null }">
                                <i class="bi bi-lightning-charge-fill"></i>
                                <span v-if="nextFree[d.id] === undefined">Checking availability...</span>
                                <span v-else-if="nextFree[d.id] === null">No free slots this week</span>
                                <span v-else>Next free: <strong>{{ nextFree[d.id] }}</strong></span>
                            </div>
                            <div class="d-flex gap-2">
                                <button class="btn btn-primary flex-grow-1" @click="$emit('book-doctor', d)" :disabled="nextFree[d.id] === null">
                                    <i class="bi bi-calendar-plus me-1"></i> Book
                                </button>
                                <button class="btn btn-outline-secondary" @click="$emit('view-availability', d)" title="View availability"><i class="bi bi-clock"></i></button>
                            </div>
                        </div>
                    </div>
                </div>
            </transition-group>
            <empty-state v-if="!loading && (mode === 'browse' || picked) && !shownDoctors.length" illo="doctor-magnifier"
                         title="No doctors found" :text="picked && mode === 'body' ? 'Nobody in ' + picked.department + ' is taking bookings right now.' : 'Try another name or department.'"></empty-state>
        </div>
    `,
    data() {
        return {
            store: window.store,
            mode: this.initialDeptId ? 'browse' : 'body',
            deptFilter: this.initialDeptId || '',
            nameSearch: '',
            picked: null,
            loading: false,
            nextFree: {}
        };
    },
    computed: {
        shownDoctors() {
            if (this.mode === 'body') {
                if (!this.picked) return [];
                return this.store.doctors.filter(d => d.department_name === this.picked.department);
            }
            return this.store.doctors;
        }
    },
    async created() {
        await this.store.loadDepartments();
        await this.search();
    },
    watch: {
        initialDeptId(val) {
            if (val) {
                this.mode = 'browse';
                this.deptFilter = val;
                this.search();
            }
        },
        shownDoctors(list) {
            list.forEach(d => this.loadNextFree(d));
        }
    },
    methods: {
        setMode(mode) {
            this.mode = mode;
            if (mode === 'body') {
                this.deptFilter = '';
                this.nameSearch = '';
                this.search();
            }
        },
        async search() {
            this.loading = true;
            await this.store.loadDoctors(this.mode === 'browse' ? this.nameSearch : '', this.mode === 'browse' ? this.deptFilter : '');
            this.loading = false;
            this.shownDoctors.forEach(d => this.loadNextFree(d));
        },
        deptArt(name) {
            return window.deptIllo(name);
        },
        onPick(pick) {
            this.picked = pick;
        },
        async loadNextFree(doctor) {
            if (doctor.id in this.nextFree) return;
            this.nextFree[doctor.id] = undefined;
            try {
                const data = await this.store.api('/doctors/' + doctor.id + '/slots');
                const day = data.days.find(d => d.slots.length);
                this.nextFree[doctor.id] = day ? this.describe(day.date, day.slots[0]) : null;
            } catch (e) {
                this.nextFree[doctor.id] = null;
            }
        },
        describe(iso, time) {
            if (iso === this.store.todayStr) return 'Today ' + time;
            const d = new Date(iso + 'T00:00');
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow ' + time;
            return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + time;
        }
    }
};
