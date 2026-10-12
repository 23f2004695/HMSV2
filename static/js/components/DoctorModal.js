window.DoctorModal = {
    props: {
        doctor: { type: Object, default: null },
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
                                <input type="number" class="form-control" v-model.number="form.experience_years">
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label">Consultation Fee</label>
                                <input type="number" class="form-control" v-model.number="form.consultation_fee">
                            </div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Bio</label>
                            <textarea class="form-control" v-model="form.bio" rows="2"></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" @click="save">{{ form.id ? 'Update' : 'Add' }} Doctor</button>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            form: this.getEmptyForm(),
            bsModal: null
        };
    },
    watch: {
        doctor(newVal) {
            if (newVal) {
                this.form = { ...newVal };
            } else {
                this.form = this.getEmptyForm();
            }
        }
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
            this.form = doctor ? { ...doctor } : this.getEmptyForm();
            this.bsModal.show();
        },
        hide() {
            this.bsModal.hide();
        },
        async save() {
            const s = window.store;
            try {
                if (this.form.id) {
                    await s.api('/doctors/' + this.form.id, 'PUT', this.form);
                    s.showAlert('Doctor updated successfully');
                } else {
                    await s.api('/doctors', 'POST', this.form);
                    s.showAlert('Doctor added successfully');
                }
                this.hide();
                this.$emit('saved');
            } catch (e) {
                s.showAlert(e.message, 'danger');
            }
        }
    }
};
