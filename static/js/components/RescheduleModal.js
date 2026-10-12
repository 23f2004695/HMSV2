window.RescheduleModal = {
    emits: ['rescheduled'],
    template: `
        <div class="modal fade" ref="modal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-warning">
                        <h5 class="modal-title">Reschedule Appointment</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p class="mb-3 text-muted">
                            Currently with Dr. {{ doctorName }} on {{ currentDate }} at {{ currentTime }}
                        </p>
                        <div class="alert alert-danger py-2" v-if="error">{{ error }}</div>
                        <div v-if="availability.length" class="mb-3">
                            <h6>Available slots</h6>
                            <div v-for="slot in availability" :key="slot.id"
                                 class="badge me-1 mb-1 p-2 slot-badge"
                                 :class="form.date === slot.date && form.time === slot.start_time ? 'bg-primary' : 'bg-success'"
                                 @click="pickSlot(slot)">
                                {{ slot.date }} | {{ slot.start_time }} - {{ slot.end_time }}
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label class="form-label">New Date *</label>
                                <input type="date" class="form-control" v-model="form.date" :min="store.todayStr" :max="store.weekLaterStr">
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label">New Time *</label>
                                <input type="time" class="form-control" v-model="form.time">
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-warning" @click="reschedule" :disabled="saving">
                            <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
                            Reschedule
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            store: window.store,
            form: { date: '', time: '' },
            appointmentId: null,
            doctorName: '',
            currentDate: '',
            currentTime: '',
            availability: [],
            error: '',
            saving: false,
            bsModal: null
        };
    },
    mounted() {
        this.bsModal = new bootstrap.Modal(this.$refs.modal);
    },
    methods: {
        pickSlot(slot) {
            this.form.date = slot.date;
            this.form.time = slot.start_time;
            this.error = '';
        },
        async show(appointment) {
            this.appointmentId = appointment.id;
            this.doctorName = appointment.doctor_name;
            this.currentDate = appointment.date;
            this.currentTime = appointment.time;
            this.form = { date: '', time: '' };
            this.error = '';
            try {
                this.availability = await this.store.api('/doctors/' + appointment.doctor_id + '/availability');
            } catch (e) {
                this.availability = [];
            }
            this.bsModal.show();
        },
        async reschedule() {
            this.error = '';
            if (!this.form.date || !this.form.time) {
                this.error = 'Please choose a new date and time';
                return;
            }
            this.saving = true;
            try {
                await this.store.api('/appointments/' + this.appointmentId, 'PUT', this.form);
                this.store.showAlert('Appointment rescheduled successfully');
                this.bsModal.hide();
                this.$emit('rescheduled');
            } catch (e) {
                this.error = e.message;
            } finally {
                this.saving = false;
            }
        }
    }
};
