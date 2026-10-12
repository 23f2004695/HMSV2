// Treatments as a real-looking prescription pad. Writing one ends with the doctor's
// signature drawing itself; viewing one can be saved as a PDF from the print dialog.
window.TreatmentModal = {
    emits: ['saved'],
    template: `
        <div class="modal fade" ref="modal" tabindex="-1">
            <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                <div class="modal-content rx-modal">
                    <div class="modal-body p-0">
                        <div class="rx-pad" id="rx-print">
                            <div class="rx-head">
                                <div>
                                    <div class="rx-hospital"><i class="bi bi-heart-pulse-fill"></i> HMS Hospital</div>
                                    <div class="rx-doctor">Dr. {{ appt.doctor_name }}</div>
                                    <div class="rx-sub">{{ doctor.qualification || appt.department }} &middot; {{ appt.department }} &middot; {{ appt.room }}</div>
                                </div>
                                <div class="text-end rx-sub">
                                    <div>Token <strong>{{ appt.token }}</strong></div>
                                    <div>{{ niceDate }}</div>
                                </div>
                            </div>
                            <div class="rx-patient">
                                <span><span class="rx-label">Patient</span> {{ appt.patient_name }}</span>
                                <span><span class="rx-label">Visit</span> {{ appt.date }} {{ appt.time }}</span>
                            </div>

                            <div class="rx-symbol">&#8478;</div>

                            <div class="alert alert-danger py-2 d-print-none" v-if="error">{{ error }}</div>

                            <label class="rx-label">Diagnosis</label>
                            <textarea v-if="!viewOnly" class="rx-lines" v-model="form.diagnosis" rows="2" maxlength="2000" placeholder="What did you find?"></textarea>
                            <div v-else class="rx-written">{{ form.diagnosis }}</div>

                            <label class="rx-label">Prescription</label>
                            <textarea v-if="!viewOnly" class="rx-lines" v-model="form.prescription" rows="4" maxlength="2000" placeholder="Medicine, dose, how often, for how long"></textarea>
                            <div v-else class="rx-written">{{ form.prescription || '-' }}</div>

                            <label class="rx-label">Advice</label>
                            <textarea v-if="!viewOnly" class="rx-lines" v-model="form.notes" rows="2" maxlength="2000" placeholder="Rest, diet, tests..."></textarea>
                            <div v-else class="rx-written">{{ form.notes || '-' }}</div>

                            <div class="rx-foot">
                                <div>
                                    <span class="rx-label">Next visit</span>
                                    <input v-if="!viewOnly" type="date" class="form-control form-control-sm d-inline-block w-auto ms-2" v-model="form.next_visit" :min="appt.date">
                                    <span v-else class="rx-written d-inline ms-2">{{ form.next_visit || 'As needed' }}</span>
                                </div>
                                <div class="rx-sign">
                                    <svg viewBox="0 0 260 70" :class="{ signing }" aria-label="Signature">
                                        <text x="10" y="48">{{ signatureName }}</text>
                                    </svg>
                                    <div class="rx-sign-line">Dr. {{ appt.doctor_name }}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer d-print-none">
                        <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button>
                        <button v-if="viewOnly" type="button" class="btn btn-outline-primary" @click="downloadPdf"><i class="bi bi-file-earmark-pdf me-1"></i> Download PDF</button>
                        <button v-else type="button" class="btn btn-success" @click="save" :disabled="saving">
                            <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
                            <i v-else class="bi bi-pen me-1"></i> Sign &amp; complete visit
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            form: { diagnosis: '', prescription: '', notes: '', next_visit: '' },
            appt: {},
            doctor: {},
            viewOnly: false,
            signing: false,
            error: '',
            saving: false,
            bsModal: null
        };
    },
    computed: {
        niceDate() {
            return new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
        },
        signatureName() {
            const parts = (this.appt.doctor_name || '').split(' ');
            return parts.length > 1 ? parts[0][0] + '. ' + parts.slice(1).join(' ') : parts[0];
        }
    },
    mounted() {
        this.bsModal = new bootstrap.Modal(this.$refs.modal);
    },
    methods: {
        async show(appointment, viewMode = false) {
            this.appt = appointment;
            this.viewOnly = viewMode;
            this.error = '';
            this.signing = false;
            const t = appointment.treatment;
            this.form = t
                ? { diagnosis: t.diagnosis || '', prescription: t.prescription || '', notes: t.notes || '', next_visit: t.next_visit || '' }
                : { diagnosis: '', prescription: '', notes: '', next_visit: '' };
            this.doctor = {};
            this.bsModal.show();
            if (viewMode) setTimeout(() => { this.signing = true; }, 350);
            try {
                this.doctor = await window.store.api('/doctors/' + appointment.doctor_id);
            } catch (e) { /* letterhead falls back to the department */ }
        },
        async save() {
            const s = window.store;
            this.error = '';
            if (!this.form.diagnosis.trim()) {
                this.error = 'Please write a diagnosis before signing';
                return;
            }
            this.saving = true;
            this.signing = true;
            try {
                await s.api('/appointments/' + this.appt.id + '/treatment', 'POST', {
                    diagnosis: this.form.diagnosis,
                    prescription: this.form.prescription,
                    notes: this.form.notes,
                    next_visit: this.form.next_visit || null
                });
                // let the signature finish drawing before closing
                await new Promise(r => setTimeout(r, 1300));
                s.showAlert('Prescription signed and visit completed', 'success');
                this.bsModal.hide();
                this.$emit('saved');
            } catch (e) {
                this.error = e.message;
                this.signing = false;
            } finally {
                this.saving = false;
            }
        },
        downloadPdf() {
            // The print stylesheet shows only the prescription; "Save as PDF" in the dialog gives the file
            document.body.classList.add('printing-rx');
            const done = () => { document.body.classList.remove('printing-rx'); window.removeEventListener('afterprint', done); };
            window.addEventListener('afterprint', done);
            window.print();
            setTimeout(done, 1000);
        }
    }
};
