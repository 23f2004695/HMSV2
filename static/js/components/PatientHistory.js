window.PatientHistory = {
    props: {
        patientId: { type: Number, default: null },
        title: { type: String, default: 'My Treatment History' },
        showExport: { type: Boolean, default: false }
    },
    template: `
        <div>
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h3>{{ title }}</h3>
                <button class="btn btn-success" @click="exportCSV" v-if="showExport && resolvedPatientId" :disabled="exporting">
                    <span v-if="exporting" class="spinner-border spinner-border-sm me-1"></span>
                    <i v-else class="bi bi-download"></i> {{ exporting ? 'Preparing export...' : 'Export CSV' }}
                </button>
            </div>
            <div class="card shadow-sm">
                <div class="card-body p-0">
                    <div class="p-4 text-center text-muted" v-if="loading">
                        <span class="spinner-border spinner-border-sm me-1"></span> Loading history...
                    </div>
                    <div class="table-responsive" v-else-if="history.length">
                    <table class="table table-hover mb-0">
                        <thead>
                            <tr><th>#</th><th>Date</th><th>Time</th><th>Doctor</th><th>Status</th><th>Diagnosis</th><th>Prescription</th><th>Notes</th></tr>
                        </thead>
                        <tbody>
                            <tr v-for="(a, idx) in history" :key="a.id">
                                <td>{{ idx + 1 }}</td><td>{{ a.date }}</td><td>{{ a.time }}</td>
                                <td>Dr. {{ a.doctor_name }}</td>
                                <td><span class="badge" :class="store.statusBadge(a.status)">{{ a.status }}</span></td>
                                <td>{{ a.treatment ? a.treatment.diagnosis : '-' }}</td>
                                <td>{{ a.treatment ? a.treatment.prescription : '-' }}</td>
                                <td>{{ a.treatment ? a.treatment.notes : '-' }}</td>
                            </tr>
                        </tbody>
                    </table>
                    </div>
                    <p class="p-3 text-muted mb-0" v-else>No history found.</p>
                </div>
            </div>
        </div>
    `,
    data() {
        return { store: window.store, history: [], resolvedPatientId: null, loading: false, exporting: false };
    },
    async created() {
        await this.loadHistory();
    },
    watch: {
        patientId() { this.loadHistory(); }
    },
    methods: {
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
