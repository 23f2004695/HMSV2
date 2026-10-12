window.DoctorModal = {
    props: {
        departments: { type: Array, default: () => [] }
    },
    emits: ['saved'],
    template: `
        <div class="modal fade" ref="modal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title">{{ form.id ? 'Edit Doctor' : 'Add New Doctor' }}</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-danger py-2" v-if="error">{{ error }}</div>
                        <div class="mb-3" v-if="!form.id">
                            <label class="form-label">Username *</label>
                            <input type="text" class="form-control" v-model="form.username" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Full Name *</label>
                            <input type="text" class="form-control" v-model="form.name" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Email *</label>
                            <input type="email" class="form-control" v-model="form.email" required>
                        </div>
                        <div class="mb-3" v-if="!form.id">
                            <label class="form-label">Password *</label>
                            <input type="password" class="form-control" v-model="form.password" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Phone</label>
                            <input type="text" class="form-control" v-model="form.phone">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Department</label>
                            <select class="form-select" v-model="form.department_id">
                                <option value="">Select Department</option>
                                <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Specialization</label>
                            <input type="text" class="form-control" v-model="form.specialization">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Qualification</label>
                            <input type="text" class="form-control" v-model="form.qualification">
                        </div>
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label class="form-label">Experience (years)</label>
                                <input type="number" class="form-control" v-model.number="form.experience_years" min="0">
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label">Consultation Fee</label>
                                <input type="number" class="form-control" v-model.number="form.consultation_fee" min="0">
                            </div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Bio</label>
                            <textarea class="form-control" v-model="form.bio" rows="2"></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" @click="save" :disabled="saving">
                            <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
                            {{ form.id ? 'Update' : 'Add' }} Doctor
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            form: this.getEmptyForm(),
            error: '',
            saving: false,
            bsModal: null
        };
    },
    mounted() {
        this.bsModal = new bootstrap.Modal(this.$refs.modal);
    },
    methods: {
        getEmptyForm() {
            return {
                id: null, username: '', name: '', email: '', password: '', phone: '',
                department_id: '', specialization: '', qualification: '',
                experience_years: 0, consultation_fee: 0, bio: ''
            };
        },
        show(doctor = null) {
            this.form = doctor
                ? { ...this.getEmptyForm(), ...doctor, department_id: doctor.department_id || '', password: '' }
                : this.getEmptyForm();
            this.error = '';
            this.bsModal.show();
        },
        hide() {
            this.bsModal.hide();
        },
        async save() {
            const s = window.store;
            const f = this.form;
            this.error = '';
            if (!f.name.trim() || !f.email.trim() || (!f.id && (!f.username.trim() || !f.password))) {
                this.error = 'Please fill in all the required fields';
                return;
            }
            const payload = {
                name: f.name, email: f.email, phone: f.phone,
                department_id: f.department_id || null,
                specialization: f.specialization, qualification: f.qualification,
                experience_years: f.experience_years, consultation_fee: f.consultation_fee, bio: f.bio
            };
            if (!f.id) Object.assign(payload, { username: f.username, password: f.password });

            this.saving = true;
            try {
                if (f.id) {
                    await s.api('/doctors/' + f.id, 'PUT', payload);
                    s.showAlert('Doctor updated successfully');
                } else {
                    await s.api('/doctors', 'POST', payload);
                    s.showAlert('Doctor added successfully');
                }
                this.hide();
                this.$emit('saved');
            } catch (e) {
                this.error = e.message;
            } finally {
                this.saving = false;
            }
        }
    }
};
