window.PatientHistory = {
    props: {
        patientId: { type: Number, default: null },
        title: { type: String, default: 'My Treatment History' },
        showExport: { type: Boolean, default: false }
    },
    emits: ['view-treatment'],
    template: `
        <div>
            <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                <div>
                    <h3 class="fw-bold mb-0">{{ title }}</h3>
                    <div class="small text-muted" v-if="history.length">{{ visits.length }} visits &middot; {{ departmentsVisited }} departments &middot; since {{ firstDate }}</div>
                </div>
                <div class="d-flex gap-2">
                    <div class="btn-group btn-group-sm">
                        <button class="btn" :class="view === 'map' ? 'btn-primary' : 'btn-outline-primary'" @click="view = 'map'"><i class="bi bi-signpost-split"></i> Journey</button>
                        <button class="btn" :class="view === 'list' ? 'btn-primary' : 'btn-outline-primary'" @click="view = 'list'"><i class="bi bi-list-ul"></i> List</button>
                    </div>
                    <button class="btn btn-sm btn-success" @click="exportCSV" v-if="showExport && resolvedPatientId" :disabled="exporting">
                        <span v-if="exporting" class="spinner-border spinner-border-sm me-1"></span>
                        <i v-else class="bi bi-download"></i> {{ exporting ? 'Preparing...' : 'Export CSV' }}
                    </button>
                </div>
            </div>

            <ecg-loader v-if="loading" text="Loading history..."></ecg-loader>
            <div v-else-if="!history.length" class="card"><div class="empty-state"><i class="bi bi-signpost"></i>No visits yet. Your journey starts with your first appointment.</div></div>

            <template v-else-if="view === 'map'">
                <div class="card mb-3">
                    <div class="journey-scroll">
                        <svg class="journey" :width="mapWidth" height="190" :viewBox="'0 0 ' + mapWidth + ' 190'">
                            <path v-for="(seg, i) in segments" :key="'s' + i" :d="seg.d" class="journey-line" :stroke="seg.color" :style="{ animationDelay: (i * 0.25) + 's' }"></path>
                            <g v-for="(v, i) in visits" :key="v.id" class="station" :class="{ active: selected && selected.id === v.id, cancelled: v.status === 'Cancelled', future: v.status === 'Booked' }"
                               :style="{ animationDelay: (0.2 + i * 0.25) + 's' }" @click="selected = v" tabindex="0" @keydown.enter="selected = v" role="button">
                                <circle :cx="x(i)" cy="95" r="15" class="station-halo" :fill="color(v.department)"></circle>
                                <circle :cx="x(i)" cy="95" r="10" class="station-dot" :stroke="color(v.department)"></circle>
                                <text :x="x(i)" :y="i % 2 ? 145 : 55" text-anchor="middle" class="station-date">{{ shortDate(v.date) }}</text>
                                <text :x="x(i)" :y="i % 2 ? 163 : 37" text-anchor="middle" class="station-dept" :fill="color(v.department)">{{ v.department }}</text>
                            </g>
                        </svg>
                    </div>
                </div>
                <transition name="page" mode="out-in">
                    <div v-if="selected" :key="selected.id" class="card station-card" :style="{ borderTopColor: color(selected.department) }">
                        <div class="card-body">
                            <div class="d-flex flex-wrap justify-content-between gap-2 mb-2">
                                <div>
                                    <h5 class="mb-0">{{ selected.department }} &middot; Dr. {{ selected.doctor_name }}</h5>
                                    <div class="small text-muted">{{ longDate(selected.date) }} at {{ selected.time }} &middot; token {{ selected.token }}</div>
                                </div>
                                <span class="badge align-self-start" :class="store.statusBadge(selected.status)">{{ selected.status }}</span>
                            </div>
                            <div v-if="selected.treatment" class="row g-3">
                                <div class="col-md-6"><div class="small text-muted">Diagnosis</div><div class="fw-semibold">{{ selected.treatment.diagnosis }}</div></div>
                                <div class="col-md-6"><div class="small text-muted">Prescription</div><div>{{ selected.treatment.prescription || '-' }}</div></div>
                                <div class="col-12" v-if="selected.treatment.notes"><div class="small text-muted">Advice</div><div>{{ selected.treatment.notes }}</div></div>
                                <div class="col-12"><button class="btn btn-sm btn-outline-primary" @click="$emit('view-treatment', selected)"><i class="bi bi-file-earmark-medical me-1"></i> Open prescription</button></div>
                            </div>
                            <div v-else class="text-muted small">{{ selected.status === 'Booked' ? 'Upcoming visit. Reason: ' + (selected.reason || 'consultation') : 'No treatment recorded for this visit.' }}</div>
                        </div>
                    </div>
                </transition>
            </template>

            <div v-else class="card">
                <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead>
                        <tr><th>Date</th><th>Doctor</th><th>Status</th><th>Diagnosis</th><th>Prescription</th><th></th></tr>
                    </thead>
                    <tbody class="stagger">
                        <tr v-for="a in history" :key="a.id">
                            <td>{{ a.date }}<div class="small text-muted">{{ a.time }}</div></td>
                            <td>Dr. {{ a.doctor_name }}<div class="small text-muted">{{ a.department }}</div></td>
                            <td><span class="badge" :class="store.statusBadge(a.status)">{{ a.status }}</span></td>
                            <td>{{ a.treatment ? a.treatment.diagnosis : '-' }}</td>
                            <td class="small">{{ a.treatment ? a.treatment.prescription : '-' }}</td>
                            <td><button v-if="a.treatment" class="btn btn-sm btn-outline-primary" @click="$emit('view-treatment', a)" title="Open prescription"><i class="bi bi-file-earmark-medical"></i></button></td>
                        </tr>
                    </tbody>
                </table>
                </div>
            </div>
        </div>
    `,
    data() {
        return { store: window.store, history: [], resolvedPatientId: null, loading: false, exporting: false, view: 'map', selected: null };
    },
    async created() {
        await this.loadHistory();
    },
    watch: {
        patientId() { this.loadHistory(); }
    },
    computed: {
        // Oldest visit first, so the line reads left to right like a route
        visits() {
            return [...this.history].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
        },
        mapWidth() {
            return Math.max(700, 120 + this.visits.length * 150);
        },
        segments() {
            const segs = [];
            for (let i = 0; i < this.visits.length - 1; i++) {
                const x1 = this.x(i), x2 = this.x(i + 1);
                segs.push({ d: `M${x1},95 C${x1 + 60},95 ${x2 - 60},95 ${x2},95`, color: this.color(this.visits[i + 1].department) });
            }
            return segs;
        },
        departmentsVisited() {
            return new Set(this.visits.map(v => v.department)).size;
        },
        firstDate() {
            return this.visits.length ? this.shortDate(this.visits[0].date) : '';
        }
    },
    methods: {
        x(i) { return 70 + i * 150; },
        color(dept) {
            return {
                'Cardiology': '#e11d48', 'Orthopedics': '#f59e0b', 'Dermatology': '#a855f7', 'Pediatrics': '#ec4899',
                'Neurology': '#6366f1', 'ENT': '#14b8a6', 'Ophthalmology': '#0ea5e9', 'General Medicine': '#10b981'
            }[dept] || '#64748b';
        },
        shortDate(iso) {
            return new Date(iso + 'T00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' });
        },
        longDate(iso) {
            return new Date(iso + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        },
        async loadHistory() {
            this.loading = true;
            try {
                if (this.patientId) {
                    this.resolvedPatientId = this.patientId;
                } else {
                    const me = await this.store.api('/auth/me');
                    this.resolvedPatientId = me.patient ? me.patient.id : null;
                }
                if (this.resolvedPatientId) {
                    this.history = await this.store.api('/patients/' + this.resolvedPatientId + '/history');
                    const done = this.visits.filter(v => v.treatment);
                    this.selected = done[done.length - 1] || this.visits[this.visits.length - 1] || null;
                }
            } catch (e) {
                this.store.showAlert(e.message, 'danger');
            } finally {
                this.loading = false;
            }
        },
        async exportCSV() {
            if (!this.resolvedPatientId) return;
            const base = '/patients/' + this.resolvedPatientId + '/export';
            this.exporting = true;
            try {
                // Runs as a Celery job; falls back to an inline export if no worker picks it up
                const started = await this.store.api(base, 'POST');
                let filename = started.filename;
                if (!filename && started.task_id) {
                    filename = await this.waitForTask(started.task_id);
                }
                if (!filename) {
                    filename = (await this.store.api(base + '/sync', 'POST')).filename;
                }
                await this.store.download(filename);
                this.store.showAlert('CSV exported successfully!');
            } catch (e) {
                this.store.showAlert(e.message, 'danger');
            } finally {
                this.exporting = false;
            }
        },
        async waitForTask(taskId, attempts = 10) {
            for (let i = 0; i < attempts; i++) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                try {
                    const status = await this.store.api('/tasks/' + taskId);
                    if (status.state === 'SUCCESS') return status.filename;
                } catch (e) {
                    return null;
                }
            }
            return null;
        }
    }
};
