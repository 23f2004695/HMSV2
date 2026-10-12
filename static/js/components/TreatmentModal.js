window.TreatmentModal = {
    emits: ['saved'],
    template: `
        <div class="modal fade" ref="modal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-success text-white">
                        <h5 class="modal-title">{{ viewOnly ? 'Treatment Details' : 'Add Treatment & Complete Appointment' }}</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-danger py-2" v-if="error">{{ error }}</div>
                        <div class="mb-2"><strong>Patient:</strong> {{ patientName }}</div>
                        <div class="mb-3"><strong>Date:</strong> {{ apptDate }} at {{ apptTime }}</div>
                        <div class="mb-3">
                            <label class="form-label">Diagnosis *</label>
                            <textarea class="form-control" v-model="form.diagnosis" rows="2" :readonly="viewOnly" maxlength="2000"></textarea>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Prescription</label>
                            <textarea class="form-control" v-model="form.prescription" rows="2" :readonly="viewOnly"></textarea>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Notes</label>
                            <textarea class="form-control" v-model="form.notes" rows="2" :readonly="viewOnly"></textarea>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Next Visit Date</label>
                            <input type="date" class="form-control" v-model="form.next_visit" :readonly="viewOnly" :min="apptDate">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        <button type="button" class="btn btn-success" @click="save" v-if="!viewOnly" :disabled="saving">
                            <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
                            Save & Complete
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            form: { diagnosis: '', prescription: '', notes: '', next_visit: '' },
            appointmentId: null,
            patientName: '',
            apptDate: '',
            apptTime: '',
            viewOnly: false,
            error: '',
            saving: false,
            bsModal: null
        };
    },
    mounted() {
        this.bsModal = new bootstrap.Modal(this.$refs.modal);
    },
    methods: {
        show(appointment, viewMode = false) {
            this.appointmentId = appointment.id;
            this.patientName = appointment.patient_name;
            this.apptDate = appointment.date;
            this.apptTime = appointment.time;
            this.viewOnly = viewMode;
            this.error = '';

            if (appointment.treatment) {
                const t = appointment.treatment;
                this.form = {
                    diagnosis: t.diagnosis || '',
                    prescription: t.prescription || '',
                    notes: t.notes || '',
                    next_visit: t.next_visit || ''
                };
            } else {
                this.form = { diagnosis: '', prescription: '', notes: '', next_visit: '' };
            }
            this.bsModal.show();
        },
        async save() {
            const s = window.store;
            this.error = '';
            if (!this.form.diagnosis.trim()) {
                this.error = 'Please enter a diagnosis';
                return;
            }
            this.saving = true;
            try {
                await s.api('/appointments/' + this.appointmentId + '/treatment', 'POST', {
                    diagnosis: this.form.diagnosis,
                    prescription: this.form.prescription,
                    notes: this.form.notes,
                    next_visit: this.form.next_visit || null
                });
                s.showAlert('Treatment saved and appointment marked as completed');
                this.bsModal.hide();
                this.$emit('saved');
            } catch (e) {
                this.error = e.message;
            } finally {
                this.saving = false;
            }
        }
    }
};
