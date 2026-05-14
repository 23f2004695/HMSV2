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
                <button class="btn btn-success" @click="exportCSV" v-if="showExport">
                    <i class="bi bi-download"></i> Export CSV
                </button>
            </div>
            <div class="card shadow-sm">
                <div class="card-body p-0">
                    <table class="table table-hover mb-0" v-if="history.length">
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
                    <p class="p-3 text-muted" v-else>No history found.</p>
                </div>
            </div>
        </div>
    `,
    data() {
        return { store: window.store, history: [], resolvedPatientId: null };
    },
    async created() {
        await this.loadHistory();
    },
    watch: {
        patientId() { this.loadHistory(); }
    },
    methods: {
        async loadHistory() {
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
            } catch (e) { console.error(e); }
        },
        async exportCSV() {
            try {
                if (!this.resolvedPatientId) return;
                const result = await this.store.api('/patients/' + this.resolvedPatientId + '/export/sync', 'POST');
                if (result.filename) {
                    window.open('/api/download/' + result.filename, '_blank');
                    this.store.showAlert('CSV exported successfully!');
                }
            } catch (e) {
                this.store.showAlert(e.message, 'danger');
            }
        }
    }
};
